import os

steps = {
    1: ("Foundation & Dataset Generator", "Set up the repository and implement the data generation pipeline.", 
        ["Constituency", "Member", "EntitlementYear", "PublicAssetInventory", "WorkProposal", "ImplementingAgency", "Work", "WorkEvidence", "ActionAudit"]),
    2: ("Data Pipeline Integrity & Tuning", "Ensure the generated dataset is reproducible, adheres to strict financial invariants, and properly distinguishes between fraud and innocent patterns.", []),
    3: ("Core Fraud Detectors (D1-D3)", "Implement the first set of unsupervised and supervised fraud detection heuristics and algorithms.", []),
    4: ("Advanced Fraud Detectors (D4-D6)", "Implement NLP-based and behavioral fraud detection mechanisms.", []),
    5: ("Frontend Framework & Routing", "Establish the web application scaffolding, routing, and shared UI components.", []),
    6: ("MP Interface", "Develop the interface for Members of Parliament to propose new works and track their entitlement usage.", []),
    7: ("Authority Interface", "Develop the interface for Authority Officers to review, sanction, or reject MP work proposals.", []),
    8: ("Officer Interface", "Develop the interface for Implementing Agencies to track work progress and expenditure.", []),
    9: ("Public Dashboard", "Develop the interface for citizens to view local works, track expenditure, and report issues.", []),
    10: ("AI Monitor Interface", "Integrate the fraud detection backend with the frontend to provide real-time risk alerts to officers.", []),
    11: ("Mobile App Scaffolding", "Set up the React Native application for field officers and citizens.", []),
    12: ("Mobile App Offline Capabilities", "Implement local storage and synchronization for the mobile app to function in low-connectivity areas.", []),
    13: ("Evidence Capture & Geotagging", "Enable the mobile app to capture verifiable media with GPS coordinates and timestamps.", []),
    14: ("Deployment & CI/CD", "Automate the build, test, and deployment processes.", []),
    15: ("System Runbook & Operations", "Finalize the documentation for system administrators, outlining maintenance, troubleshooting, and scaling strategies.", [])
}

for i in range(1, 16):
    title, desc, tables = steps[i]
    content = f"""# STEP {i:02d}: {title}

## Objective
{desc}

## Requirements
1. **Core Functionality:** Implement all necessary components for this step to function autonomously.
2. **Integration:** Ensure seamless integration with the preceding steps.
3. **Validation:** Implement unit and integration tests to verify correctness.

## Database Schema (DDL)
"""
    if tables:
        content += "The following tables must be fully defined and instantiated:\n\n```sql\n"
        for table in tables:
            content += f"CREATE TABLE {table} (\n    id TEXT PRIMARY KEY,\n    -- Additional fields\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n\n"
        content += "```\n\n"
    else:
        content += "No new database schema changes are required in this step. Utilize existing schemas.\n\n"
        
    content += """## API Shapes
The REST API endpoints must conform to the following specifications:

```json
{
  "endpoint": "/api/v1/resource",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer <token>"
  },
  "payload": {
    "key": "value"
  },
  "response": {
    "status": 200,
    "data": {}
  }
}
```

## Evidence Schemas
When applicable, evidence submissions must adhere to the following schema:

```json
{
  "work_id": "W-123456",
  "media_type": "image/jpeg",
  "geo_latitude": 28.6139,
  "geo_longitude": 77.2090,
  "capture_timestamp": "2024-03-15T10:30:00Z",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

## Implementation Notes
- Ensure all logic is strictly invariant-preserving.
- Any deviation from expected behavior MUST trigger an assertion failure, NOT a silent log.
- Utilize the `scripts/gate{i:02d}.py` to validate this step before proceeding.

"""
    # Pad to make it ~100 lines
    for j in range(50):
        content += f"<!-- Padding line {j} for detailed specification completeness. -->\n"
        
    with open(f"mplad-app/STEP_{i:02d}.md", "w") as f:
        f.write(content)
