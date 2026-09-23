import subprocess

def run(cmd):
    print('\n$ ' + cmd)
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT)
        print(out.decode('utf-8', errors='replace').strip())
    except subprocess.CalledProcessError as e:
        print(e.output.decode('utf-8', errors='replace').strip())

run('curl.exe -s http://localhost:8000/api/overview')
run('curl.exe -s http://localhost:8000/api/districts')
run('curl.exe -s "http://localhost:8000/api/districts/DIST-009/works?tier=CRITICAL"')
run('curl.exe -s http://localhost:8000/api/works/W-002133')
run('curl.exe -s http://localhost:8000/api/works/W-002133/matches')
run('curl.exe -s http://localhost:8000/api/eval/metrics')
run('curl.exe -s -I http://localhost:8000/')
run('curl.exe -s -I http://localhost:8000/work/W-004312')
run('curl.exe -s -I http://localhost:8000/district/DIST-009')
run('dir backend\\static')
run('git log --oneline -5')
