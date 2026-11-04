"""Read public official catalogues, preserving exact in-stock variant identity."""
from pathlib import Path
import concurrent.futures,datetime,hashlib,json,re,time,os,tempfile
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2];WORK=Path(os.environ.get('AZOBSS_CATALOG_WORK',Path(tempfile.gettempdir())/'azobss-pc-storefront-1512'));WORK.mkdir(parents=True,exist_ok=True)
SOURCES=[('dotatech','DOTATECH','https://www.dotatech.com.my'),('emarque','EMARQUE','https://emarque.co'),('all-it','ALL IT Hypermarket','https://www.allithypermarket.com.my'),('brightstar','Brightstar Computer','https://brightstarcomp.com')]
NOW=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
def category(title,kind):
    def component(label):
        h=label.lower().strip()
        groups=[
            (r'cooler|cooling|case fan|casing fan|chassis fan','Cooling'),
            (r'motherboard|mainboard','Motherboard'),
            (r'graphics? card|\bgpu\b|\bvga\b|geforce|radeon|\brtx\s*\d{4}|\brx\s*\d{3,4}','GPU'),
            (r'\bram\b|memory|so[- ]?dimm|sodimm|u-dimm|ddr[345]','RAM'),
            (r'\bssd\b|\bnvme\b|solid state','SSD'),
            (r'\bhdd\b|hard drive|hard disk','Hard Drive'),
            (r'power supply|\bpsu\b','Power Supply'),
            (r'\bcasing\b|chassis|\bcase\b','Casing'),
            (r'monitor|\blcd\b|display','Monitor'),
            (r'keyboard|keybo','Keyboard'),
            (r'\bmouse\b|mice|mousepad','Mouse & Mousepad'),
            (r'headset|headphone|microphone|speaker|soundbar|heads|speak|earph|earbud','Audio'),
            (r'webcam|capture card','Webcam & Capture'),
            (r'router|network|ethernet|wifi|wi-fi|switch|access point|netca','Networking'),
            (r'usb hub|docking|\badapter\b|\bcable\b','Adapter & Cable'),
            (r'bag|backpack|sleeve|stand|holder|bracket|mount|charger|battery|power bank|powerbank|clamp|air purifier|accessor','Accessories'),
            (r'\bprocessor|\bcpu\b','CPU')]
        return next((cat for pattern,cat in groups if re.search(pattern,h)),None)
    # Prefer the supplier's specific department, e.g. Desktop Chassis is a case,
    # not a complete computer. CPU Cooler precedes CPU; Laptop RAM precedes Laptop.
    specific=component(kind)
    if specific:return specific,'hardware'
    h=title.lower()
    accessory=bool(re.search(r'\b(bag|backpack|sleeve|stand|holder|bracket|mount|docking|dock|adapter|charger|battery|power bank|powerbank|cooling pad|laptop cooler)\b|so[- ]?dimm|(?:laptop|notebook)\s+(?:ram|memory)|(?:ram|memory|ssd|hdd|hard drive|hard disk|cable).{0,100}\b(?:for|compatible).{0,35}\b(?:laptop|notebook|desktop)|\b(?:external|internal|portable)\b.{0,35}\b(?:ssd|hdd|hard drive|hard disk)\b',h))
    if accessory:return component(title) or 'Accessories','hardware'
    if re.search(r'\b(laptop|notebook|noteb|macbook|vivobook|zenbook|ideapad|thinkpad|probook|elitebook|chromebook)\b',h+' '+kind.lower()):return 'Laptop','laptop'
    if re.search(r'gaming pc|pc gaming package|mini pc|all.in.one pc|prebuilt|pre.build|pc package|pc set|custom pc|barebone (?:mini )?pc',h):return 'Desktop PC','desktop'
    title_component=component(title)
    if title_component and re.search(r'\b(keyboard|mouse|speaker|chassis|case|clamp|air purifier|desktop memory|desktop cpu|desktop processor)\b',h):return title_component,'hardware'
    if re.search(r'\b(desktop|workstation|computer system)\b',kind,re.I):return 'Desktop PC','desktop'
    specific=component(title)
    if specific:return specific,'hardware'
    if re.search(r'\b(desktop|workstation)\b',h):return 'Desktop PC','desktop'
    return '',''

def clean_name(s):
    s=re.sub(r'\[(?:ALL IT EXCLUSIVE|READY STOCK|PRE.?ORDER|PROMO)[^]]*\]','',s,flags=re.I)
    s=re.sub(r'\b(?:DOTATECH|EMARQUE|BRIGHTSTAR COMPUTER|ALL IT HYPERMARKET)\b','',s,flags=re.I)
    return re.sub(r'\s+',' ',s).strip(' -|')[:240]
