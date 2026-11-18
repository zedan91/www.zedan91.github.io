@echo off
setlocal EnableExtensions
chcp 65001 >nul
title AZOBSS - PC Spec to WhatsApp

set "SELF=%~f0"
set "INFO_PS1=%TEMP%\AZOBSS_Full_System_Info_%RANDOM%_%RANDOM%.ps1"
set "PAYLOAD_LINE="

for /f "tokens=1 delims=:" %%N in ('findstr /n /b /c:":__AZOBSS_INFO_PS1__" "%SELF%"') do set "PAYLOAD_LINE=%%N"

if not defined PAYLOAD_LINE (
    echo.
    echo [GAGAL] Payload maklumat sistem tidak dijumpai.
    pause
    exit /b 1
)

more +%PAYLOAD_LINE% "%SELF%" > "%INFO_PS1%"
if not exist "%INFO_PS1%" (
    echo.
    echo [GAGAL] Script maklumat sistem tidak dapat disediakan.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INFO_PS1%"
set "RESULT=%errorlevel%"
del /f /q "%INFO_PS1%" >nul 2>&1
endlocal
exit /b %RESULT%

:__AZOBSS_INFO_PS1__
#Requires -Version 5.1
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$Report = New-Object 'System.Collections.Generic.List[string]'

Write-Host ''
Write-Host 'AZOBSS CUSTOMER PC DIAGNOSTIC' -ForegroundColor Cyan
Write-Host 'Laporan meliputi spesifikasi, nombor siri, nama komputer dan maklumat rangkaian tempatan.' -ForegroundColor Yellow
Write-Host 'Dengan persetujuan anda, laporan penuh dimuat naik ke Cloudflare AZOBSS untuk semakan admin sahaja.' -ForegroundColor Yellow
$cloudConsent = (Read-Host 'Setuju hantar laporan kepada AZOBSS selepas ia siap? [Y/N]') -match '^(?i:y|ya|yes)$'

Write-Host 'Tiada password atau fail peribadi dihantar. Windows key penuh tidak dihantar.' -ForegroundColor DarkGray
Write-Host ''

function Add-Report {
    param(
        [AllowEmptyString()][string]$Text = '',
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )
    [void]$Report.Add($Text)
    Write-Host $Text -ForegroundColor $Color
}

function Add-Section {
    param([string]$Title)
    Add-Report ''
    Add-Report ('=' * 72) Cyan
    Add-Report $Title White
    Add-Report ('=' * 72) Cyan
}

function Get-DisplayValue {
    param($Value, [string]$Fallback = 'Tidak tersedia')
    if ($null -eq $Value) { return $Fallback }
    $s = [string]$Value
    if ([string]::IsNullOrWhiteSpace($s)) { return $Fallback }
    return $s.Trim()
}

function Add-Info {
    param([string]$Label, $Value)
    Add-Report (('{0,-27}: {1}' -f $Label, (Get-DisplayValue $Value)))
}

function Get-CimSafe {
    param(
        [Parameter(Mandatory = $true)][string]$ClassName,
        [string]$Namespace = 'root/cimv2',
        [string]$Filter = ''
    )
    try {
        $p = @{ ClassName = $ClassName; Namespace = $Namespace; ErrorAction = 'Stop' }
        if ($Filter) { $p.Filter = $Filter }
        return @(Get-CimInstance @p)
    }
    catch {
        try {
            $p = @{ Class = $ClassName; Namespace = $Namespace; ErrorAction = 'Stop' }
            if ($Filter) { $p.Filter = $Filter }
            return @(Get-WmiObject @p)
        }
        catch { return @() }
    }
}

function Format-GB {
    param($Bytes)
    try {
        if ($null -eq $Bytes -or [double]$Bytes -le 0) { return 'Tidak tersedia' }
        return ('{0:N2} GB' -f ([double]$Bytes / 1GB))
    }
    catch { return 'Tidak tersedia' }
}

function Format-Speed {
    param($BitsPerSecond)
    try {
        $v = [double]$BitsPerSecond
        if ($v -ge 1000000000) { return ('{0:N2} Gbps' -f ($v / 1000000000)) }
        if ($v -ge 1000000) { return ('{0:N0} Mbps' -f ($v / 1000000)) }
        if ($v -gt 0) { return ('{0:N0} Kbps' -f ($v / 1000)) }
    }
    catch {}
    return 'Tidak tersedia'
}

function Format-CompactCapacity {
    param($Bytes)
    try {
        $v = [double]$Bytes
        if ($v -le 0) { return 'Tidak tersedia' }
        if ($v -ge 0.90TB) { return ('{0:N2} TB' -f ($v / 1TB)) }
        return ('{0:N2} GB' -f ($v / 1GB))
    }
    catch { return 'Tidak tersedia' }
}

function Get-CleanCpuName {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) { return 'Tidak tersedia' }
    $value = $Name
    $value = $value -replace '\(R\)|\(TM\)|\(C\)', ''
    $value = $value -replace '\s+CPU\s*@.*$', ''
    $value = $value -replace '\s+', ' '
    return $value.Trim()
}

