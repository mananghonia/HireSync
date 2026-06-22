FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN mkdir -p /app/staticfiles && \
    DJANGO_SETTINGS_MODULE=hiresync.settings_dev \
    MONGODB_URI="" \
    python manage.py collectstatic --noinput

EXPOSE 8000

COPY start.sh .
RUN chmod +x start.sh

CMD ["bash", "start.sh"]
