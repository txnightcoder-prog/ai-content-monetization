@echo off
title TxNightCoder Video Pipeline
echo ============================================
echo  TxNightCoder Daily Video Pipeline
echo  %DATE% %TIME%
echo ============================================
echo.

cd /d "%~dp0"

REM Activate environment and run
python daily_pipeline.py

echo.
echo ============================================
echo  Done! Check dashboard to approve videos.
echo  https://ashy-smoke-08a45730f.7.azurestaticapps.net
echo ============================================
pause
