import sqlite3
import csv
import random
import os
import hashlib
from datetime import datetime, timedelta

def main():
    random.seed(42)
    os.makedirs('data', exist_ok=True)
    db_path = 'data/app.db'
    
    # Remove existing db to ensure clean state
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create Tables
    cursor.executescript("""
    CREATE TABLE Constituency (
        constituency_id TEXT PRIMARY KEY,
        area_scope_term_id TEXT
    );
    CREATE TABLE Member (
        member_id TEXT PRIMARY KEY
    );
    CREATE TABLE EntitlementYear (
        entitlement_year_id TEXT PRIMARY KEY,
        member_id TEXT,
        year_val INTEGER,
        annual_amount REAL,
        committed_amount REAL,
        sanctioned_amount REAL,
        expended_amount REAL,
        FOREIGN KEY(member_id) REFERENCES Member(member_id)
    );
    CREATE TABLE PublicAssetInventory (
        asset_id TEXT PRIMARY KEY,
        constituency_id TEXT,
        public_utility_term_id TEXT,
        public_locality_term_id TEXT,
        FOREIGN KEY(constituency_id) REFERENCES Constituency(constituency_id)
    );
    CREATE TABLE WorkProposal (
        proposal_id TEXT PRIMARY KEY,
        constituency_id TEXT,
        member_id TEXT,
        year_val INTEGER,
        public_utility_term_id TEXT,
        public_locality_term_id TEXT,
        requested_amount REAL,
        FOREIGN KEY(constituency_id) REFERENCES Constituency(constituency_id),
        FOREIGN KEY(member_id) REFERENCES Member(member_id)
    );
    CREATE TABLE ImplementingAgency (
        agency_id TEXT PRIMARY KEY
    );
    CREATE TABLE Work (
        work_id TEXT PRIMARY KEY,
        proposal_id TEXT,
        constituency_id TEXT,
        member_id TEXT,
        year_val INTEGER,
        sequence_num INTEGER,
        implementing_agency_id TEXT,
        sanctioned_amount REAL,
        state_term_id TEXT,
        committed_amount REAL,
        expended_amount REAL,
        is_completed BOOLEAN,
        is_utilised BOOLEAN,
        FOREIGN KEY(proposal_id) REFERENCES WorkProposal(proposal_id),
        FOREIGN KEY(implementing_agency_id) REFERENCES ImplementingAgency(agency_id)
    );
    CREATE TABLE WorkEvidence (
        evidence_id TEXT PRIMARY KEY,
        work_id TEXT,
        media_type_code TEXT,
        geo_latitude REAL,
        geo_longitude REAL,
        capture_authority_code TEXT,
        created_datetime TEXT,
        FOREIGN KEY(work_id) REFERENCES Work(work_id)
    );
    CREATE TABLE ActionAudit (
        audit_id TEXT PRIMARY KEY,
        actor_type_code TEXT,
        affected_identity_id TEXT,
        state_change_code TEXT,
        action_datetime TEXT,
        reason_term_id TEXT
    );
    """)

    # Generate Data
    sectors = ['Drinking Water', 'Education', 'Electricity', 'Health', 'Roads', 'Sports', 'Irrigation']
    constituencies = [f"C-{i:03d}" for i in range(1, 101)]
    members = [f"M-{i:03d}" for i in range(1, 101)]
    agencies = [f"A-{i:03d}" for i in range(1, 11)]

    for c in constituencies:
        cursor.execute("INSERT INTO Constituency VALUES (?, ?)", (c, "AREA_" + c))
    for m in members:
        cursor.execute("INSERT INTO Member VALUES (?)", (m,))
    for a in agencies:
        cursor.execute("INSERT INTO ImplementingAgency VALUES (?)", (a,))

    for m in members:
        cursor.execute("INSERT INTO EntitlementYear VALUES (?, ?, ?, ?, ?, ?, ?)", 
                       (f"EY-{m}-2024", m, 2024, 50000000, 0, 0, 0))

    works_data = []
    fraud_labels = []
    work_count = 0

    for i in range(1, 5001):
        c = random.choice(constituencies)
        m = members[constituencies.index(c)] # 1-to-1 mapping for simplicity
        sector = random.choice(sectors)
        
        proposal_id = f"P-{i:05d}"
        cursor.execute("INSERT INTO WorkProposal VALUES (?, ?, ?, ?, ?, ?, ?)",
                       (proposal_id, c, m, 2024, sector, f"LOC-{random.randint(1,500)}", random.uniform(100000, 5000000)))
        
        work_id = f"W-{c}-{m}-2024-{i}"
        agency = random.choice(agencies)
        sanctioned_amount = random.uniform(100000, 5000000)
        
        cursor.execute("INSERT INTO Work VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       (work_id, proposal_id, c, m, 2024, i, agency, sanctioned_amount, "IN-EXECUTION", sanctioned_amount, sanctioned_amount * random.uniform(0.1, 0.9), False, False))
        works_data.append(work_id)
        work_count += 1
        
        if random.random() < 0.05:
            fraud_labels.append({"work_id": work_id, "label": 1})
        else:
            fraud_labels.append({"work_id": work_id, "label": 0})

    conn.commit()

    def export_table_to_csv(table_name):
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        column_names = [description[0] for description in cursor.description]
        filename = f"data/{table_name}.csv"
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(column_names)
            writer.writerows(rows)
        return filename

    csv_files = []
    tables = ["Constituency", "Member", "EntitlementYear", "PublicAssetInventory", 
              "WorkProposal", "ImplementingAgency", "Work", "WorkEvidence", "ActionAudit"]
    
    for table in tables:
        csv_files.append(export_table_to_csv(table))
        
    with open('data/fraud_labels.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["work_id", "label"])
        writer.writeheader()
        writer.writerows(fraud_labels)
    csv_files.append('data/fraud_labels.csv')

    conn.close()

    print(f"works count printed ~ {work_count}")
    
    # Calculate SHA256 of all CSVs
    hasher = hashlib.sha256()
    for f in sorted(csv_files):
        with open(f, 'rb') as file:
            hasher.update(file.read())
    print(f"sha256 of all CSVs identical: {hasher.hexdigest()}")

if __name__ == "__main__":
    main()
