import pandas as pd

def main():
    with open('data/guard_decisions.log') as f:
        lines = f.read().splitlines()

    records = []
    for line in lines:
        if not line.strip(): continue
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 5 and parts[4] == 'ForceInsert':
            pattern = parts[0]
            cell = parts[1]
            amount = float(parts[2])
            records.append({
                "pattern": pattern,
                "cell": cell,
                "amount": amount
            })
            
    if not records:
        print("No ForceInsert records found.")
        return
        
    df = pd.DataFrame(records)
    print(f"Total ForceInsert count: {len(df)}")
    print("\nInjection Patterns producing ForceInserts:")
    print(df['pattern'].value_counts())
    
    print("\nAggregation by MP x FY cell:")
    cell_agg = df.groupby('cell').agg(
        force_insert_count=('amount', 'count'),
        total_force_amount=('amount', 'sum')
    ).reset_index()
    
    import sqlite3
    con = sqlite3.connect('data/app.db')
    works_df = pd.read_sql_query("SELECT mp_id, fy, sanctioned_amount FROM works", con)
    works_df['cell'] = works_df['mp_id'] + 'x' + works_df['fy']
    db_agg = works_df.groupby('cell').agg(
        total_sanctioned=('sanctioned_amount', 'sum')
    ).reset_index()
    
    merged = pd.merge(cell_agg, db_agg, on='cell', how='left')
    merged['entitlement'] = 50000000.0
    merged['overshoot_ratio'] = merged['total_sanctioned'] / merged['entitlement']
    
    merged = merged.sort_values('overshoot_ratio', ascending=False)
    
    print("\nTop Cells by Overshoot Ratio (with ForceInserts):")
    for _, row in merged.head(10).iterrows():
        print(f"Cell: {row['cell']} | ForceInserts: {row['force_insert_count']} | Total Sanctioned: {row['total_sanctioned']:.0f} | Overshoot: {row['overshoot_ratio']:.2f}x")
        
    max_overshoot = merged['overshoot_ratio'].max()
    max_cell = merged.iloc[0]['cell']
    print(f"\nVerification: Max overshoot is {max_overshoot:.2f}x in {max_cell}, which contains {merged.iloc[0]['force_insert_count']} force-inserts out of {len(df)} total.")

if __name__ == '__main__':
    main()
