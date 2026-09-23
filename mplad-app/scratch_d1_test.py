import sqlite3
import pandas as pd

def test_corroboration():
    con = sqlite3.connect("data_tuning/app.db")
    df = pd.read_sql_query("SELECT * FROM works", con)
    # We can just run run_d1 locally on a copy of d1.py to see the effect!
    pass
