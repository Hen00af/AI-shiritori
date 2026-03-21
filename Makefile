# .env を読み込む（存在する場合のみ）
-include .env
export

# ===== AWS 設定（.env または上書きで指定） =====
AWS_ACCOUNT  ?= $(shell aws sts get-caller-identity --query Account --output text)
ECR_REPO     ?= $(AWS_ACCOUNT).dkr.ecr.$(AWS_REGION).amazonaws.com/ai-shiritori

.PHONY: build up down restart logs ps \
        setup db-migrate db-seed db-reset \
        bash console bundle exec \
        deploy ecr-login push ecs-deploy

# ===== 基本操作 =====

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

# ===== セットアップ =====

setup: build up db-migrate db-seed

db-migrate:
	docker compose exec web bundle exec rails db:migrate

db-seed:
	docker compose exec web bundle exec rails db:seed

db-reset:
	docker compose exec web bundle exec rails db:reset

# ===== 開発ユーティリティ =====

bash:
	docker compose exec web bash

console:
	docker compose exec web bundle exec rails console

bundle:
	docker compose exec web bundle install

# 任意のコマンドを実行: make exec CMD="rails routes"
exec:
	docker compose exec web $(CMD)

# ===== デプロイ（AWS ECS + ECR） =====

# ECR にログイン
ecr-login:
	aws ecr get-login-password --region $(AWS_REGION) | \
	  docker login --username AWS --password-stdin $(AWS_ACCOUNT).dkr.ecr.$(AWS_REGION).amazonaws.com

# イメージをビルドして ECR へ push
push: ecr-login
	docker build -t $(ECR_REPO):$(IMAGE_TAG) .
	docker push $(ECR_REPO):$(IMAGE_TAG)

# ECS サービスを最新イメージで再デプロイ
ecs-deploy:
	aws ecs update-service \
	  --region $(AWS_REGION) \
	  --cluster $(ECS_CLUSTER) \
	  --service $(ECS_SERVICE) \
	  --force-new-deployment

# ビルド → push → ECS 再デプロイ を一括実行
deploy: push ecs-deploy
