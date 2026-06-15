@echo off
echo Starting SkipStep Django Server...
call .venv\Scripts\activate.bat
echo Checking dependencies...
python -m pip install -r requirements.txt >nul 2>&1
python manage.py runserver
pause