function Get-CleanHardwareName {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) { return 'Tidak tersedia' }
    $value = $Name -replace '\(R\)|\(TM\)|\(C\)', ''
    $value = $value -replace '\s+', ' '
    return $value.Trim()
}

function Get-CleanManufacturer {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) { return 'Tidak tersedia' }
    if ($Name -match 'Micro-Star International') { return 'MSI' }
    if ($Name -match 'ASUSTeK') { return 'ASUS' }
    if ($Name -match 'Gigabyte Technology') { return 'GIGABYTE' }
    if ($Name -match 'Hewlett-Packard') { return 'HP' }
    return ($Name -replace '\s+', ' ').Trim()
}

function Format-DateValue {
    param($Value)
    if ($null -eq $Value) { return 'Tidak tersedia' }
    if ($Value -is [datetime]) { return $Value.ToString('dd/MM/yyyy HH:mm:ss') }
    try {
        return ([Management.ManagementDateTimeConverter]::ToDateTime([string]$Value)).ToString('dd/MM/yyyy HH:mm:ss')
    }
    catch { return (Get-DisplayValue $Value) }
}

function Get-MemoryTypeName {
    param([int]$Code)
    $map = @{ 20='DDR'; 21='DDR2'; 22='DDR2 FB-DIMM'; 24='DDR3'; 26='DDR4'; 30='LPDDR4'; 34='DDR5'; 35='LPDDR5' }
    if ($map.ContainsKey($Code)) { return $map[$Code] }
    if ($Code -gt 0) { return "SMBIOS $Code" }
    return 'Tidak diketahui'
}

function Get-BusTypeName {
    param([int]$Code)
    $map = @{ 0='Unknown'; 1='SCSI'; 2='ATAPI'; 3='ATA'; 4='IEEE 1394'; 5='SSA'; 6='Fibre Channel'; 7='USB'; 8='RAID'; 9='iSCSI'; 10='SAS'; 11='SATA'; 12='SD'; 13='MMC'; 14='Virtual'; 15='File Backed Virtual'; 16='Storage Spaces'; 17='NVMe'; 18='SCM'; 19='UFS' }
    if ($map.ContainsKey($Code)) { return $map[$Code] }
    return 'Unknown'
}

function Get-MediaTypeName {
    param([int]$Code, [string]$Fallback)
    $map = @{ 3='HDD'; 4='SSD'; 5='SCM' }
    if ($map.ContainsKey($Code)) { return $map[$Code] }
    if ($Fallback -match 'SSD|Solid State') { return 'SSD' }
    if ($Fallback -match 'Fixed hard disk') { return 'HDD / Fixed Disk' }
    return (Get-DisplayValue $Fallback 'Tidak diketahui')
}

function Get-HealthName {
    param($Code)
    $map = @{ 0='Healthy'; 1='Warning'; 2='Unhealthy'; 5='Unknown' }
    try {
        $i = [int]$Code
        if ($map.ContainsKey($i)) { return $map[$i] }
    }
    catch {}
    return (Get-DisplayValue $Code 'Tidak tersedia')
}

function Get-GpuMemoryBytes {
    param([string]$GpuName, $Fallback)
    try {
        $root = 'HKLM:\SYSTEM\CurrentControlSet\Control\Video'
        foreach ($adapterKey in @(Get-ChildItem -LiteralPath $root -ErrorAction Stop)) {
            foreach ($subKey in @(Get-ChildItem -LiteralPath $adapterKey.PSPath -ErrorAction SilentlyContinue)) {
                if ($subKey.PSChildName -notmatch '^000\d$') { continue }
                $p = Get-ItemProperty -LiteralPath $subKey.PSPath -ErrorAction SilentlyContinue
                $desc = [string]$p.DriverDesc
                if (-not $desc) { continue }
                if ($desc -eq $GpuName -or $desc -like "*$GpuName*" -or $GpuName -like "*$desc*") {
                    $memory = $p.'HardwareInformation.qwMemorySize'
                    if ($memory) { return [uint64]$memory }
                }
            }
        }
    }
    catch {}
    try {
        if ([uint64]$Fallback -gt 0) { return [uint64]$Fallback }
    }
    catch {}
    return $null
}

