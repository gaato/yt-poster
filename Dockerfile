FROM python:3.11-alpine

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Copy project files
COPY ./pyproject.toml /app/pyproject.toml
COPY ./uv.lock* /app/

# Install dependencies
RUN uv sync --frozen

COPY ./src /app

ENTRYPOINT ["uv", "run", "python", "main.py"]
