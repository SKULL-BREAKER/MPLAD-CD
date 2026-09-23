import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT SUM(w1.village = w2.village) as same_v, COUNT(*) as tot
FROM works w1 
JOIN fraud_labels fl ON fl.work_id=w1.id
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
WHERE dr.detector='D1' AND fl.pattern='P6'
"""
df = pd.read_sql_query(query, con)
print("P6 same village:", df.to_string())

query2 = """
SELECT SUM(w1.village = w2.village) as same_v, COUNT(*) as tot
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
LEFT JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern IS NULL AND json_extract(dr.evidence_json, '$.same_agency')=0
"""
df2 = pd.read_sql_query(query2, con)
print("FPs same village:", df2.to_string())
con.close()