Clear-Host
Write-Host ''
Write-Host 'Mengumpul maklumat sistem, sila tunggu...' -ForegroundColor Yellow

$cs = Get-CimSafe Win32_ComputerSystem | Select-Object -First 1
$os = Get-CimSafe Win32_OperatingSystem | Select-Object -First 1
$baseboard = Get-CimSafe Win32_BaseBoard | Select-Object -First 1
$bios = Get-CimSafe Win32_BIOS | Select-Object -First 1
$product = Get-CimSafe Win32_ComputerSystemProduct | Select-Object -First 1
$enclosure = Get-CimSafe Win32_SystemEnclosure | Select-Object -First 1

$summaryCpus = @(Get-CimSafe Win32_Processor)
$summaryGpus = @(Get-CimSafe Win32_VideoController | Where-Object { $_.Name })
$summaryRamModules = @(Get-CimSafe Win32_PhysicalMemory)
$summaryDisks = @(Get-CimSafe Win32_DiskDrive | Sort-Object Index)
$summaryStorageDisks = @(Get-CimSafe MSFT_PhysicalDisk 'root/Microsoft/Windows/Storage')

$cpuParts = @()
for ($i = 0; $i -lt $summaryCpus.Count; $i++) {
    $cpu = $summaryCpus[$i]
    $cpuName = Get-CleanCpuName ([string]$cpu.Name)
    $cpuClock = if ($cpu.MaxClockSpeed) { '{0:N2} GHz' -f ([double]$cpu.MaxClockSpeed / 1000) } else { 'Clock tidak tersedia' }
    $cpuText = '{0} {1} {2}C / {3}T' -f $cpuName, $cpuClock, (Get-DisplayValue $cpu.NumberOfCores '?'), (Get-DisplayValue $cpu.NumberOfLogicalProcessors '?')
    if ($summaryCpus.Count -gt 1) { $cpuText = 'CPU{0} {1}' -f ($i + 1), $cpuText }
    $cpuParts += $cpuText
}
$cpuSummary = if ($cpuParts.Count) { $cpuParts -join ' / ' } else { 'Tidak tersedia' }

$gpuParts = @()
for ($i = 0; $i -lt $summaryGpus.Count; $i++) {
    $gpu = $summaryGpus[$i]
    $gpuName = Get-CleanHardwareName ([string]$gpu.Name)
    $gpuText = 'GPU{0} {1}' -f ($i + 1), $gpuName
    $gpuMem = Get-GpuMemoryBytes -GpuName ([string]$gpu.Name) -Fallback $gpu.AdapterRAM
    $isIntegrated = $gpuName -match '(?i)Intel|UHD|Iris|Microsoft Basic|AMD Radeon Graphics$'
    if (-not $isIntegrated -and $gpuMem -and [double]$gpuMem -gt 0) {
        $gpuText += ' {0} VRAM' -f (Format-GB $gpuMem)
    }
    $gpuParts += $gpuText
}
$gpuSummary = if ($gpuParts.Count) { $gpuParts -join ' / ' } else { 'Tidak tersedia' }

$ramTypeNames = @(
    $summaryRamModules |
        ForEach-Object { Get-MemoryTypeName ([int]$_.SMBIOSMemoryType) } |
        Where-Object { $_ -and $_ -ne 'Tidak diketahui' } |
        Select-Object -Unique
)
$ramTypeText = if ($ramTypeNames.Count) { $ramTypeNames -join '/' } else { 'Jenis tidak tersedia' }
$ramSpeeds = @(
    $summaryRamModules |
        ForEach-Object {
            if ($_.ConfiguredClockSpeed) { [int]$_.ConfiguredClockSpeed }
            elseif ($_.Speed) { [int]$_.Speed }
        } |
        Where-Object { $_ -gt 0 } |
        Sort-Object -Descending -Unique
)
$ramSpeedText = if ($ramSpeeds.Count) { '{0} MHz' -f $ramSpeeds[0] } else { 'Kelajuan tidak tersedia' }
$ramModuleText = ''
if ($summaryRamModules.Count -gt 0) {
    $ramCapacities = @($summaryRamModules | ForEach-Object { [uint64]$_.Capacity } | Select-Object -Unique)
    if ($ramCapacities.Count -eq 1) {
        $ramModuleText = ' ({0} x {1})' -f $summaryRamModules.Count, (Format-CompactCapacity $ramCapacities[0])
    }
    else {
        $ramModuleText = ' ({0} modul)' -f $summaryRamModules.Count
    }
}
$ramSummary = '{0} {1} {2}{3}' -f (Format-GB $cs.TotalPhysicalMemory), $ramTypeText, $ramSpeedText, $ramModuleText

