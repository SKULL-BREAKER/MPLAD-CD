FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and data
COPY backend/ ./backend/
COPY app/ ./app/
COPY backend/static/ ./backend/static/
COPY data/app.db ./data/app.db
COPY reports/eval_dev.json ./reports/eval_dev.json
COPY config/ ./config/

# Runtime
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
