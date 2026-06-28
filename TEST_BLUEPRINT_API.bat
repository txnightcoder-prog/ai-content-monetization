@echo off
echo ============================================================
echo   Testing Blueprint API Endpoints
echo ============================================================
echo.

echo [1/3] Testing Health Check...
curl -X GET http://localhost:8020/health
echo.
echo.

echo [2/3] Testing Topic Ideas Endpoint...
curl -X POST http://localhost:8020/api/v1/scripts/topic-ideas ^
  -H "Content-Type: application/json" ^
  -d "{\"niche\": \"AI tools\"}"
echo.
echo.

echo [3/3] Testing Blueprint Endpoint...
curl -X POST http://localhost:8020/api/v1/scripts/blueprint ^
  -H "Content-Type: application/json" ^
  -d "{\"instructions\": \"Create a video about AI tools for passive income\", \"niche\": \"AI tools\"}"
echo.
echo.

echo ============================================================
echo   API Tests Complete
echo ============================================================
pause

@REM Made with Bob