$diskParts = @()
for ($i = 0; $i -lt $summaryDisks.Count; $i++) {
    $disk = $summaryDisks[$i]
    $storage = $summaryStorageDisks | Where-Object {
        $_.FriendlyName -eq $disk.Model -or
        ([string]$disk.Model).Contains([string]$_.FriendlyName) -or
        ([string]$_.FriendlyName).Contains([string]$disk.Model)
    } | Select-Object -First 1
    $diskName = Get-CleanHardwareName ([string]$disk.Model)
    $diskSize = Format-CompactCapacity $disk.Size
    $media = Get-MediaTypeName ([int]$storage.MediaType) ([string]$disk.MediaType)
    $bus = if ($storage) { Get-BusTypeName ([int]$storage.BusType) } else { Get-DisplayValue $disk.InterfaceType '' }
    $diskKindParts = @($bus, $media) | Where-Object { $_ -and $_ -notmatch 'Unknown|Tidak diketahui|Tidak tersedia' } | Select-Object -Unique
    $diskKind = if ($diskKindParts.Count) { ' ' + ($diskKindParts -join ' ') } else { '' }
    $diskParts += ('Disk{0} {1} {2}{3}' -f ($i + 1), $diskName, $diskSize, $diskKind)
}
$diskSummary = if ($diskParts.Count) { $diskParts -join ' / ' } else { 'Tidak tersedia' }

$computerSummary = ('{0} {1}' -f (Get-CleanManufacturer ([string]$cs.Manufacturer)), (Get-DisplayValue $cs.Model '')).Trim()
$motherboardSummary = ('{0} {1}' -f (Get-CleanManufacturer ([string]$baseboard.Manufacturer)), (Get-DisplayValue $baseboard.Product '')).Trim()
$windowsName = (Get-DisplayValue $os.Caption) -replace '^Microsoft\s+', ''
$windowsSummary = '{0} {1} Build {2}' -f $windowsName, (Get-DisplayValue $os.OSArchitecture), (Get-DisplayValue $os.BuildNumber)

$summaryLicense = Get-CimSafe SoftwareLicensingProduct | Where-Object {
    $_.ApplicationID -eq '55c92734-d682-4d71-983e-d6ec3f16059f' -and $_.PartialProductKey
} | Sort-Object LicenseStatus -Descending | Select-Object -First 1
$activationSummary = if ($summaryLicense -and [int]$summaryLicense.LicenseStatus -eq 1) {
    'Licensed / Activated'
}
elseif ($summaryLicense) {
    'Belum diaktifkan / Status {0}' -f $summaryLicense.LicenseStatus
}
else {
    'Tidak tersedia'
}

Clear-Host
Add-Report ('=' * 72) Cyan
Add-Report '                 AZOBSS CUSTOMER PC DIAGNOSTIC' White
Add-Report ('=' * 72) Cyan
Add-Report ('Tarikh semakan: {0}' -f (Get-Date -Format 'dd/MM/yyyy HH:mm:ss')) DarkGray

Add-Section 'RINGKASAN SPESIFIKASI'
Add-Info 'Computer' $computerSummary
Add-Info 'CPU' $cpuSummary
Add-Info 'GPU' $gpuSummary
Add-Info 'RAM' $ramSummary
Add-Info 'Disk' $diskSummary
Add-Info 'Motherboard' $motherboardSummary
Add-Info 'Windows' $windowsSummary
Add-Info 'Activation' $activationSummary

Add-Section '1. COMPUTER & WINDOWS'
Add-Info 'Computer Name' $env:COMPUTERNAME
Add-Info 'Manufacturer' $cs.Manufacturer
Add-Info 'Model' $cs.Model
Add-Info 'System Type' $cs.SystemType
$deviceKind = switch ([int]$cs.PCSystemType) {
    1 { 'Desktop' }
    2 { 'Laptop' }
    3 { 'Desktop' }
    4 { 'Server' }
    5 { 'Server' }
    default { 'Tidak diketahui' }
}
Add-Info 'Device Type' $deviceKind
Add-Info 'System Serial Number' $(if ($bios.SerialNumber) { $bios.SerialNumber } else { $enclosure.SerialNumber })
Add-Info 'Windows Edition' $os.Caption
Add-Info 'Windows Version' $os.Version
Add-Info 'Windows Build' $os.BuildNumber
Add-Info 'Architecture' $os.OSArchitecture
Add-Info 'Install Date' (Format-DateValue $os.InstallDate)
Add-Info 'Last Boot' (Format-DateValue $os.LastBootUpTime)

