FROM python:3.12-slim

WORKDIR /app

COPY server.py index.html styles.css threads.css ./
COPY src ./src
COPY functions ./functions

ENV HOST=0.0.0.0 \
    PORT=8765 \
    PYTHONUNBUFFERED=1

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/index.html')"

CMD ["python", "server.py"]
