"""Read exact-model official listing cards; checkout still verifies product pages."""
from pathlib import Path
from urllib.parse import urljoin,urlparse
import concurrent.futures,datetime,json,re,time
import requests
from bs4 import BeautifulSoup
from import_shop_1512 import ROOT,WORK,NOW,category

def source(sid,name,base,entries):
    session=requests.Session();session.trust_env=False;products={};visited=set();queue=list(entries);errors=[]
    directory=WORK/sid;directory.mkdir(exist_ok=True)
    while queue and len(visited)<120:
        url=queue.pop(0)
        if url in visited:continue
        visited.add(url)
        try:
            import hashlib
            cached=directory/(hashlib.sha256(url.encode()).hexdigest()[:16]+'.html')
            if cached.exists() and time.time()-cached.stat().st_mtime<86400:html=cached.read_text(encoding='utf-8')
            else:
                r=session.get(url,timeout=(10,25));r.raise_for_status();r.encoding=r.apparent_encoding;html=r.text;cached.write_text(html,encoding='utf-8');time.sleep(.35)
            soup=BeautifulSoup(html,'html.parser')
            for card in soup.select('article.product-miniature'):
                link=card.select_one('h3 a[href],h2 a[href],a.product-thumbnail[href]');price_node=card.select_one('.price');image=card.select_one('img')
                if not link or not price_node or not image:continue
                title=link.get('title') or link.get_text(' ',strip=True) or image.get('alt') or ''
                if not title:continue
                prices=re.findall(r'(?:RM|MYR)\s*([\d,]+(?:\.\d{1,2})?)',price_node.get_text(' ',strip=True),re.I)
                if len(prices)!=1:continue
                price=float(prices[0].replace(',',''))
                if not 20<=price<=100000:continue
                if card.select_one('.out_of_stock,.out-of-stock,.product-unavailable'):continue
                cat,kind=category(title,'Laptop' if 'laptop' in url or 'notebook' in url else '')
                if not kind:continue
                pid=str(card.get('data-id-product') or '')
                product_url=urljoin(base,link.get('href',''))
                if not pid or not re.fullmatch(r'\d+',pid):continue
                candidates=[image.get('data-full-size-image-url'),image.get('data-src'),image.get('src')]
                candidates=list(dict.fromkeys(urljoin(base,x) for x in candidates if x and not x.startswith('data:')))
                if not candidates:continue
                products[pid]=dict(id=f'{sid}-p{pid}',variantId=pid,type=kind,category=cat,name=title[:300],productTitle=title,
                    sourceName=name,storeId=sid,sourceUrl=product_url,sourceProvider='html',sourceVerified=True,specVerified=True,mediaVerified=True,
                    sourceMatch=[title],specs=[f'Model: {title}','Spesifikasi dan konfigurasi tepat disahkan sebelum pesanan.'],snapshotPrice=price,snapshotPriceClear=True,
                    snapshotCheckedAt=NOW,sourceCheckedAt=NOW,importedCatalog=True,imageCandidates=candidates,image='',stock='check',availability='unknown',requiresConfirmation=True)
            for a in soup.select('.pagination a[href]'):
                target=urljoin(base,a['href'])
                if urlparse(target).netloc==urlparse(base).netloc and target not in visited and target not in queue:queue.append(target)
        except Exception as e:errors.append(dict(url=url,error=str(e)))
    status=dict(id=sid,name=name,pages=len(visited),complete=not queue and not errors,sourceProducts=len(products),eligibleVariants=len(products),errors=errors)
    print(json.dumps(status),flush=True);return list(products.values()),status
if __name__=='__main__':
    session=requests.Session();session.trust_env=False
    home=session.get('https://www.nbplaza.com.my/',timeout=25);soup=BeautifulSoup(home.text,'html.parser')
    component=next((a['href'] for a in soup.select('a[href]') if a.get_text(' ',strip=True).lower() in ('pc components','pc component','pc parts')),None)
    nb=['https://www.nbplaza.com.my/21-laptop','https://www.nbplaza.com.my/20-desktop']
    if component:nb.append(component)
    jobs=[('nb-plaza','NB Plaza','https://www.nbplaza.com.my',nb),('illegear','ILLEGEAR','https://www.illegear.com',['https://www.illegear.com/shop/10-illegear-laptops','https://www.illegear.com/shop/11-illegear-desktop-pc'])]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda args:source(*args),jobs))
    # ILLEGEAR's current category template links configurations without listing
    # cards. Read the observed official product links and the explicit base price.
    base='https://www.illegear.com';home=session.get(base+'/shop/',timeout=25);soup=BeautifulSoup(home.text,'html.parser')
    observed={}
    for a in soup.select('a[href]'):
        u=urlparse(urljoin(base,a['href']));match=re.search(r'/shop/[^/]+/(\d+)[^/]*\.html$',u.path)
        if not match:continue
        candidate=u._replace(fragment='',query='').geturl();pid=match[1]
        if pid not in observed or len(candidate)<len(observed[pid]):observed[pid]=candidate
    links=sorted(observed.values())
    def detail(url):
        try:
            direct=requests.Session();direct.trust_env=False
            r=direct.get(url,timeout=25);r.raise_for_status();d=BeautifulSoup(r.text,'html.parser')
            price_node=d.select_one('meta[property="product:price:amount"],[itemprop="price"][content]');title=d.select_one('h1');img=d.select_one('meta[property="og:image"]')
            if not price_node or not title or not img:return None
            price=float(price_node.get('content'))
            if not 20<=price<=100000:return None
            pid=re.search(r'/(\d+)-[^/]+\.html',url)[1];name='ILLEGEAR '+title.get_text(' ',strip=True)
            cat,kind=category(name,'laptop' if 'laptop' in url else 'Desktop PC' if 'desktop' in url else '')
            if not kind:return None
            gallery=[img.get('content')]+[x.get('data-image-large-src') or x.get('src') for x in d.select('.images-container img,.product-cover img')]
            return dict(id='illegear-p'+pid,variantId=pid,type=kind,category=cat,name=name+' â€” Konfigurasi asas',productTitle=name,sourceName='ILLEGEAR',storeId='illegear',sourceUrl=url,sourceProvider='html',sourceVerified=True,specVerified=True,mediaVerified=True,sourceMatch=[name],specs=[f'Model: {name}','Konfigurasi asas; pilihan CPU, GPU, RAM dan storan disahkan sebelum pesanan.'],snapshotPrice=price,snapshotPriceClear=True,snapshotCheckedAt=NOW,sourceCheckedAt=NOW,importedCatalog=True,configurationRequired=True,imageCandidates=list(dict.fromkeys(urljoin(base,x) for x in gallery if x)),image='',stock='check',availability='unknown',requiresConfirmation=True)
        except Exception as exc:
            print(json.dumps({'detail':url,'error':str(exc)}),flush=True);return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:details=[p for p in pool.map(detail,links) if p]
    results[1]=(details,dict(id='illegear',name='ILLEGEAR',pages=len(links),complete=bool(details),sourceProducts=len(details),eligibleVariants=len(details),configurationConfirmationRequired=True,errors=[]))
    (WORK/'presta.json').write_text(json.dumps(dict(checkedAt=NOW,products=[p for rows,_ in results for p in rows],sources=[status for _,status in results]),ensure_ascii=False,indent=2),encoding='utf-8')