Add-Section '2. WINDOWS LICENSE & KEY'
$licProducts = Get-CimSafe SoftwareLicensingProduct
$windowsProduct = $licProducts | Where-Object {
    $_.ApplicationID -eq '55c92734-d682-4d71-983e-d6ec3f16059f' -and $_.PartialProductKey
} | Sort-Object LicenseStatus -Descending | Select-Object -First 1
$licenseMap = @{ 0='Unlicensed'; 1='Licensed / Activated'; 2='OOB Grace'; 3='OOT Grace'; 4='Non-Genuine Grace'; 5='Notification'; 6='Extended Grace' }
$licenseStatus = 'Tidak tersedia'
if ($windowsProduct) {
    $code = [int]$windowsProduct.LicenseStatus
    if ($licenseMap.ContainsKey($code)) { $licenseStatus = $licenseMap[$code] } else { $licenseStatus = "Status $code" }
}
$slService = Get-CimSafe SoftwareLicensingService | Select-Object -First 1
Add-Info 'Activation Status' $licenseStatus
Add-Info 'Licensed Product' $windowsProduct.Name
Add-Info 'Installed Key (Last 5)' $windowsProduct.PartialProductKey
$oemKeyDisplay = 'Tidak tersedia'
if ($slService -and -not [string]::IsNullOrWhiteSpace([string]$slService.OA3xOriginalProductKey)) {
    $oemRaw = ([string]$slService.OA3xOriginalProductKey).Trim()
    if ($oemRaw.Length -ge 5) { $oemKeyDisplay = '*****-*****-*****-*****-' + $oemRaw.Substring($oemRaw.Length - 5) }
}
Add-Info 'OEM BIOS Key (Masked)' $oemKeyDisplay

Add-Section '3. MOTHERBOARD, BIOS & SECURITY'
Add-Info 'Motherboard Manufacturer' $baseboard.Manufacturer
Add-Info 'Motherboard Product' $baseboard.Product
Add-Info 'Motherboard Version' $baseboard.Version
Add-Info 'Motherboard Serial' $baseboard.SerialNumber
Add-Info 'BIOS Manufacturer' $bios.Manufacturer
Add-Info 'BIOS Version' $bios.SMBIOSBIOSVersion
Add-Info 'BIOS Release Date' (Format-DateValue $bios.ReleaseDate)
$firmwareMode = 'Tidak tersedia'
try {
    $firmwareCode = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control' -Name PEFirmwareType -ErrorAction Stop).PEFirmwareType
    if ([int]$firmwareCode -eq 2) { $firmwareMode = 'UEFI' }
    elseif ([int]$firmwareCode -eq 1) { $firmwareMode = 'Legacy BIOS' }
}
catch {}
Add-Info 'Firmware Mode' $firmwareMode
$secureBoot = 'Tidak disokong / Tidak tersedia'
try {
    if (Get-Command Confirm-SecureBootUEFI -ErrorAction SilentlyContinue) {
        $secureBoot = if (Confirm-SecureBootUEFI -ErrorAction Stop) { 'Enabled' } else { 'Disabled' }
    }
}
catch {}
Add-Info 'Secure Boot' $secureBoot
$tpmText = 'Tidak tersedia'
try {
    if (Get-Command Get-Tpm -ErrorAction SilentlyContinue) {
        $tpm = Get-Tpm
        if ($tpm.TpmPresent) {
            $tpmText = 'Present; Ready={0}; Enabled={1}; Activated={2}' -f $tpm.TpmReady, $tpm.TpmEnabled, $tpm.TpmActivated
        } else { $tpmText = 'Not Present' }
    }
}
catch {}
Add-Info 'TPM' $tpmText

