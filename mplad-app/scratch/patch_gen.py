import sys

with open('seed/generate_dataset.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix 1: Update N1-N4 tagging
old_tag = """labeled = {r["work_id"] for r in labels}
pool = [w for w in works if w["id"] not in labeled]
def tag(match, n, pat):
    hits = [w for w in pool if match(w)]
    if not hits: return
    for w in rng.choice(hits, size=min(n, len(hits)), replace=False):
        label(w["id"], pat, "innocent")"""

new_tag = """def tag(match, n, pat):
    labeled = {r["work_id"] for r in labels}
    hits = [w for w in works if match(w) and w["id"] not in labeled]
    if not hits: return
    for w in rng.choice(hits, size=min(n, len(hits)), replace=False):
        label(w["id"], pat, "innocent")"""

code = code.replace(old_tag, new_tag)

# Fix 2: Add invariant check at the end
old_end = """print(f"works generated: {len(works)}")
print(f"fund flow rows: {len(rows)}")
print(f"total fund flow: ₹{sum(f['funds_released'] for f in rows):,.0f}")"""

new_end = """print(f"works generated: {len(works)}")
print(f"fund flow rows: {len(rows)}")
print(f"total fund flow: ₹{sum(f['funds_released'] for f in rows):,.0f}")

# Post-generation assertion: no work can have both innocent and non-innocent labels
import pandas as pd
lab_df = pd.DataFrame(labels)
if not lab_df.empty:
    bad_works = lab_df.groupby('work_id').apply(
        lambda g: (g['label_class'] == 'innocent').any() and (g['label_class'] != 'innocent').any()
    )
    assert not bad_works.any(), f"Data invariant violation: {bad_works.sum()} works have contradictory labels!"
"""

if "print(f\"works generated: {len(works)}\")" in code:
    # Just in case the old_end string is slightly different
    code = code.replace("print(f\"works generated: {len(works)}\")\n", new_end.split("\n", 3)[3])
else:
    code = code.replace(old_end, new_end)

with open('seed/generate_dataset.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched generate_dataset.py")
