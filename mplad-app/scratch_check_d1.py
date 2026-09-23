
import sqlite3, pandas as pd
con = sqlite3.connect('data/app.db')
w = pd.read_sql('SELECT * FROM works WHERE id IN ("W-000075", "W-002033")', con)
w1 = w.iloc[0]
w2 = w.iloc[1]

t1_text = w1['title'].strip()
t2_text = w2['title'].strip()

t1_norm = t1_text.replace(" (phase 2)", "")
t2_norm = t2_text.replace(" (phase 2)", "")
exact_norm = (t1_norm == t2_norm)
has_phase_2 = (" (phase 2)" in t1_text) or (" (phase 2)" in t2_text)

same_agency = bool(w1['agency_id'] == w2['agency_id'])
same_district = (w1['district_id'] == w2['district_id'])
v1_base = w1['village'].split('-')[0]
v2_base = w2['village'].split('-')[0]
v_diff = (v1_base != v2_base)

amt_delta = abs(w1['sanctioned_amount'] - w2['sanctioned_amount']) / max(w1['sanctioned_amount'], w2['sanctioned_amount'])
dist = 0.0 # dummy

is_p2 = exact_norm and has_phase_2 and amt_delta > 0.0 and amt_delta <= 0.20 and dist <= 5.0 and not v_diff
is_p6 = not same_district and v_diff and exact_norm

final_s = 1.0

if same_agency:
    if not is_p2 and not is_p6:
        final_s = min(final_s, 0.69)
else:
    if same_district:
        final_s = min(final_s, 0.69)
    else:
        if not v_diff:
            final_s = min(final_s, 0.69)
        elif not exact_norm:
            final_s = min(final_s, 0.69)

print(f"t1={t1_text}")
print(f"t2={t2_text}")
print(f"same_agency={same_agency}, exact_norm={exact_norm}, has_phase_2={has_phase_2}, is_p2={is_p2}, is_p6={is_p6}")
print(f"final_s={final_s}")
