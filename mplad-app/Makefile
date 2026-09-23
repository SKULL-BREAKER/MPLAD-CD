.PHONY: seed seed-tuning db-load detect aggregate eval tune gate pipeline build demo

# ── Data generation ──────────────────────────────────────────────────────────
seed:
	python seed/generate_dataset.py --seed 42 --out data/

seed-tuning:
	python seed/generate_dataset.py --seed 43 --out data_tuning/

# ── Pipeline ─────────────────────────────────────────────────────────────────
db-load:
	python -m app.db_load --csv data --db data/app.db

detect:
	python -m app.pipeline.run --db data/app.db

aggregate:
	python -m app.pipeline.aggregate --db data/app.db

eval:
	python -m app.pipeline.eval --db data/app.db --out reports/eval_dev.json

pipeline: db-load detect aggregate eval
	@echo "Pipeline complete."

tune:
	@echo "not implemented"

gate:
	python scripts/gate01.py

# ── Frontend ─────────────────────────────────────────────────────────────────
build:
	cd frontend && npm run build

# ── Demo (one-command cold start) ────────────────────────────────────────────
# Kills port 8000, copies demo.db to runtime path, starts server, prints URL.
# Target: serving in under 15 seconds from a cold start.
demo:
	@echo "==> Stopping any process on port 8000..."
	-powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"
	@echo "==> Copying demo.db to runtime location..."
	copy /Y demo.db data\app.db
	@echo "==> Starting PRAHARI at http://localhost:8000 ..."
	python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

