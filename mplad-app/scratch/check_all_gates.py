import json, subprocess

d = json.load(open('reports/eval_dev.json'))
dm = d['detector_metrics']

git_sha = d.get('git_sha', 'N/A')
head = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()

print(f"git_sha in eval: {git_sha}")
print(f"HEAD:            {head}")
print(f"Match:           {git_sha == head}")
print()

for p in ['P1', 'P5', 'P8', 'P10']:
    m = dm.get(p, {})
    prec = m.get('precision')
    rec = m.get('recall')
    print(f"{p}: recall={rec}, precision={prec}, caught={m.get('caught')}, support={m.get('support')}")

print()
print("=== Full detector_metrics ===")
print(json.dumps(dm, indent=2))
