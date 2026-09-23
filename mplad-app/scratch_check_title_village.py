import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT COUNT(*) as fp_count, SUM(INSTR(LOWER(w1.title), LOWER(w1.village)) > 0) as fp_with_own_v
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
LEFT JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern IS NULL AND json_extract(dr.evidence_json, '$.same_agency')=0
"""
df = pd.read_sql_query(query, con)
print("FPs containing own village in title:", df.to_string())

query2 = """
SELECT w1.village, w1.title
FROM works w1 
JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE fl.pattern='P6'
"""
df2 = pd.read_sql_query(query2, con)
count_p6 = len(df2)
p6_with_v = df2.apply(lambda row: row['village'].lower() in row['title'].lower(), axis=1).sum()
print(f"P6 containing own village in title: {p6_with_v} / {count_p6}")
con.close()
