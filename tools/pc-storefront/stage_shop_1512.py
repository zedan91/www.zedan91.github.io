"""Stage only exact local-photo products and public selling-price snapshots."""
from pathlib import Path
import collections,datetime,hashlib,json,math,re
from import_shop_1512 import ROOT,WORK
SRC=ROOT
data=json.loads((WORK/'prepared.json').read_text(encoding='utf-8'));rows=data['products']
def selling(cost,kind,name=''):
    if kind not in ('laptop','desktop','pc-build') and not re.search(r'Mini Desktop PC.*Barebone$|Workstation PC$',name,re.I):
        extra=30 if cost<=50 else 50 if cost<=150 else 70 if cost<500 else 90 if cost<=700 else cost*.15
        return math.ceil(round(cost+extra,8)/5)*5
    rate=.15 if cost<=2500 else .12 if cost<=4000 else .10 if cost<=6000 else .09 if cost<=8000 else .08 if cost<=10000 else .07
    return math.ceil((cost+max(cost*rate,250 if kind in ('laptop','desktop','pc-build') else 150))/10)*10
def brand(name):
    matches=[(m.start(),b) for b in ['AVITA','HONOR','HUAWEI','CHUWI','ASUS','MSI','GIGABYTE','ASROCK','AMD','INTEL','CORSAIR','KINGSTON','LOGITECH','ACER','LENOVO','HP','DELL','APPLE','SAMSUNG','SEAGATE','WESTERN DIGITAL','TP-LINK','D-LINK','RAZER','STEELSERIES','THERMALTAKE','COOLER MASTER','NZXT','LIAN LI','FRACTAL','DEEPCOOL','FSP','SILVERSTONE','EDIFIER','SONY','HYPERX','ADATA','XPG','LEXAR','CRUCIAL','SANDISK','AOC','PHILIPS','BENQ','LG','VIEWSONIC','ZOTAC','PALIT','PNY','COLORFUL','SAPPHIRE','POWER COLOR','ILLEGEAR'] if (m:=re.search(r'\b'+re.escape(b)+r'\b',name,re.I))]
    if matches:return min(matches)[1]
    return 'LAIN-LAIN'
public=[]
for row in rows:
    assert row['localImageVerified'] and re.fullmatch(r'/PC-Build/images/shop/[a-f0-9]{24}\.webp',row['image'])
    assert (SRC/row['image'].lstrip('/')).is_file()
    row['brand']=brand(row['name']);row['requiresSupplierConfirmation']=True
    public.append(dict(id=row['id'],type=row['type'],category=row['category'],brand=row['brand'],name=row['name'],displayName=row.get('displayName',row['name']),
        price=selling(float(row['snapshotPrice']),row['type'],row.get('productTitle',row['name'])),priceStatus='snapshot',priceCheckedAt=row['snapshotCheckedAt'],
        specs=row['specs'],image=row['image'],localImageVerified=True,imagePolicy='local-locked',imageCrop='full-image',
        available=False,availability='unknown',requiresConfirmation=True))
report=dict(version=1512,checkedAt=data['checkedAt'],products=rows,sources=data['sources'],
    imagePolicy='Exact official photo; OCR rejects retailer/price artwork; no watermark removal')
(SRC/'lib/data').mkdir(exist_ok=True)
(SRC/'lib/data/pc-shop-catalog-v1512.json').write_text(json.dumps(report,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(SRC/'PC-Build/pc-shop-storefront-v1512.json').write_text(json.dumps(dict(version=1512,checkedAt=data['checkedAt'],products=public),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
summary=dict(version=1512,products=len(rows),categories=dict(collections.Counter(r['category'] for r in rows)),stores=dict(collections.Counter(r['storeId'] for r in rows)),images=len(set(r['image'] for r in rows)),sources=data['sources'])
(WORK/'v1512-Catalog-Summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='sources'}))
