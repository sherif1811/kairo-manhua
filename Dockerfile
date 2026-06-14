# ---- Stage 1: Build stage ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies needed for building native packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ---- Stage 2: Runtime stage ----
FROM python:3.11-slim

WORKDIR /app

# Copy installed Python packages from builder stage
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Install system dependencies for PaddleOCR and Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browser and its dependencies
RUN playwright install --with-deps chromium

# Add /app to PYTHONPATH to avoid ModuleNotFoundError in Celery
ENV PYTHONPATH=/app

# Copy application code
COPY . .

# Create directories for data persistence
RUN mkdir -p /app/image_cache /app/uploads

# Expose Flask app port and translation server port
EXPOSE 8000 8001

# Default command: run Flask app with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "flask_app:app"]
