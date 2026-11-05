"""Select clean source photos; reject retailer/price artwork, never erase it."""
from pathlib import Path
import asyncio,concurrent.futures,datetime,hashlib,io,json,threading,time
from urllib.parse import urlparse,urlunparse,parse_qsl,urlencode
import requests
from PIL import Image
from check_image_ocr_1512 import inspect_image,BAD

from import_shop_1512 import ROOT,WORK
DEST=ROOT/'PC-Build/images/shop';DEST.mkdir(exist_ok=True)
CACHE=WORK/'image-audit';CACHE.mkdir(exist_ok=True)
lock=threading.Lock();url_locks={};guard=threading.Lock();counts={'done':0,'clean':0,'rejected':0}
def store_photo_allowed(photo,store):
    if not photo.get('ok'):return False
    if store=='emarque':
        image=Image.open(ROOT/photo['local'].lstrip('/')).convert('RGB').resize((40,40))
        edge=[image.getpixel((x,y)) for y in range(40) for x in range(40) if x<5 or x>34 or y<5 or y>34]
        # Reject the known dark/grey retailer-logo frame; never erase its mark.
        return sum(min(pixel)>239 for pixel in edge)/len(edge)>.965
    if store!='all-it':return True
    # ALL IT uses a pale-cyan frame with a small stylised retailer logo that
    # OCR can miss. Conservatively choose another gallery photo, never crop it.
    image=Image.open(ROOT/photo['local'].lstrip('/')).convert('RGB');image.thumbnail((100,100))
    for band in (image.crop((0,0,image.width,max(1,image.height//8))),image.crop((0,image.height*7//8,image.width,image.height))):
        pixels=list(band.getdata());cyan=sum(g>r+10 and b>r+15 and g>170 and b>185 for r,g,b in pixels)
        if cyan/max(1,len(pixels))>.06:return False
    return True
def process_url(url):
    key=hashlib.sha256(url.encode()).hexdigest()[:24];meta=CACHE/(key+'.json');dest=DEST/(key+'.webp')
    with guard: single=url_locks.setdefault(key,threading.Lock())
    with single:
        if meta.exists():
            record=json.loads(meta.read_text(encoding='utf-8'))
            if record.get('ok') and BAD.search(record.get('ocr','')):
                record.update(ok=False,reason='retailer_or_price_text',matches=BAD.findall(record['ocr']));meta.write_text(json.dumps(record,ensure_ascii=False),encoding='utf-8')
            if not record.get('ok') or dest.exists():return record
        s=requests.Session();s.trust_env=False
        # CDN image sizing reduces transfer; preserve the entire uncropped photo.
        u=urlparse(url);query=dict(parse_qsl(u.query));query['width']='1000';fetch_url=urlunparse(u._replace(query=urlencode(query))) if 'shopify.com' in u.netloc or '/cdn/shop/' in u.path else url
        try:
            response=s.get(fetch_url,headers={'User-Agent':'Mozilla/5.0'},timeout=(10,30));response.raise_for_status()
            if len(response.content)>15_000_000:raise ValueError('oversized image')
            with lock:image,ocr,bad=asyncio.run(inspect_image(response.content))
            if bad:record=dict(ok=False,url=url,reason='retailer_or_price_text',matches=bad,ocr=ocr)
            else:
                image.thumbnail((640,640));image.save(dest,'WEBP',quality=82,method=4)
                record=dict(ok=True,url=url,local='/PC-Build/images/shop/'+dest.name,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),source_sha256=hashlib.sha256(response.content).hexdigest(),width=image.width,height=image.height,ocr=ocr,full_image_preserved=True,watermark_removed=False)
            meta.write_text(json.dumps(record,ensure_ascii=False),encoding='utf-8');return record
        except Exception as e:return dict(ok=False,url=url,reason=str(e))
def product_photo(p):
    for url in p.get('imageCandidates',[])[:8]:
        result=process_url(url)
        if store_photo_allowed(result,p.get('storeId')):break
    else:result=dict(ok=False,reason='no_clean_verified_source_photo')
    with guard:
        counts['done']+=1;counts['clean' if result.get('ok') else 'rejected']+=1
        if counts['done']%100==0:print(json.dumps(counts),flush=True)
    return p,result
def main():
    data=json.loads((WORK/'import.json').read_text(encoding='utf-8'));rows=data['products']
    extra=WORK/'presta.json'
    if extra.exists():
        more=json.loads(extra.read_text(encoding='utf-8'));rows=list({p['id']:p for p in [*rows,*more['products']]}.values());data['sources']=[*data['sources'],*more.get('sources',[])]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(product_photo,rows))
    accepted=[];audit=[]
    for p,photo in results:
        audit.append(dict(id=p['id'],name=p['name'],storeId=p['storeId'],**photo))
        if not photo.get('ok'):continue
        p={**p,'image':photo['local'],'localImageVerified':True,'imageAudit':'ocr-clean-source-photo','imageType':'exact-product-photo-local','imageCrop':'full-image'}
        p.pop('imageCandidates',None);accepted.append(p)
    report={**data,'products':accepted,'eligibleVariants':len(rows),'publishedVariants':len(accepted),'quarantinedVariants':len(rows)-len(accepted)}
    (WORK/'prepared.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (WORK/'v1512-Image-Audit.json').write_text(json.dumps(dict(checkedAt=data['checkedAt'],scannedVariants=len(rows),accepted=len(accepted),rejected=len(rows)-len(accepted),method='Windows offline OCR plus exact-source photo selection; no text removal',images=audit),ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(counts),flush=True)
if __name__=='__main__':main()
