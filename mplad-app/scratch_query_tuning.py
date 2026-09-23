import sqlite3
import pandas as pd
con = sqlite3.connect('data_tuning/app.db')
query = """
SELECT w.village, w.agency_id, w.sanction_date, w.sanctioned_amount
FROM works w JOIN fraud_labels fl ON fl.work_id=w.id
WHERE fl.pattern='P7' ORDER BY w.village, w.sanction_date;
"""
print(pd.read_sql_query(query, con))
