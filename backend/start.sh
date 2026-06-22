#!/bin/bash

echo "Running migrations..."
python manage.py migrate || true

echo "Starting daphne on port 8000..."
exec daphne -b 0.0.0.0 -p 8000 hiresync.asgi:application
