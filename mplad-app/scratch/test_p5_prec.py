import sqlite3
import pandas as pd
import json

def check():
    con = sqlite3.connect("data/app.db")
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector IN ('D5', 'D8')", con)
    print("D5 rows:", len(df[df.detector == 'D5']))
    print("D8 rows:", len(df[df.detector == 'D8']))
    
    # Check innocent FPs for D5
    innocents = pd.read_sql_query("SELECT work_id FROM fraud_labels WHERE label_class='innocent'", con)
    inn_set = set(innocents['work_id'])
    
    d5_works = set(df[df.detector == 'D5']['work_id'])
    d8_works = set(df[df.detector == 'D8']['work_id'])
    
    print("D5 innocents:", len(d5_works & inn_set))
    print("D8 innocents:", len(d8_works & inn_set))
    con.close()

if __name__ == "__main__":
    check()
