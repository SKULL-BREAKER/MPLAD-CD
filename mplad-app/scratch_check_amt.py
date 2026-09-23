import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT json_extract(dr.evidence_json, '$.amount_delta') as amt_delta
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
LEFT JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern IS NULL AND json_extract(dr.evidence_json, '$.same_agency')=0
"""
df = pd.read_sql_query(query, con)
print("FPs amt_delta mean:", df['amt_delta'].mean())
print("FPs amt_delta min:", df['amt_delta'].min())
print("FPs amt_delta max:", df['amt_delta'].max())

query2 = """
SELECT json_extract(dr.evidence_json, '$.amount_delta') as amt_delta
FROM works w1 
JOIN fraud_labels fl ON fl.work_id=w1.id
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
WHERE dr.detector='D1' AND fl.pattern='P6'
"""
df2 = pd.read_sql_query(query2, con)
print("P6 amt_delta mean:", df2['amt_delta'].mean())
print("P6 amt_delta min:", df2['amt_delta'].min())
print("P6 amt_delta max:", df2['amt_delta'].max())
con.close()
