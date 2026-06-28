#!/bin/bash
# Startup script for Azure App Service (Linux)
# Runs once when the container starts — installs FFmpeg then starts the web server

echo "=== TxNightCoder Pipeline Startup ==="

# Install FFmpeg if not present
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing FFmpeg..."
    apt-get update -qq && apt-get install -y -qq ffmpeg fonts-dejavu-core fonts-liberation
    echo "FFmpeg installed: $(ffmpeg -version 2>&1 | head -1)"
else
    echo "FFmpeg already installed: $(ffmpeg -version 2>&1 | head -1)"
fi

# Install Python packages
echo "Installing Python packages..."
pip install -q flask gunicorn openai httpx python-dotenv gTTS Pillow azure-storage-blob

# Start the web server
echo "Starting pipeline server..."
cd /home/site/wwwroot
gunicorn server:app --bind 0.0.0.0:8080 --workers 1 --timeout 600 --log-level info
