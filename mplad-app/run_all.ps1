echo "--- GENERATING SEED 42 ---" > run_output.txt
python seed/generate_dataset.py --seed 42 --out data/ >> run_output.txt 2>&1
echo "--- GENERATING SEED 43 ---" >> run_output.txt
python seed/generate_dataset.py --seed 43 --out data_tuning/ >> run_output.txt 2>&1
echo "--- LOADING DB ---" >> run_output.txt
python -m app.db_load --csv data --db data/app.db >> run_output.txt 2>&1
echo "--- GIT LOG ---" >> run_output.txt
git log --oneline -5 >> run_output.txt 2>&1
echo "--- GATE 01 ---" >> run_output.txt
python scripts/gate01.py >> run_output.txt 2>&1
echo "--- GATE 02 ---" >> run_output.txt
python scripts/gate02.py >> run_output.txt 2>&1
echo "--- EVAL JSON ---" >> run_output.txt
Get-Content reports/eval_dev.json >> run_output.txt 2>&1
echo "--- SQL DIAGNOSIS ---" >> run_output.txt
python -c "
import sqlite3
con = sqlite3.connect('data/app.db')
print('contradictions:', con.execute('''
  SELECT COUNT(*) FROM (
    SELECT work_id FROM fraud_labels GROUP BY work_id
    HAVING SUM(CASE WHEN label_class=''innocent'' THEN 1 ELSE 0 END) > 0
       AND SUM(CASE WHEN label_class!=''innocent'' THEN 1 ELSE 0 END) > 0
  )''').fetchone()[0])
print('innocent tags:', con.execute('''
  SELECT pattern, COUNT(*) FROM fraud_labels
  WHERE label_class=''innocent'' GROUP BY pattern''').fetchall())
" >> run_output.txt 2>&1
echo "--- GIT REV-PARSE HEAD ---" >> run_output.txt
git rev-parse HEAD >> run_output.txt 2>&1
