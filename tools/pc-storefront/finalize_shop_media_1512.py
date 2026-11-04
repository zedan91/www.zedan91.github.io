"""Keep only published clean photos, and repair the original hardware map."""
from pathlib import Path
from urllib.parse import urlparse
import hashlib,json,re,requests
from vendor_shop_1512 import process_url,store_photo_allowed
from stage_shop_1512 import ROOT,SRC,WORK,selling

manifest=json.loads((SRC/'PC-Build/images/products/hardware-exact-v1505.json').read_text(encoding='utf-8'))
byid={};byname={};audit=[];session=requests.Session();session.trust_env=False
for p in manifest['items']:
    urls=list(p.get('urls') or []);source=p.get('sourceUrl','');store='all-it' if p['id'].startswith('allit-') else ''
    if '/products/' in source:
        try:
            response=session.get(source.split('?')[0].rstrip('/')+'.js',timeout=20);response.raise_for_status()
            urls += [u.get('src') if isinstance(u,dict) else u for u in response.json().get('images',[])]
        except Exception:pass
    result={}
    for url in dict.fromkeys(u for u in urls if isinstance(u,str) and u.startswith('https://')):
        result=process_url(url)
        if store_photo_allowed(result,store):break
    else:result={'ok':False,'reason':'no clean source photo'}
    if result.get('ok'):
        byid[p['id']]=result['local'];byname[re.sub(r'[^a-z0-9]+',' ',p['name'].lower()).strip()]=result['local']
    audit.append(dict(id=p['id'],name=p['name'],**result))
obj=dict(version='1512',policy='exact-local-ocr-reviewed-source-photos',ready=bool(byid),complete=len(byid)==14,expected=14,downloaded=len(byid),byId=byid,byName=byname)
(SRC/'PC-Build/images/products/local-hardware-map-v1505.js').write_text('window.AZOBSS_PC_LOCAL_HARDWARE_IMAGES='+json.dumps(obj,separators=(',',':'))+';\n')
(WORK/'v1512-Original-Hardware-Photos.json').write_text(json.dumps(audit,indent=2)+'\n')
public_path=SRC/'PC-Build/pc-shop-storefront-v1512.json';public=json.loads(public_path.read_text(encoding='utf-8'))
old=json.loads((SRC/'PC-Build/pc-shop-products-v1487.json').read_text(encoding='utf-8'))['products']
for p in old:
    if p['id'] not in byid:continue
    public['products'].append(dict(id=p['id'],type='hardware',category='Casing' if p['category']=='Case' else p['category'],name=p['name'],price=selling(p['snapshotPrice'],'hardware'),priceStatus='snapshot',priceCheckedAt=p.get('snapshotCheckedAt') or p.get('sourceCheckedAt'),specs=p['specs'],image=byid[p['id']],localImageVerified=True,imagePolicy='local-locked',available=False,availability='unknown',requiresConfirmation=True))
public_path.write_text(json.dumps(public,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
rows=json.loads((WORK/'prepared.json').read_text(encoding='utf-8'))['products']
def norm(u):
    p=urlparse(u);return p._replace(netloc=p.netloc.removeprefix('www.'),query='',fragment='').geturl()
photos={norm(p['sourceUrl']):p['image'] for p in rows};legacy_ids={};legacy_urls={}
for file in [SRC/'PC-Build/pc-build-data.json',*list((SRC/'PC-Build/retailers').glob('*.json')),*list((SRC/'PC-Build/catalog/v1496').glob('*.json'))]:
    data=json.loads(file.read_text(encoding='utf-8'))
    for p in data.get('products',data.get('builds',[])):
        url=p.get('sourceUrl') or p.get('productUrl') or '';photo=photos.get(norm(url))
        if photo:
            if p.get('id'):legacy_ids[p['id']]=photo
            legacy_urls[url]=photo
(SRC/'assets/js/azobss-pc-build-images-v1512.js').write_text('(function(){const m=window.AZOBSS_PC_LOCAL_IMAGES||{};m.byId={...m.byId,...'+json.dumps(legacy_ids,separators=(',',':'))+'};m.byUrl={...m.byUrl,...'+json.dumps(legacy_urls,separators=(',',':'))+'};m.ready=true;m.enforceLocal=true;window.AZOBSS_PC_LOCAL_IMAGES=m;})();\n')
keep={p['image'] for p in public['products']}|set(legacy_ids.values())|set(legacy_urls.values())
folder=(SRC/'PC-Build/images/shop').resolve();removed=0
for file in folder.glob('*.webp'):
    assert file.resolve().parent==folder
    if '/PC-Build/images/shop/'+file.name not in keep:file.unlink();removed+=1
record=dict(products=len(public['products']),photos=len(keep),unused_generated_photos_removed=removed,
    full_canvas_preserved=True,watermarks_erased=False,source_photos_ocr_screened=True,retailer_template_rejected=True,
    assets=[dict(path=p,sha256=hashlib.sha256((SRC/p.lstrip('/')).read_bytes()).hexdigest()) for p in sorted(keep)])
(WORK/'v1512-Published-Photo-Manifest.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:v for k,v in record.items() if k!='assets'}))
