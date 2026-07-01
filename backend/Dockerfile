FROM python:3.12-slim

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
# data/ is intentionally NOT copied (gitignored bulk exports). The app runs in
# sample-data mode unless DATA_DIR points at a mounted disk holding real
# DLD/KHDA files. See DEPLOY.md.

EXPOSE 8000

# Honour the platform's $PORT (Render/Railway set it); default 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
