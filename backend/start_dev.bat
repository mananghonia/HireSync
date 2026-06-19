@echo off
set DJANGO_SETTINGS_MODULE=hiresync.settings_dev
cd /d "d:\Hiring\HireSync\backend"
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do set %%A=%%B
)
.\venv\Scripts\python manage.py runserver 8000
