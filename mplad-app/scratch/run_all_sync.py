import subprocess
import sys

def run(cmd, shell=False):
    print(f"\n$ {cmd}")
    res = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
    if res.stdout:
        print(res.stdout, end="")
    if res.stderr:
        print(res.stderr, file=sys.stderr, end="")
    return res.returncode

run("python seed/generate_dataset.py --seed 42 --out data/")
run("python seed/generate_dataset.py --seed 43 --out data_tuning/")
run("python -m app.db_load --csv data --db data/app.db")
run("git log --oneline -5", shell=True)
run("python scripts/gate01.py")
run("python scripts/gate02.py")

print("\n$ cat reports/eval_dev.json")
with open("reports/eval_dev.json", "r") as f:
    print(f.read())

py_script = """
import sqlite3
con = sqlite3.connect('data/app.db')
print('contradictions:', con.execute(\"\"\"
  SELECT COUNT(*) FROM (
    SELECT work_id FROM fraud_labels GROUP BY work_id
    HAVING SUM(CASE WHEN label_class='innocent' THEN 1 ELSE 0 END) > 0
       AND SUM(CASE WHEN label_class!='innocent' THEN 1 ELSE 0 END) > 0
  )\"\"\").fetchone()[0])
print('innocent tags:', con.execute(\"\"\"
  SELECT pattern, COUNT(*) FROM fraud_labels
  WHERE label_class='innocent' GROUP BY pattern\"\"\").fetchall())
"""
print("\n$ python - <<'EOF'...")
res = subprocess.run(["python", "-c", py_script], capture_output=True, text=True)
if res.stdout:
    print(res.stdout, end="")
if res.stderr:
    print(res.stderr, file=sys.stderr, end="")

run("git rev-parse HEAD", shell=True)
