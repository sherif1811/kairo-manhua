FROM python:3.11-slim

WORKDIR /app

# Install OS dependencies
RUN apt-get update && apt-get install -y \
    wget gnupg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright dependencies
RUN playwright install chromium
RUN playwright install-deps

# Copy application files
COPY . .

# Expose port (Gunicorn will run on 8000)
EXPOSE 8000

CMD gunicorn -w 4 --threads 4 -b 0.0.0.0:8000 --timeout 120 flask_app:app
