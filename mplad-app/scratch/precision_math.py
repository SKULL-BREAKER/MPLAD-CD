import sqlite3
con = sqlite3.connect('data/app.db')
print('=== D1 CAUGHT WORKS ===')
works = [r[0] for r in con.execute('SELECT DISTINCT work_id FROM detection_results WHERE detector = "D1"').fetchall()]
print(f'Total unique D1 works: {len(works)}')
works_split = [r[0] for r in con.execute('SELECT DISTINCT work_id FROM detection_results WHERE detector = "D1_split"').fetchall()]
print(f'Total unique D1_split works: {len(works_split)}')
all_caught = set(works + works_split)
print(f'Total unique caught works (len(caught)): {len(all_caught)}')

print('\n=== CAUGHT SET DECOMPOSITION (Label Class) ===')
q = '''
SELECT work_id, GROUP_CONCAT(pattern) as pats, MAX(label_class) as lclass
FROM fraud_labels 
WHERE work_id IN ({})
GROUP BY work_id
'''
caught_list = ','.join([f'"{w}"' for w in all_caught])
rows = con.execute(q.format(caught_list)).fetchall()

tps = 0
other_anomalies = 0
innocent = 0
unlabeled = len(all_caught) - len(rows)

for w, pats, lclass in rows:
    p_set = set(pats.split(','))
    if p_set.intersection({'P2', 'P6', 'P7'}):
        tps += 1
    elif lclass in ('fraud', 'inefficiency', 'violation', 'anomaly'):
        other_anomalies += 1
    elif lclass == 'innocent':
        innocent += 1
    else:
        other_anomalies += 1

print(f'TPs (P2/P6/P7): {tps}')
print(f'Other Anomalies: {other_anomalies}')
print(f'Innocent: {innocent}')
print(f'Unlabeled: {unlabeled}')

# Check the specific 9 FPs from before
q_fp = '''
SELECT w.id, GROUP_CONCAT(fl.pattern)
FROM works w 
LEFT JOIN fraud_labels fl ON fl.work_id = w.id
WHERE w.id IN ('W-000075', 'W-000558', 'W-001570', 'W-002322', 'W-000267', 'W-000349', 'W-000759', 'W-000799', 'W-001551')
GROUP BY w.id
'''
print('\n=== The 9 FPs Labels ===')
for r in con.execute(q_fp).fetchall():
    print(f'  {r[0]}: {r[1]}')
