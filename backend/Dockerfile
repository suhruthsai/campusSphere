# Build from the repository root:
#   docker build -f backend/Dockerfile -t campussphere-backend .
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PORT=8000

WORKDIR /code

COPY ./backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./backend /code/backend

# Run as an unprivileged user; it owns /code so media uploads can be written
RUN useradd --create-home appuser && chown -R appuser /code
USER appuser

EXPOSE 8000

# Most hosts (Render, Railway, Fly, Cloud Run) inject $PORT
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
