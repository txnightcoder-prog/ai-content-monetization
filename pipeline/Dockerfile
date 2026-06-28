FROM python:3.11-slim

# ── System packages: FFmpeg + fonts (required for video rendering) ─────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ──────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies ────────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir \
    openai==1.57.4 \
    httpx==0.28.1 \
    python-dotenv==1.0.1 \
    gTTS==2.5.3 \
    Pillow==11.2.1 \
    azure-storage-blob==12.25.1 \
    azure-functions==1.21.3

# ── Copy pipeline code ─────────────────────────────────────────────────────────
COPY daily_pipeline.py .
COPY video_generator.py .
COPY function_app.py .
COPY host.json .

# ── Run the pipeline once and exit ────────────────────────────────────────────
CMD ["python", "daily_pipeline.py"]
