"""Evidence-only title/specification presentation helpers for future imports."""
import re
from bs4 import BeautifulSoup
LABEL=re.compile(r'^(?:CPU(?: / Processor)?|Processor|Memory(?: Slot)?|RAM|Storage(?: Capability)?|Graphics?|Graphic Card|Operating System|Operation System|OS|Display|Screen|Power Supply|Battery|Capacity|Socket|Chipset|Speed|Frequency|Dimensions|Weight|Interface|Connectivity|Warranty)\s*:?$',re.I)
TECH=re.compile(r'processor|\bcpu\b|memory|\bram\b|storage|graphics?|operating|operation system|display|screen|battery|power|capacity|socket|chipset|speed|frequency|dimensions|weight|interface|connectivity|warranty|ddr[345]|ssd|nvme|hdd|ryzen|geforce|radeon|intel core|\d+\s*(?:gb|tb|ghz|mhz|hz|watt)',re.I)
BAD=re.compile(r'https?://|www\.|\bRM\s*\d|dotatech|emarque|brightstar|all it|nb.?plaza|unboxing|app?er?iciate|corporation|shipping|payment|whatsapp|facebook|tiktok|instagram|parcel|faulty|damage claim|rakaman|bungkusan|tuntutan|pelanggan',re.I)
def clean(value):return re.sub(r'\s+',' ',str(value)).strip(' :|-')
def description_specs(markup):
 soup=BeautifulSoup(markup or '','html.parser');rows=[]
 for dl in soup.select('dl'):
  for dt in dl.select('dt'):
   dd=dt.find_next_sibling('dd')
   if dd:rows.append(clean(dt.get_text(' ',strip=True))+': '+clean(dd.get_text(' ',strip=True)))
 for tr in soup.select('tr'):
  cells=tr.find_all(['th','td'],recursive=False)
  if len(cells)==2 and len(clean(cells[0].get_text(' ',strip=True)))<65:rows.append(clean(cells[0].get_text(' ',strip=True))+': '+clean(cells[1].get_text(' ',strip=True)))
 lines=[clean(x) for x in soup.get_text('\n',strip=True).splitlines() if clean(x)]
 for i,line in enumerate(lines):
  if LABEL.fullmatch(line) and i+1<len(lines) and not LABEL.fullmatch(lines[i+1]):rows.append(line+': '+lines[i+1])
  elif TECH.search(line) and not LABEL.fullmatch(line) and (':' in line or len(line)<160):rows.append(line)
 return list(dict.fromkeys(x for x in rows if 4<len(x)<=650 and TECH.search(x) and not BAD.search(x) and not re.search(r'[\u4e00-\u9fff]',x)))[:24]
def short_title(value,kind):
 title=clean(value)
 if kind not in ('desktop','laptop'):return title
 title=re.sub(r'\s*\([^()]*(?:GB|TB|i[3579]-|R[3579]-)[^()]*\).*','',title,flags=re.I)
 if re.match(r'^NEO\s*-',title):return 'NEO Gaming PC'
 title=re.split(r'\s+(?:Business\s*&\s*Productivity|Commercial Desktop|Desktop PC Black)\b',title,flags=re.I)[0]
 model=re.search(r'\b[A-Za-z0-9]{2,}-(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}',title)
 if model and model.start()>4:title=title[:model.end()]
 else:
  processor=re.search(r'\s+(?:Intel|AMD|Celeron|Pentium|GeForce|Radeon|RTX\s*\d|N\d{4})\b',title,re.I)
  if processor and processor.start()>12:title=title[:processor.start()]
 return title.replace('[','').replace(']','').strip(' -/')
def title_specs(value):
 match=re.search(r'\(([^()]*(?:GB|TB|i[3579]-|R[3579]-)[^()]*)\)',value,re.I)
 if not match:return []
 return ['Konfigurasi: '+clean(x) for x in match[1].split(',') if clean(x)]
