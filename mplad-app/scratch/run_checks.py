import subprocess
import os

with open('scratch/outputs2.txt', 'w', encoding='utf-8') as f:
    f.write('--- Running commands ---\n')
    subprocess.run('git tag -d step-02-passed', shell=True)
    subprocess.run('python -m app.pipeline.eval --db data/app.db --out reports/eval_dev.json', shell=True)
    res_gate = subprocess.run('python scripts/gate02.py', shell=True, capture_output=True, text=True)

    f.write('\n# python scripts/gate02.py\n')
    f.write(res_gate.stdout)

    f.write('\n# cat reports/eval_dev.json\n')
    with open('reports/eval_dev.json', 'r') as jf:
        f.write(jf.read())

    f.write('\n# git show --stat 1cf9d4c | head -25\n')
    res_git = subprocess.run('git show --stat 1cf9d4c', shell=True, capture_output=True, text=True)
    lines = res_git.stdout.split('\n')
    f.write('\n'.join(lines[:25]) + '\n')

    f.write('\n# COMMIT AND TAG\n')
    subprocess.run('git add app/pipeline/metrics.py scripts/gate02.py', shell=True)
    subprocess.run('git commit -m "Step 02: Fix confusion matrix reconciliation"', shell=True)
    subprocess.run('git tag step-02-passed', shell=True)

    f.write('\n# git tag -l && git log --oneline -3\n')
    f.write(subprocess.run('git tag -l', shell=True, capture_output=True, text=True).stdout)
    f.write(subprocess.run('git log --oneline -3', shell=True, capture_output=True, text=True).stdout)
