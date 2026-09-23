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

if old_tag in code:
    code = code.replace(old_tag, new_tag)
else:
    print("WARNING: old_tag not found")

# Fix 2: Add invariant check at the end
invariant = """
# Post-generation assertion: no work can have both innocent and non-innocent labels
lab_df = pd.DataFrame(labels)
if not lab_df.empty:
    bad_works = lab_df.groupby('work_id').apply(
        lambda g: (g['label_class'] == 'innocent').any() and (g['label_class'] != 'innocent').any()
    )
    assert not bad_works.any(), f"Data invariant violation: {bad_works.sum()} works have contradictory labels!"
"""

target = 'print(f"works generated: {len(works)}")'
if target in code and "Data invariant violation" not in code:
    code = code.replace(target, target + invariant)
else:
    print("WARNING: target not found or invariant already added")

with open('seed/generate_dataset.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched generate_dataset.py successfully")
