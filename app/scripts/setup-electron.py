import pathlib,json,urllib.request,hashlib,zipfile,shutil
root=pathlib.Path(__file__).resolve().parents[1];pkg=(root/'node_modules/electron').resolve();version=json.loads((pkg/'package.json').read_text())['version'];name=f'electron-v{version}-win32-x64.zip';dest=root/'resources/cache'/name
url=f'https://github.com/electron/electron/releases/download/v{version}/{name}'
if not dest.exists():
 print('Downloading '+url,flush=True)
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FLOW-build'}),timeout=120) as r,dest.open('wb') as w:shutil.copyfileobj(r,w)
digest=hashlib.sha256(dest.read_bytes()).hexdigest();expected=json.loads((pkg/'checksums.json').read_text())[name]
if digest!=expected:raise RuntimeError('Electron SHA256 mismatch')
with zipfile.ZipFile(dest) as z:z.extractall(pkg/'dist')
(pkg/'path.txt').write_text('electron.exe')
print('Electron installed and verified '+version,flush=True)