Add-Section '4. CPU'
$cpus = @(Get-CimSafe Win32_Processor)
if ($cpus.Count -eq 0) { Add-Report 'CPU information tidak tersedia.' Yellow }
for ($i = 0; $i -lt $cpus.Count; $i++) {
    $cpu = $cpus[$i]
    Add-Report ('CPU {0}' -f ($i + 1)) Green
    Add-Info 'Name' $cpu.Name
    Add-Info 'Manufacturer' $cpu.Manufacturer
    Add-Info 'Socket' $cpu.SocketDesignation
    Add-Info 'Cores / Logical' ('{0} / {1}' -f $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors)
    Add-Info 'Maximum Clock' $(if ($cpu.MaxClockSpeed) { '{0:N2} GHz' -f ([double]$cpu.MaxClockSpeed / 1000) } else { 'Tidak tersedia' })
    Add-Info 'Virtualization Firmware' $cpu.VirtualizationFirmwareEnabled
    if ($i -lt ($cpus.Count - 1)) { Add-Report '' }
}

Add-Section '5. GPU / DISPLAY'
$gpus = @(Get-CimSafe Win32_VideoController | Where-Object { $_.Name })
if ($gpus.Count -eq 0) { Add-Report 'GPU information tidak tersedia.' Yellow }
for ($i = 0; $i -lt $gpus.Count; $i++) {
    $gpu = $gpus[$i]
    $gpuMem = Get-GpuMemoryBytes -GpuName ([string]$gpu.Name) -Fallback $gpu.AdapterRAM
    Add-Report ('GPU {0}' -f ($i + 1)) Green
    Add-Info 'Name' $gpu.Name
    Add-Info 'Video Processor' $gpu.VideoProcessor
    Add-Info 'VRAM Reported' (Format-GB $gpuMem)
    Add-Info 'Driver Version' $gpu.DriverVersion
    $displayMode = 'Tidak tersedia'
    if ($gpu.CurrentHorizontalResolution -and $gpu.CurrentVerticalResolution) {
        $displayMode = '{0} x {1}' -f $gpu.CurrentHorizontalResolution, $gpu.CurrentVerticalResolution
        if ($gpu.CurrentRefreshRate) { $displayMode += ' @ {0} Hz' -f $gpu.CurrentRefreshRate }
    }
    Add-Info 'Current Display Mode' $displayMode
    if ($i -lt ($gpus.Count - 1)) { Add-Report '' }
}

Add-Section '6. RAM / MEMORY'
$ramModules = @(Get-CimSafe Win32_PhysicalMemory)
$memoryArray = Get-CimSafe Win32_PhysicalMemoryArray | Select-Object -First 1
Add-Info 'Total Installed RAM' (Format-GB $cs.TotalPhysicalMemory)
Add-Info 'Physical Slots' $memoryArray.MemoryDevices
Add-Info 'Installed Modules' $ramModules.Count
for ($i = 0; $i -lt $ramModules.Count; $i++) {
    $ram = $ramModules[$i]
    Add-Report ''
    Add-Report ('RAM Module {0}' -f ($i + 1)) Green
    Add-Info 'Location' (('{0} {1}' -f $ram.BankLabel, $ram.DeviceLocator).Trim())
    Add-Info 'Capacity' (Format-GB $ram.Capacity)
    Add-Info 'Memory Type' (Get-MemoryTypeName ([int]$ram.SMBIOSMemoryType))
    Add-Info 'Speed / Configured' ('{0} / {1} MHz' -f (Get-DisplayValue $ram.Speed '?'), (Get-DisplayValue $ram.ConfiguredClockSpeed '?'))
    Add-Info 'Manufacturer' $ram.Manufacturer
    Add-Info 'Part Number' $ram.PartNumber
    Add-Info 'Serial Number' $ram.SerialNumber
}

Add-Section '7. PHYSICAL DISKS'
$diskDrives = @(Get-CimSafe Win32_DiskDrive | Sort-Object Index)
$storageDisks = @(Get-CimSafe MSFT_PhysicalDisk 'root/Microsoft/Windows/Storage')
if ($diskDrives.Count -eq 0) { Add-Report 'Maklumat disk fizikal tidak tersedia.' Yellow }
for ($i = 0; $i -lt $diskDrives.Count; $i++) {
    $disk = $diskDrives[$i]
    $storage = $storageDisks | Where-Object {
        $_.FriendlyName -eq $disk.Model -or
        ([string]$disk.Model).Contains([string]$_.FriendlyName) -or
        ([string]$_.FriendlyName).Contains([string]$disk.Model)
    } | Select-Object -First 1
    Add-Report ('Disk {0}' -f ($i + 1)) Green
    Add-Info 'Model' $disk.Model
    Add-Info 'Serial Number' $disk.SerialNumber
    Add-Info 'Size' (Format-GB $disk.Size)
    Add-Info 'Media Type' (Get-MediaTypeName ([int]$storage.MediaType) ([string]$disk.MediaType))
    $bus = if ($storage) { Get-BusTypeName ([int]$storage.BusType) } else { Get-DisplayValue $disk.InterfaceType }
    Add-Info 'Bus / Interface' $bus
    Add-Info 'Health' $(if ($storage) { Get-HealthName $storage.HealthStatus } else { Get-DisplayValue $disk.Status })
    Add-Info 'Firmware Revision' $disk.FirmwareRevision
    if ($i -lt ($diskDrives.Count - 1)) { Add-Report '' }
}

