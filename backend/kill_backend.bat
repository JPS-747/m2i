@echo off
REM Kill the Python/uvicorn backend server
taskkill /F /IM python.exe
echo Backend server terminated.
pause
