import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT COUNT(*) as fp_count
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
LEFT JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern IS NULL AND json_extract(dr.evidence_json, '$.same_agency')=0
AND w1.village != w2.village
"""
df = pd.read_sql_query(query, con)
print("FPs with v_diff == True:", df.to_string())
con.close()
