$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ProductDir = Join-Path $Root 'PC-Build\images\products'
$DestDir = Join-Path $ProductDir 'hardware-v1504'
$ManifestPath = Join-Path $ProductDir 'hardware-exact-v1504.json'
$MapPath = Join-Path $ProductDir 'local-hardware-map-v1504.js'
$ReportPath = Join-Path $ProductDir 'hardware-ready-v1504.json'
$OldMapPath = Join-Path $ProductDir 'source-map-v1502.json'
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
$Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json

function Normalize-Name([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
  $s = $Value.ToLowerInvariant().Replace('&amp;','&')
  $s = [regex]::Replace($s,'[^a-z0-9]+',' ')
  return [regex]::Replace($s,'\s+',' ').Trim()
}

function Test-ImageFile([string]$Path) {
  try {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    $fi = Get-Item -LiteralPath $Path
    if ($fi.Length -lt 512) { return $false }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 12) { return $false }
    if ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8 -and $bytes[2] -eq 0xFF) { return $true }
    if ($bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47 -and $bytes[4] -eq 0x0D -and $bytes[5] -eq 0x0A -and $bytes[6] -eq 0x1A -and $bytes[7] -eq 0x0A) { return $true }
    if ([Text.Encoding]::ASCII.GetString($bytes,0,4) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($bytes,8,4) -eq 'WEBP') { return $true }
    if ([Text.Encoding]::ASCII.GetString($bytes,0,4) -eq 'GIF8') { return $true }
    return $false
  } catch { return $false }
}

function Copy-IfValid([string]$Source,[string]$Dest) {
  try {
    if (Test-ImageFile $Source) {
      Copy-Item -LiteralPath $Source -Destination $Dest -Force
      if (Test-ImageFile $Dest) { return $true }
    }
  } catch {}
  return $false
}

$SourceMapImages = @()
try {
  if (Test-Path -LiteralPath $OldMapPath) {
    $sm = Get-Content -Raw -LiteralPath $OldMapPath | ConvertFrom-Json
    if ($sm.images) { $SourceMapImages = @($sm.images) }
  }
} catch {}

function Try-Reuse($Item,[string]$Dest) {
  $candidates = New-Object System.Collections.Generic.List[string]
  # Same filename from a previous v1503 preparation.
  $candidates.Add((Join-Path (Join-Path $ProductDir 'hardware-v1503') $Item.filename))
  foreach ($n in @($Item.reuse)) {
    if ($n) { $candidates.Add((Join-Path $ProductDir ([string]$n))) }
  }
  $id = [string]$Item.id
  $nk = Normalize-Name ([string]$Item.name)
  foreach ($x in $SourceMapImages) {
    $matched = $false
    foreach ($xi in @($x.ids)) { if ([string]$xi -eq $id) { $matched = $true; break } }
    if (-not $matched) {
      foreach ($xn in @($x.names)) { if ((Normalize-Name ([string]$xn)) -eq $nk) { $matched = $true; break } }
    }
    if ($matched -and $x.filename) { $candidates.Add((Join-Path $ProductDir ([string]$x.filename))) }
  }
  foreach ($src in $candidates) {
    if (Copy-IfValid $src $Dest) { return "reuse:$([IO.Path]::GetFileName($src))" }
  }
  return $null
}

function Download-Image([string]$Url,[string]$Dest) {
  $tmp = "$Dest.part"
  Remove-Item -Force -ErrorAction SilentlyContinue $tmp
  $headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36'
    'Accept' = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  }
  try {
    $u = [Uri]$Url
    $headers['Referer'] = $u.GetLeftPart([UriPartial]::Authority) + '/'
  } catch {}
  try {
    Invoke-WebRequest -Uri $Url -OutFile $tmp -MaximumRedirection 8 -TimeoutSec 45 -Headers $headers -UseBasicParsing
    if (Test-ImageFile $tmp) {
      Move-Item -LiteralPath $tmp -Destination $Dest -Force
      return 'Invoke-WebRequest'
    }
  } catch {}
  Remove-Item -Force -ErrorAction SilentlyContinue $tmp
  try {
    $curl = Get-Command 'curl.exe' -ErrorAction SilentlyContinue
    if ($curl) {
      & $curl.Source -L --fail --retry 3 --retry-delay 1 --connect-timeout 20 --max-time 70 -A $headers['User-Agent'] -o $tmp $Url 2>$null
      if ($LASTEXITCODE -eq 0 -and (Test-ImageFile $tmp)) {
        Move-Item -LiteralPath $tmp -Destination $Dest -Force
        return 'curl.exe'
      }
    }
  } catch {}
  Remove-Item -Force -ErrorAction SilentlyContinue $tmp
  return $null
}

