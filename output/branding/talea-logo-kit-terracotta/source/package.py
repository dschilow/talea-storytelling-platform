from pathlib import Path
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image

root=Path(__file__).resolve().parent.parent
svgs=list((root/'svg').glob('*.svg'))
for svg in svgs:
    ET.parse(svg)
    assert '<image' not in svg.read_text(encoding='utf-8')
    assert '<text' not in svg.read_text(encoding='utf-8')
links=re.findall(r'(?:href|src)="([^"]+)"',(root/'index.html').read_text(encoding='utf-8'))
missing=[value for value in links if not value.startswith('../') and not (root/value).is_file()]
assert not missing,missing
app=Image.open(root/'png/talea-app-icon-1024.png').convert('RGBA')
assert app.size==(1024,1024)
assert app.getextrema()[-1]==(255,255)
for size in [16,24,32,48,64,128,180,192,256,512,1024,2048]:
    icon=Image.open(root/'png'/f'talea-icon-{size}.png')
    assert icon.size==(size,size)
    assert icon.mode=='RGBA'
files=[file for folder in ['svg','png','favicon'] for file in (root/folder).iterdir() if file.is_file()]
files += [root/'index.html',root/'manifest.json',root/'preview.png']
archive=root.parent/(root.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
    for file in files:
        bundle.write(file,file.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
print(json.dumps({'SVGs':len(svgs),'PNGs':len(list((root/'png').glob('*.png'))),'broken_preview_links':missing,'opaque_app_icon':True,'archive_files':len(files),'archive_bytes':archive.stat().st_size}))
