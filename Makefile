# Makefile for CanvasFlow
# =====================================

# Optional: specify a single service, e.g. make build SERVICE=backend
SERVICE ?=

SEPARATOR := ────────────────────────────────────────────────────────────────────────────────

.PHONY: help build up down restart migrate deploy logs status clean sync-submodules lint format

# Default target
.DEFAULT_GOAL := help

help: ## 显示帮助信息
	@echo "CanvasFlow 项目命令"
	@echo "====================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "示例:"
	@echo "  make deploy              - Docker Compose 构建并部署"
	@echo "  make build SERVICE=backend - 构建单个服务镜像"
	@echo "  make logs SERVICE=backend  - 查看单个服务日志"
	@echo ""

# ─────────────────────────────────────────────────────
# 数据库迁移
# ─────────────────────────────────────────────────────

migrate: ## 执行数据库迁移
	@echo "🗄️  执行数据库迁移..."
	@cd backend && uv run alembic upgrade head
	@echo "✅ 迁移完成!"

migrate-gen: ## 生成迁移脚本 (用法: make migrate-gen MSG="描述")
	@echo "🗄️  生成迁移脚本..."
	@cd backend && uv run alembic revision --autogenerate -m "$(MSG)"
	@echo "✅ 迁移脚本已生成!"

# ─────────────────────────────────────────────────────
# Git 子模块
# ─────────────────────────────────────────────────────

sync-submodules: ## 同步 git 子模块
	@echo "📦 同步 git 子模块..."
	@git submodule update --init --recursive
	@echo "✅ 子模块同步完成!"

# ─────────────────────────────────────────────────────
# Docker Compose 部署
# ─────────────────────────────────────────────────────

build: ## 构建 Docker 镜像
	@echo "🔨 构建 Docker 镜像..."
	@docker compose build $(SERVICE)
	@echo "✅ 构建完成!"

up: ## 启动 Docker 服务
	@echo "🚀 启动服务..."
	@docker compose up -d --wait $(SERVICE)
	@echo "✅ 服务已启动!"

down: ## 停止 Docker 服务
	@echo "⏹️  停止服务..."
ifdef SERVICE
	@docker compose stop $(SERVICE)
	@docker compose rm -f $(SERVICE)
else
	@docker compose down
endif
	@echo "✅ 服务已停止."

restart: ## 重启 Docker 服务
	@echo "🔄 重启服务..."
ifdef SERVICE
	@docker compose restart $(SERVICE)
else
	@docker compose down
	@docker compose up -d --wait
endif
	@echo "✅ 服务已重启!"

deploy: ## 完整部署 (构建 + 迁移 + 启动)
	@echo "🚀 部署 CanvasFlow..."
	@echo ""
	@echo "Step 1: 构建镜像..."
	@docker compose build $(SERVICE)
	@echo ""
	@echo "Step 2: 启动服务..."
	@docker compose up -d --wait $(SERVICE)
	@echo ""
	@echo "Step 3: 执行数据库迁移..."
	@docker compose exec backend uv run alembic upgrade head
	@echo ""
	@echo "✅ 部署完成!"
	@echo ""
	@echo "运行 'make status' 查看服务状态"
	@echo "运行 'make logs' 查看服务日志"

logs: ## 查看服务日志 (跟踪模式)
	@echo "📋 跟踪服务日志..."
	@echo "   (按 Ctrl+C 停止)"
	@echo ""
	@trap '' INT; docker compose logs -f $(SERVICE); true

status: ## 查看服务状态
	@echo ""
	@echo "  📦 容器运行状态:"
	@echo "  $(SEPARATOR)"
	@docker compose ps -a --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo "  未找到服务"
	@echo ""
	@echo ""
	@echo "  🏥 健康检查状态:"
	@echo "  $(SEPARATOR)"
	@running_svcs=$$(docker compose ps -a --format '{{.Service}}' 2>/dev/null); \
	all_svcs=$$(docker compose config --services 2>/dev/null); \
	for svc in $$all_svcs; do \
		if echo "$$running_svcs" | grep -qx "$$svc"; then \
			status=$$(docker compose ps -a --format '{{.Service}}|||{{.Status}}' 2>/dev/null | grep "^$$svc|||" | head -1 | cut -d'|' -f4-); \
			health="无健康检查"; \
			running="❌"; \
			run_text="已停止"; \
			if echo "$$status" | grep -qi "up"; then \
				running="✅"; \
				run_text="运行中"; \
			fi; \
			if echo "$$status" | grep -qi "healthy"; then \
				health="健康"; \
			elif echo "$$status" | grep -qi "unhealthy"; then \
				health="不健康"; \
			elif echo "$$status" | grep -qi "health"; then \
				health="启动中"; \
			fi; \
			printf '  %s %-18s %-10s %s\n' "$$running" "$$svc" "$$run_text" "$$health"; \
		else \
			printf '  %s %-18s %-10s %s\n' "❌" "$$svc" "未启动" "不健康"; \
		fi; \
	done
	@echo ""
	@echo ""
	@echo "  📌 常用命令:"
	@echo "  $(SEPARATOR)"
	@echo "  make build       构建镜像          make status    查看状态"
	@echo "  make up          启动服务          make logs      查看日志"
	@echo "  make down        停止服务          make clean     清理资源"
	@echo "  make restart     重启服务          make deploy    构建并部署"
	@echo "  make migrate     数据库迁移        make lint      代码检查"
	@echo ""
	@echo "  💡 支持 SERVICE=xxx 指定单个服务, 例: make logs SERVICE=backend"
	@echo ""

clean: ## 停止服务并清理镜像和卷
	@echo "🧹 清理 CanvasFlow 资源..."
	@docker compose down -v --rmi local
	@echo "✅ 清理完成!"

lint: ## 运行代码检查 (后端 ruff + 前端 tsc)
	@echo "🔍 检查后端代码..."
	@cd backend && uv run ruff check .
	@echo ""
	@echo "🔍 检查前端类型..."
	@cd frontend && npx tsc --noEmit
	@echo ""
	@echo "✅ 检查通过!"

format: ## 格式化后端代码
	@echo "✨ 格式化后端代码..."
	@cd backend && uv run ruff format .
	@echo "✅ 格式化完成!"
