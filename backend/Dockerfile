FROM python:3.11-slim

WORKDIR /app

# Install system build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and data
COPY . .

# Set Python path so src.main resolves
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Start Uvicorn dynamically binding to $PORT (required by Render) or fallback to 8000
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
