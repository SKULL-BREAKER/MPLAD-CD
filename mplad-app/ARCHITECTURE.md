# Architecture Boundaries

- **Next.js (Frontend ONLY):** All pixels, UI components, and presentation layer live here. No business logic in Next API routes.
- **Python / FastAPI (Backend):** All intelligence, business logic, ML embeddings (sentence-transformers), ML models (sklearn IsolationForest), imagehash, and copilot guardrails live here.
- **Database:** SQLite/Postgres interfaces happen through the Python backend.
