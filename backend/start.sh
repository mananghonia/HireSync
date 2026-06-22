#!/bin/bash
set -e

echo "Running migrations..."
python manage.py migrate; true

echo "Collecting static files..."
python manage.py collectstatic --noinput; true

echo "Starting daphne on port ${PORT:-8000}..."
exec daphne -b 0.0.0.0 -p ${PORT:-8000} hiresync.asgi:application
