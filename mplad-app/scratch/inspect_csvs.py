import csv, sys, os

sys.stdout.reconfigure(encoding='utf-8')

files = [
    r'C:\Users\nanth\OneDrive\Desktop\MPLAD\mplads_recommended_works_2026-09-14.csv',
    r'C:\Users\nanth\OneDrive\Desktop\MPLAD\mplads_completed_works_2026-09-14.csv',
    r'C:\Users\nanth\OneDrive\Desktop\MPLAD\mplads_expenditures_2026-09-14.csv',
    r'C:\Users\nanth\OneDrive\Desktop\MPLAD\mplads_mp_summary_2026-09-14.csv',
]
for f in files:
    size_mb = os.path.getsize(f) / 1e6
    with open(f, encoding='utf-8', errors='ignore') as fp:
        r = csv.DictReader(fp)
        cols = r.fieldnames or []
        row = next(r, {})
        # count rows
        fp.seek(0)
        n = sum(1 for _ in fp) - 1
    print(f.split(os.sep)[-1], f'({size_mb:.1f} MB, ~{n} rows)')
    print('  Cols:', cols)
    print('  Row1:', {k: str(v)[:25] for k,v in list(row.items())[:8]})
    print()