Add-Section '8. DRIVES / PARTITIONS'
$logicalDisks = @(Get-CimSafe Win32_LogicalDisk -Filter 'DriveType=3' | Sort-Object DeviceID)
if ($logicalDisks.Count -eq 0) { Add-Report 'Maklumat drive tidak tersedia.' Yellow }
foreach ($drive in $logicalDisks) {
    $used = 0
    $freePercent = 'Tidak tersedia'
    try {
        if ([double]$drive.Size -gt 0) {
            $used = [double]$drive.Size - [double]$drive.FreeSpace
            $freePercent = '{0:N1}%' -f (([double]$drive.FreeSpace / [double]$drive.Size) * 100)
        }
    }
    catch {}
    Add-Report ('Drive {0}  [{1}]' -f $drive.DeviceID, (Get-DisplayValue $drive.VolumeName 'No Label')) Green
    Add-Info 'File System' $drive.FileSystem
    Add-Info 'Total / Used / Free' ('{0} / {1} / {2}' -f (Format-GB $drive.Size), (Format-GB $used), (Format-GB $drive.FreeSpace))
    Add-Info 'Free Percentage' $freePercent
    Add-Report ''
}

Add-Section '9. ACTIVE NETWORK ADAPTERS'
$netConfigs = @(Get-CimSafe Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True')
$netAdapters = @(Get-CimSafe Win32_NetworkAdapter)
if ($netConfigs.Count -eq 0) { Add-Report 'Tiada network adapter aktif dijumpai.' Yellow }
for ($i = 0; $i -lt $netConfigs.Count; $i++) {
    $cfg = $netConfigs[$i]
    $adapter = $netAdapters | Where-Object { $_.Index -eq $cfg.Index } | Select-Object -First 1
    $ipv4 = @($cfg.IPAddress | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' }) -join ', '
    Add-Report ('Adapter {0}' -f ($i + 1)) Green
    Add-Info 'Name' $cfg.Description
    Add-Info 'MAC Address' $cfg.MACAddress
    Add-Info 'IPv4 Address' $ipv4
    Add-Info 'Gateway' (@($cfg.DefaultIPGateway) -join ', ')
    Add-Info 'DNS Servers' (@($cfg.DNSServerSearchOrder) -join ', ')
    Add-Info 'DHCP Enabled' $cfg.DHCPEnabled
    Add-Info 'Link Speed' (Format-Speed $adapter.Speed)
    if ($i -lt ($netConfigs.Count - 1)) { Add-Report '' }
}

Add-Section '10. BATTERY (LAPTOP, JIKA ADA)'
$batteries = @(Get-CimSafe Win32_Battery)
if ($batteries.Count -eq 0) {
    Add-Report 'Tiada bateri dikesan atau komputer ialah desktop.' DarkGray
}
else {
    $staticBattery = Get-CimSafe BatteryStaticData 'root/wmi' | Select-Object -First 1
    $fullBattery = Get-CimSafe BatteryFullChargedCapacity 'root/wmi' | Select-Object -First 1
    for ($i = 0; $i -lt $batteries.Count; $i++) {
        $battery = $batteries[$i]
        Add-Report ('Battery {0}' -f ($i + 1)) Green
        Add-Info 'Name' $battery.Name
        Add-Info 'Charge Remaining' $(if ($null -ne $battery.EstimatedChargeRemaining) { '{0}%' -f $battery.EstimatedChargeRemaining } else { 'Tidak tersedia' })
        Add-Info 'Estimated Runtime' $(if ($battery.EstimatedRunTime -and $battery.EstimatedRunTime -lt 71582788) { '{0} minutes' -f $battery.EstimatedRunTime } else { 'Tidak tersedia' })
        if ($staticBattery -and $fullBattery -and [double]$staticBattery.DesignedCapacity -gt 0) {
            $health = ([double]$fullBattery.FullChargedCapacity / [double]$staticBattery.DesignedCapacity) * 100
            Add-Info 'Design Capacity' ('{0:N0} mWh' -f [double]$staticBattery.DesignedCapacity)
            Add-Info 'Full Charge Capacity' ('{0:N0} mWh' -f [double]$fullBattery.FullChargedCapacity)
            Add-Info 'Estimated Battery Health' ('{0:N1}%' -f $health)
        }
    }
}

Add-Section 'REPORT'
$desktop = [Environment]::GetFolderPath('Desktop')
$reportPath = Join-Path $desktop ('AZOBSS_System_Info_{0}_{1}.txt' -f $env:COMPUTERNAME, (Get-Date -Format 'yyyyMMdd_HHmmss'))
try {
    $Report | Set-Content -LiteralPath $reportPath -Encoding UTF8 -Force
    Add-Report ('Report disimpan di: {0}' -f $reportPath) Green
}
catch {
    Add-Report ('Gagal menyimpan report: {0}' -f $_.Exception.Message) Red
}

# ================= PRIVATE CLOUD REPORT =================
$reportId = [Guid]::NewGuid().ToString()
$batteryMetadata = @($batteries | ForEach-Object {
    @{ name = [string]$_.Name; manufacturer = [string]$_.Manufacturer; serial = '' }
})
$deviceModel = [string]$cs.Model
$productModel = [string]$product.Version
if (-not [string]::IsNullOrWhiteSpace($productModel) -and $productModel -notmatch '^(ThinkPad|ThinkCentre|System|To Be Filled|Default|Not Specified|Type1ProductConfigId)$' -and -not $deviceModel.Contains($productModel)) {
    $deviceModel = ($deviceModel + ' ' + $productModel).Trim()
}
$serialNumber = [string]$bios.SerialNumber
if ([string]::IsNullOrWhiteSpace($serialNumber)) { $serialNumber = [string]$enclosure.SerialNumber }
$upload = @{
    id = $reportId
    report = ($Report -join [Environment]::NewLine)
    manufacturer = [string]$cs.Manufacturer
    model = $deviceModel
    serial = $serialNumber
    batteries = $batteryMetadata
}
$uploaded = $false
if ($cloudConsent) {
    $uploadBytes = [System.Text.Encoding]::UTF8.GetBytes(($upload | ConvertTo-Json -Depth 5 -Compress))
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            $result = Invoke-RestMethod -Uri 'https://azobss-backend.onrender.com/api/pc-diagnostics' -Method Post -ContentType 'application/json; charset=utf-8' -Body $uploadBytes -TimeoutSec 65 -ErrorAction Stop
            if ($result.ok -ne $true -or $result.id -ne $reportId) { throw 'Pengesahan simpanan tidak diterima.' }
            $uploaded = $true
            break
        }
        catch {
            if ($attempt -lt 2) { Start-Sleep -Seconds 3 }
        }
    }
    if ($uploaded) {
        Add-Report ('Laporan disimpan dalam Cloudflare AZOBSS. ID: {0}' -f $reportId) Green
    } else {
        Add-Report 'Muat naik Cloudflare gagal. Salinan TXT tempatan masih tersedia untuk dihantar sendiri kepada AZOBSS.' Yellow
    }
}

