"""Fetch pinned official release artifacts. Keep archives and source links for redistribution."""
import urllib.request, json, pathlib, hashlib, zipfile, shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
BIN=ROOT/'resources/bin'; CACHE=ROOT/'resources/cache'; LICENSE=ROOT/'resources/licenses'
for p in (BIN,CACHE,LICENSE): p.mkdir(parents=True,exist_ok=True)
def request(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FLOW-build/0.1'}),timeout=120)
def get(url,dest):
    if not dest.exists():
        print('Downloading '+url,flush=True)
        with request(url) as r, dest.open('wb') as w: shutil.copyfileobj(r,w)
    return dest
def release(repo):
    with request(f'https://api.github.com/repos/{repo}/releases/latest') as r:return json.load(r)
manifest=[]
def asset_download(repo,rel,asset):
    expected=asset.get('digest')
    destination=CACHE/(rel['tag_name'].replace('/','_')+'-'+asset['name'])
    legacy=CACHE/asset['name']
    if not destination.exists() and legacy.exists() and expected and expected=='sha256:'+hashlib.sha256(legacy.read_bytes()).hexdigest():shutil.copy2(legacy,destination)
    p=get(asset['browser_download_url'],destination);digest=hashlib.sha256(p.read_bytes()).hexdigest()
    if expected and expected!='sha256:'+digest:raise RuntimeError('Release digest mismatch: '+asset['name'])
    manifest.append({'repo':repo,'tag':rel['tag_name'],'asset':asset['name'],'url':asset['browser_download_url'],'sha256':digest,'upstreamDigestVerified':bool(expected),'source':f'https://github.com/{repo}/tree/{rel["tag_name"]}'})
    return p
r=release('yt-dlp/yt-dlp');a=next(a for a in r['assets'] if a['name']=='yt-dlp.exe');p=asset_download('yt-dlp/yt-dlp',r,a)
sums=get(next(a['browser_download_url'] for a in r['assets'] if a['name']=='SHA2-256SUMS'),CACHE/(r['tag_name']+'-SHA2-256SUMS'))
expected=next(line.split()[0] for line in sums.read_text().splitlines() if line.split()[-1].lstrip('*')=='yt-dlp.exe')
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('yt-dlp checksum mismatch')
shutil.copy2(p,BIN/'yt-dlp.exe')
for name in ('LICENSE','THIRD_PARTY_LICENSES.txt'):
    get(f'https://raw.githubusercontent.com/yt-dlp/yt-dlp/{r["tag_name"]}/{name}',LICENSE/('yt-dlp-'+name))
r=release('denoland/deno');a=next(a for a in r['assets'] if a['name']=='deno-x86_64-pc-windows-msvc.zip');p=asset_download('denoland/deno',r,a)
with zipfile.ZipFile(p) as z:
    with z.open('deno.exe') as src,(BIN/'deno.exe').open('wb') as dst:shutil.copyfileobj(src,dst)
get(f'https://raw.githubusercontent.com/denoland/deno/{r["tag_name"]}/LICENSE.md',LICENSE/'deno-LICENSE.md')
# yt-dlp-maintained FFmpeg builds: use the official repository's latest release.
r=release('yt-dlp/FFmpeg-Builds');a=next(a for a in r['assets'] if a['name'].endswith('win64-gpl.zip'));p=asset_download('yt-dlp/FFmpeg-Builds',r,a)
with zipfile.ZipFile(p) as z:
    for name in ('ffmpeg.exe','ffprobe.exe'):
        n=next(n for n in z.namelist() if n.endswith('/bin/'+name))
        with z.open(n) as src,(BIN/name).open('wb') as dst:shutil.copyfileobj(src,dst)
    for n in z.namelist():
        if not n.endswith('/') and ('LICENSE' in n.upper() or 'COPYING' in n.upper()):
            with z.open(n) as src,(LICENSE/('ffmpeg-'+pathlib.Path(n).name)).open('wb') as dst:shutil.copyfileobj(src,dst)
(LICENSE/'build-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(LICENSE/'NOTICE.txt').write_text('FLOW uses yt-dlp, FFmpeg and Deno as separate executables. See included licenses and build-manifest.json for exact versions, checksums, release archives and corresponding source locations. yt-dlp Windows standalone includes GPLv3+ components; FFmpeg GPL build licensing applies. Before public redistribution, preserve corresponding source and full transitive license notices. No user credentials are included.\n',encoding='utf-8')
print(json.dumps(manifest,indent=2),flush=True)
