.PHONY: seed seed-tuning db-load detect aggregate eval tune

seed:
	node mplad_ai/synthetic_data_generator.js --seed 42 --out data/

seed-tuning:
	node mplad_ai/synthetic_data_generator.js --seed 43 --out data_tuning/

db-load:
	node mplad-app/scripts/db_load.js --csv data/ --db data/app.db



detect:
	node mplad-app/lib/pipeline/detect.js

aggregate:
	@echo "not implemented"

eval:
	node mplad-app/lib/pipeline/eval.js --db mplad-app/data/app.db --out reports/eval_dev.json

eval-locked:
	node mplad-app/lib/pipeline/eval.js --db mplad-app/data/app.db --out reports/eval_LOCKED.json --locked

tune:
	@echo "not implemented"
