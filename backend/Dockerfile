# 빌드 맥락은 저장소 루트 (db/migrations, data/seed 를 함께 쓴다)
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/src ./src
RUN uv sync --frozen --no-dev
COPY db /app/db
COPY data/seed /app/data/seed
ENV PATH="/app/backend/.venv/bin:$PATH"
EXPOSE 8000
CMD ["sh", "-c", "rfp-db migrate && rfp-db seed-rules && uvicorn rfp_agent.api.main:app --host 0.0.0.0 --port 8000"]
