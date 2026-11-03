#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, os, re, shutil, subprocess, sys, tempfile, urllib.request, urllib.parse

ROOT=Path(__file__).resolve().parents[1]
PROD=ROOT/'PC-Build/images/products'
MANIFEST=PROD/'hardware-exact-v1505.json'
MAP=PROD/'local-hardware-map-v1505.js'
REPORT=PROD/'hardware-vendor-report-v1505.json'
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36 AZOBSS-v1506'

def key(v):
    return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',str(v or '').lower())).strip()

def magic_ok(path):
    try:
        b=path.read_bytes()[:16]
        n=path.stat().st_size
    except Exception:
        return False
    if n < 5000: return False
    return b.startswith(b'\xff\xd8\xff') or b.startswith(b'\x89PNG\r\n\x1a\n') or b.startswith((b'GIF87a',b'GIF89a')) or (b[:4]==b'RIFF' and b[8:12]==b'WEBP')

def request_bytes(url, referer=''):
    h={'User-Agent':UA,'Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}
    if referer: h['Referer']=referer
    req=urllib.request.Request(url,headers=h)
    with urllib.request.urlopen(req,timeout=35) as r:
        return r.read()

def request_json(url, referer=''):
    h={'User-Agent':UA,'Accept':'application/json,text/javascript,*/*;q=0.8'}
    if referer: h['Referer']=referer
    req=urllib.request.Request(url,headers=h)
    with urllib.request.urlopen(req,timeout=30) as r:
        return json.loads(r.read().decode('utf-8','replace'))

def abs_img(v, base=''):
    if isinstance(v,dict): v=v.get('src') or v.get('url') or v.get('originalSrc') or ''
    v=str(v or '').strip()
    if not v:return ''
    if v.startswith('//'): return 'https:'+v
    return urllib.parse.urljoin(base,v)

def shopify_candidates(source):
    if 'allithypermarket.com.my/products/' not in source:return []
    out=[]
    for endpoint in (source.rstrip('/')+'.js', source.rstrip('/')+'.json'):
        try:
            d=request_json(endpoint,source)
        except Exception:
            continue
        # /products/handle.js usually returns product object; .json may wrap product
        p=d.get('product',d) if isinstance(d,dict) else {}
        for v in [p.get('featured_image')]:
            u=abs_img(v,source)
            if u: out.append(u)
        for v in (p.get('images') or []):
            u=abs_img(v,source)
            if u: out.append(u)
        for v in (p.get('media') or []):
            if isinstance(v,dict):
                u=abs_img(v.get('preview_image') or v.get('src'),source)
                if u: out.append(u)
    # de-dupe preserve order
    seen=set(); return [u for u in out if not (u in seen or seen.add(u))]

def curl_download(url,tmp,referer=''):
    cmd=['curl','-L','--fail','--retry','2','--connect-timeout','20','--max-time','60','-A',UA,'-o',str(tmp)]
    if referer: cmd += ['-e',referer]
    cmd += [url]
    return subprocess.run(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0

def download_one(item,tmp):
    source=str(item.get('sourceUrl') or '')
    candidates=[]
    try:candidates.extend(shopify_candidates(source))
    except Exception:pass
    candidates.extend(item.get('urls') or [])
    # unique
    seen=set(); candidates=[u for u in candidates if u and not (u in seen or seen.add(u))]
    errors=[]
    for url in candidates:
        try:
            tmp.unlink(missing_ok=True)
            try:
                data=request_bytes(url,source)
                tmp.write_bytes(data)
            except Exception as e:
                errors.append(f'urllib {url}: {e}')
                tmp.unlink(missing_ok=True)
                if not curl_download(url,tmp,source):
                    errors.append(f'curl {url}: failed')
                    continue
            if magic_ok(tmp): return url,errors
            errors.append(f'invalid image {url}')
        except Exception as e:
            errors.append(f'{url}: {e}')
    return '',errors

def main():
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    items=manifest.get('items') or []
    expected=int(manifest.get('expectedHardwareImages') or len(items))
    if len(items)!=expected:
        raise SystemExit(f'Manifest count mismatch: {len(items)} != {expected}')
    PROD.mkdir(parents=True,exist_ok=True)
    tmpdir=Path(tempfile.mkdtemp(prefix='azobss-v1506-'))
    rows=[]; staged=[]
    try:
        for i,item in enumerate(items,1):
            errs=[]
            dst=PROD/item['filename']
            # Existing valid exact file is accepted.
            if magic_ok(dst):
                used='existing-local'
                ok=True
            else:
                tmp=tmpdir/item['filename']
                used,errs=download_one(item,tmp)
                ok=bool(used and magic_ok(tmp))
                if ok: staged.append((tmp,dst))
            row={'id':item['id'],'name':item['name'],'filename':item['filename'],'ok':ok,'sourceUsed':used if ok else ''}
            if not ok:
                row['attemptErrors']=errs[-8:]
            if ok:
                src=dst if dst.exists() and magic_ok(dst) else tmp
                row['bytes']=src.stat().st_size
                row['sha256']=hashlib.sha256(src.read_bytes()).hexdigest()
                print(f'[{i:02d}/{expected}] OK   {item["name"]}')
            else:
                row['error']='No verified exact image could be downloaded'
                print(f'[{i:02d}/{expected}] FAIL {item["name"]}')
            rows.append(row)
        good=[r for r in rows if r['ok']]
        # v1506: publish every verified local image. One failed CDN must not hide all good images.
        for src,dst in staged:
            dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst)
        good_ids={r['id'] for r in good}
        byid={}; byname={}
        for item in items:
            if item['id'] not in good_ids:
                continue
            local='/PC-Build/images/products/'+item['filename']
            byid[item['id']]=local
            byname[key(item['name'])]=local
        downloaded=len(good); missing=max(0,expected-downloaded); complete=(downloaded==expected)
        obj={'version':'1506','policy':'hardware-exact-local-only-github-vendored-resilient','ready':downloaded>0,'complete':complete,'expected':expected,'downloaded':downloaded,'missing':missing,'byId':byid,'byName':byname}
        MAP.write_text('window.AZOBSS_PC_LOCAL_HARDWARE_IMAGES='+json.dumps(obj,separators=(',',':'),ensure_ascii=False)+';\n',encoding='utf-8')
        REPORT.write_text(json.dumps({'version':'1506','complete':complete,'expected':expected,'downloaded':downloaded,'missing':missing,'items':rows},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        if complete:
            print(f'AZOBSS v1506 READY: {downloaded}/{expected} exact hardware images vendored locally.')
        else:
            print(f'AZOBSS v1506 PARTIAL READY: {downloaded}/{expected}; {missing} item(s) remain placeholder, verified images are published.')
        return 0 if downloaded>0 else 2
    finally:
        shutil.rmtree(tmpdir,ignore_errors=True)

if __name__=='__main__': sys.exit(main())
