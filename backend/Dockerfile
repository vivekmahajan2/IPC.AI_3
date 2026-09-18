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

# Expose port
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "backend.src.main:app", "--host", "0.0.0.0", "--port", "8000"]
