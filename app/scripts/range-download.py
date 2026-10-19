import urllib.request, pathlib, sys, concurrent.futures, time
url,destination=sys.argv[1:3];p=pathlib.Path(destination);start=p.stat().st_size if p.exists() else 0
def req(u,a,b):return urllib.request.urlopen(urllib.request.Request(u,headers={'Range':f'bytes={a}-{b}','User-Agent':'FLOW-build'}),timeout=90)
with req(url,0,0) as r:
    if r.status!=206:raise RuntimeError('Range not supported')
    total=int(r.headers['Content-Range'].split('/')[-1]);final=r.url
if start==total:print('Already downloaded',flush=True);sys.exit(0)
if start>total:start=0
with p.open('r+b' if p.exists() else 'wb') as f:f.truncate(total)
chunk=4*1024*1024
def fetch(a):
    b=min(total-1,a+chunk-1)
    for attempt in range(4):
        try:
            with req(final,a,b) as r:
                if r.status!=206:raise RuntimeError('Invalid response')
                data=r.read()
            if len(data)!=b-a+1:raise RuntimeError('Truncated segment')
            with p.open('r+b') as f:f.seek(a);f.write(data)
            print(f'{p.name}: segment {a//chunk+1} complete',flush=True);return
        except Exception:
            if attempt==3:raise
            time.sleep(1)
print(f'Resuming {p.name} at {start}/{total}',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(fetch,range(start,total,chunk)))
print('Completed '+str(p),flush=True)
