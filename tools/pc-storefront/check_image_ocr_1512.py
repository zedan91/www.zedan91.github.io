import asyncio,io,json,re,time
from PIL import Image,ImageOps
from winsdk.windows.media.ocr import OcrEngine
from winsdk.windows.globalization import Language
from winsdk.windows.storage.streams import InMemoryRandomAccessStream,DataWriter
from winsdk.windows.graphics.imaging import BitmapDecoder,BitmapPixelFormat,BitmapAlphaMode

ENGINE=OcrEngine.try_create_from_language(Language('en-US'))
BAD=re.compile(r'\b(?:rm|myr)\s*\d[\d,.]*\b|\b\d[\d,.]*\s*(?:rm|myr)\b|\b(?:dotatech|emarque|brightstar|ideal\s*tech|illegear|jayacom|nb\s*plaza|viewnet|tech\s*hypermart|all\s*it|hypermarket)\b|build\s*to\s*win|\bpenting\b|\bimportant\b|0\s*%|https?://|www\.|\.com(?:\.my)?\b|\b(?:cashback|sale price|special price|promo price|instal[lm]ment|paylater|monthly|24[- ]month|[qr]m\s*\d+)\b',re.I)
async def inspect_image(data):
    original=Image.open(io.BytesIO(data));original.load()
    image=ImageOps.exif_transpose(original).convert('RGB')
    if min(image.size)<160 or image.width*image.height>35_000_000:raise ValueError('image size unsuitable')
    image.thumbnail((1000,1000));png=io.BytesIO();image.save(png,format='PNG')
    stream=InMemoryRandomAccessStream();writer=DataWriter(stream)
    writer.write_bytes(png.getvalue());await writer.store_async();await writer.flush_async();stream.seek(0)
    decoder=await BitmapDecoder.create_async(stream)
    bitmap=await decoder.get_software_bitmap_async(BitmapPixelFormat.BGRA8,BitmapAlphaMode.PREMULTIPLIED)
    result=await ENGINE.recognize_async(bitmap);text=result.text
    matches=BAD.findall(text)
    writer.detach_stream();writer.close();bitmap.close();stream.close()
    return image,text,matches
