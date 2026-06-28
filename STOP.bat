@echo off
title AI Content Monetization - Stop
color 0C

echo.
echo ========================================
echo   AI Content Monetization
echo   Stopping All Services
echo ========================================
echo.

echo Stopping Python processes (Backend)...
taskkill /F /IM python.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Backend stopped
) else (
    echo [INFO] No backend process found
)

echo.
echo Stopping Node processes (Frontend)...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Frontend stopped
) else (
    echo [INFO] No frontend process found
)

echo.
echo Closing old Windows Terminal windows...
taskkill /F /IM WindowsTerminal.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Old terminal windows closed
) else (
    echo [INFO] No terminal windows found
)

echo.
echo ========================================
echo   All Services Stopped
echo ========================================
echo.
echo You can now close this window.
echo.
pause

@REM Made with Bob