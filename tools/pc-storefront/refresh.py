"""Owner-run refresh; does not deploy or copy to the watched ZIP folder."""
from pathlib import Path
import subprocess,sys,os
folder=Path(__file__).resolve().parent
for script in ['import_shop_1512.py','import_presta_1512.py','vendor_shop_1512.py','finalize_shop_media_1512.py']:
    subprocess.run([sys.executable,'-u',str(folder/script)],check=True,env={**os.environ,"PYTHONUTF8":"1"})
print('Refresh complete. Review photo audit/contact sheet and test before packaging the full website.')