# ================= OPTIONAL WHATSAPP =================
$answer = Read-Host 'Buka WhatsApp AZOBSS 01135600723 dengan ringkasan laporan? [Y/N]'
if ($answer -match '^(?i:y|ya|yes)$') {
    $summary = @(
        'AZOBSS PC Diagnostic',
        ('Jenama: {0}' -f (Get-DisplayValue $cs.Manufacturer)),
        ('Model: {0}' -f (Get-DisplayValue $deviceModel)),
        ('Serial Number: {0}' -f (Get-DisplayValue $serialNumber)),
        ('Battery Name: {0}' -f (Get-DisplayValue (($batteryMetadata | ForEach-Object { $_.name }) -join ', '))),
        $(if ($uploaded) { 'Report ID: ' + $reportId } else { 'Laporan TXT disimpan pada PC.' })
    ) -join [Environment]::NewLine
    try { Set-Clipboard -Value $summary -ErrorAction Stop } catch {}
    try { Start-Process ('https://wa.me/601135600723?text=' + [Uri]::EscapeDataString($summary)) -ErrorAction Stop }
    catch { Add-Report 'WhatsApp tidak dapat dibuka. Ringkasan tersedia di Clipboard jika disokong.' Yellow }
}
Add-Report ('Salinan report: {0}' -f $reportPath) DarkGray
Add-Report 'Tekan Enter untuk tutup.' DarkGray
[void][Console]::ReadLine()
