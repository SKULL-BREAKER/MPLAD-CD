import sqlite3
import pandas as pd
con = sqlite3.connect('data_tuning/app.db')
query = """
SELECT w.village, SUM(w.sanctioned_amount), MIN(w.sanctioned_amount), MAX(w.sanctioned_amount), COUNT(w.id)
FROM works w JOIN fraud_labels fl ON fl.work_id=w.id
WHERE fl.pattern='P7' GROUP BY w.village;
"""
print(pd.read_sql_query(query, con))
