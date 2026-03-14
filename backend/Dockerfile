FROM python:3.12-slim

WORKDIR /app

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 先复制依赖文件，利用 Docker 缓存
COPY pyproject.toml uv.lock ./

# 安装依赖
RUN uv sync --frozen --no-dev --no-install-project

# 复制源代码
COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini .

# 安装项目本身
RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "canvasflow.main:app", "--host", "0.0.0.0", "--port", "8000"]
