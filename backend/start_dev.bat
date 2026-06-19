@echo off
set DJANGO_SETTINGS_MODULE=hiresync.settings_dev
cd /d "d:\Hiring\HireSync\backend"
.\venv\Scripts\python manage.py runserver 8000
