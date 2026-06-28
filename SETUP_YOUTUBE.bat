@echo off
echo ========================================
echo YouTube API Setup Helper
echo ========================================
echo.
echo This script will:
echo 1. Install required Python packages
echo 2. Run the token generator
echo.
pause
echo.
echo [1/2] Installing required packages...
echo.
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client
echo.
echo [2/2] Starting token generator...
echo.
python get_youtube_token.py
echo.
pause

@REM Made with Bob
