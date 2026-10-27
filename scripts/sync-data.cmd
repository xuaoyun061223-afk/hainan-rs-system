@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
python "%~dp0sync_data.py" %*
echo.
pause