def run(source):
    sid,name,base=source;session=requests.Session();session.trust_env=False
    session.headers.update({'User-Agent':'Mozilla/5.0 AZOBSSCatalog/1512','Accept':'application/json'})
    directory=WORK/sid;directory.mkdir(exist_ok=True);products=[];status={'id':sid,'name':name,'url':base,'pages':0,'complete':False,'errors':[]}
    for page in range(1,81):
        url=f'{base}/products.json?limit=250&page={page}'
        cached=directory/f'page-{page}.json'
        try:
            if cached.exists() and time.time()-cached.stat().st_mtime<86400:data=json.loads(cached.read_text())
            else:
                for attempt in range(3):
                    response=session.get(url,timeout=(10,35))
                    if response.status_code!=429:break
                    delay=max(30,min(120,int(response.headers.get('Retry-After','45'))))
                    print(f'{sid}: rate limit; waiting {delay}s',flush=True);time.sleep(delay)
                response.raise_for_status();data=response.json();cached.write_text(json.dumps(data))
            rows=data.get('products',[]);assert isinstance(rows,list)
            products.extend(rows);status['pages']=page
            if len(rows)<250:status['complete']=True;break
            time.sleep(2)
        except Exception as e:status['errors'].append(str(e));break
    status['sourceProducts']=len(products);out=[]
    for p in products:
        cat,kind=category(p.get('title',''),p.get('product_type',''))
        if not kind:continue
        title=clean_name(p.get('title',''));images=p.get('images') or []
        desc=BeautifulSoup(p.get('body_html') or '', 'html.parser').get_text('\n',strip=True)
        specs=[re.sub(r'\s+',' ',x).strip() for x in desc.splitlines()]
        specs=[x[:240] for x in specs if 4<len(x)<250 and not re.search(r'https?://|www\.|\bRM\s*\d|warranty claim|all it|dotatech|emarque|brightstar|free gift|purchase|payment|installment|follow us|penting|important|pelanggan|rakaman|bungkusan|unboxing|warranty|notice|customer|parcel|shipping|return policy|tiktok|facebook|instagram|whatsapp|contact us|tuntutan|kerosakan|kehilangan|kerjasama|dihargai|faulty|damage claim|recording|cooperation|[\u4e00-\u9fff]|\[\s*(?:description|specifications)\s*\]',x,re.I)][:14]
        for variant in p.get('variants') or []:
            try:price=float(variant.get('price') or 0)
            except (TypeError,ValueError):continue
            if variant.get('available') is not True or not 20<=price<=100000:continue
            vtitle=str(variant.get('title') or '').strip();label=title if vtitle.lower() in ('','default title') else f'{title} â€” {vtitle}'
            vid=str(variant.get('id'));url=f'{base}/products/{p["handle"]}?variant={vid}'
            image_id=variant.get('featured_image',{}).get('id') if isinstance(variant.get('featured_image'),dict) else variant.get('image_id')
            specific=[i for i in images if i.get('id')==image_id or variant['id'] in (i.get('variant_ids') or [])]
            eligible=specific or [i for i in images if not i.get('variant_ids')]
            urls=[i.get('src') for i in eligible]
            urls=list(dict.fromkeys(u for u in urls if isinstance(u,str) and u.startswith('https://')))
            if not urls:continue
            ident=f'{sid}-v{vid}'
            out.append(dict(id=ident,type=kind,category=cat,name=label[:300],productTitle=title,
                sourceName=name,storeId=sid,sourceUrl=url,sourceProvider='shopify',sourceVerified=True,
                specVerified=True,mediaVerified=True,sourceMatch=[p.get('title','')],specs=[f'Model: {title}',*([f'Pilihan: {vtitle}'] if vtitle.lower() not in ('','default title') else []),*specs],
                snapshotPrice=price,snapshotPriceClear=True,snapshotCheckedAt=NOW,sourceCheckedAt=NOW,
                variantId=vid,sku=str(variant.get('sku') or ''),importedCatalog=True,
                imageCandidates=urls[:8],image='',stock='check',availability='unknown',requiresConfirmation=True))
    status['eligibleVariants']=len(out);print(json.dumps(status),flush=True);return out,status
if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,SOURCES))
    rows=[r for products,_ in results for r in products];report={'version':1512,'checkedAt':NOW,'sources':[s for _,s in results],'products':rows}
    (WORK/'import.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Eligible exact variants:',len(rows),flush=True)
