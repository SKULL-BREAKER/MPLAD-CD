import urllib.request, json

def get(url):
    r = urllib.request.urlopen('http://127.0.0.1:8000' + url)
    return json.loads(r.read()), r.getcode()

# 1. overview
d, code = get('/api/overview')
total_works = d['total_works']
flagged_sum = sum(d['flagged'].values())
print(f'[1] /api/overview => {code}, works={total_works}, flagged={flagged_sum}')

# 2. districts list
d, code = get('/api/districts')
print(f'[2] /api/districts => {code}, count={len(d)}')
top_dist = sorted(d, key=lambda x: x['risk'], reverse=True)[0]
dist_id = top_dist['id']
dist_name = top_dist['name']
print(f'    top district: {dist_id} {dist_name} risk={top_dist["risk"]}')

# 3. district detail
d, code = get(f'/api/districts/{dist_id}')
print(f'[3] /api/districts/{dist_id} => {code}, flags={d["flags"]}')

# 4. district works
d, code = get(f'/api/districts/{dist_id}/works')
print(f'[4] /api/districts/{dist_id}/works => {code}, count={len(d)}')
flagged_works = [w for w in d if w.get('tier') not in ('LOW', None)]
print(f'    flagged works: {len(flagged_works)}')
sample_work = flagged_works[0] if flagged_works else d[0]
wid = sample_work['id']

# 5. work detail
d, code = get(f'/api/works/{wid}')
tier = d['risk']['tier']
nflags = len(d['flags'])
print(f'[5] /api/works/{wid} => {code}, risk_tier={tier}, flags={nflags}')

# 6. work matches - find a D1 work
d1_flags = [f for f in d['flags'] if f['detector'] == 'D1']
d1_wid = None
if d1_flags:
    d1_wid = wid
    matches, code2 = get(f'/api/works/{wid}/matches')
    print(f'[6] /api/works/{wid}/matches => {code2}, matches={len(matches)}')
else:
    all_works, _ = get(f'/api/districts/{dist_id}/works')
    for w in all_works:
        wd, _ = get(f'/api/works/{w["id"]}')
        if any(f['detector'] == 'D1' for f in wd['flags']):
            d1_wid = w['id']
            m, c = get(f'/api/works/{w["id"]}/matches')
            print(f'[6] D1 work={w["id"]} /matches => {c}, matches={len(m)}')
            break
    if not d1_wid:
        print('[6] No D1 work found in top district')

# 7. eval metrics
d, code = get('/api/eval/metrics')
sys_keys = list(d.get('system_metrics', {}).keys())
print(f'[7] /api/eval/metrics => {code}, system_metrics={sys_keys}')

# 8. SPA fallback test (non-api route should return 200 with index.html)
r = urllib.request.urlopen('http://127.0.0.1:8000/district/DIST-001')
print(f'[8] SPA /district/DIST-001 => {r.getcode()}, content-type={r.headers.get("content-type","?")}')

print('ALL ENDPOINTS PASS')