function Escape-JsString([string]$s) {
  return $s.Replace('\\','\\\\').Replace("'","\\'").Replace("`r",'').Replace("`n",'')
}

Write-Host 'AZOBSS v1504 - PREPARE 14 EXACT HARDWARE SHOP IMAGES' -ForegroundColor Cyan
Write-Host 'Windows-native downloader: PowerShell first, curl.exe fallback.'
$okRows = @()
$failed = @()
$items = @($Manifest.items)
for ($i=0; $i -lt $items.Count; $i++) {
  $item = $items[$i]
  $dest = Join-Path $DestDir ([string]$item.filename)
  $source = $null
  if (Test-ImageFile $dest) { $source = 'cached' }
  if (-not $source) { $source = Try-Reuse $item $dest }
  if (-not $source) {
    foreach ($url in @($item.urls)) {
      if (-not $url) { continue }
      $source = Download-Image ([string]$url) $dest
      if ($source) { $source = "$source:$url"; break }
    }
  }
  $num = ('{0:D2}' -f ($i+1))
  if ($source -and (Test-ImageFile $dest)) {
    $size = (Get-Item -LiteralPath $dest).Length
    Write-Host "[$num/$($items.Count)] OK   $($item.name) ($source, $size bytes)" -ForegroundColor Green
    $okRows += [pscustomobject]@{ item=$item; source=$source; size=$size }
  } else {
    Write-Host "[$num/$($items.Count)] FAIL $($item.name)" -ForegroundColor Red
    $failed += [pscustomobject]@{ id=[string]$item.id; name=[string]$item.name }
  }
}

$byId = [ordered]@{}
$byName = [ordered]@{}
foreach ($row in $okRows) {
  $item = $row.item
  $local = '/PC-Build/images/products/hardware-v1504/' + [string]$item.filename
  $byId[[string]$item.id] = $local
  $nk = Normalize-Name ([string]$item.name)
  if ($nk) { $byName[$nk] = $local }
}
$mapObj = [ordered]@{
  version='1504'
  policy='hardware-exact-local-only-powershell-prepared'
  ready=($okRows.Count -gt 0)
  complete=($okRows.Count -eq $items.Count)
  expected=$items.Count
  downloaded=$okRows.Count
  missing=($items.Count-$okRows.Count)
  byId=$byId
  byName=$byName
}
$mapJson = $mapObj | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText($MapPath, 'window.AZOBSS_PC_LOCAL_HARDWARE_IMAGES=' + $mapJson + ';' + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$report = [ordered]@{
  ok=($okRows.Count -gt 0)
  complete=($okRows.Count -eq $items.Count)
  version='1504'
  expected=$items.Count
  downloaded=$okRows.Count
  missing=($items.Count-$okRows.Count)
  failed=$failed
  preparedAt=(Get-Date).ToUniversalTime().ToString('o')
}
[IO.File]::WriteAllText($ReportPath, ($report | ConvertTo-Json -Depth 8) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host "Hardware images ready: $($okRows.Count)/$($items.Count)" -ForegroundColor Cyan
if ($failed.Count -gt 0) {
  Write-Host 'Produk yang gagal sahaja akan guna placeholder:' -ForegroundColor Yellow
  foreach ($f in $failed) { Write-Host " - $($f.id) | $($f.name)" -ForegroundColor Yellow }
}
if ($okRows.Count -eq 0) {
  Write-Host 'FAILED: 0/14. ZIP FINAL tidak dibina supaya laman kosong tidak ter-upload.' -ForegroundColor Red
  exit 2
}

$out = Join-Path (Split-Path -Parent $Root) '(1504)-AZOBSS-FULL-WEBSITE-HARDWARE-EXACT-LOCAL-FINAL_20261103.zip'
Remove-Item -Force -ErrorAction SilentlyContinue $out
Write-Host ''
Write-Host 'Membina ZIP FINAL...' -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $Root '*') -DestinationPath $out -CompressionLevel Optimal -Force
if (-not (Test-Path -LiteralPath $out)) { throw 'ZIP FINAL gagal dibina.' }
Write-Host ''
Write-Host 'FINAL ZIP UNTUK UPLOAD:' -ForegroundColor Green
Write-Host $out -ForegroundColor Green
Write-Host 'JANGAN upload ZIP PREPARER.' -ForegroundColor Yellow
exit 0
