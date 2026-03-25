# .env を読み込む（存在する場合のみ）
-include .env
export

# ===== AWS 設定（.env または上書きで指定） =====
AWS_ACCOUNT  ?= $(shell aws sts get-caller-identity --query Account --output text)
ECR_REPO     ?= $(AWS_ACCOUNT).dkr.ecr.$(AWS_REGION).amazonaws.com/ai-shiritori

COMPOSE = $(COMPOSE) -f deploy/docker-compose.yml

.PHONY: build up down restart logs ps \
        setup db-migrate db-seed db-reset \
        bash console bundle exec \
        deploy ecr-login push ecs-deploy

# ===== 基本操作 =====

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

# ===== セットアップ =====

setup: build up db-migrate db-seed

db-migrate:
	$(COMPOSE) exec web bundle exec rails db:migrate

db-seed:
	$(COMPOSE) exec web bundle exec rails db:seed

db-reset:
	$(COMPOSE) exec web bundle exec rails db:reset

# ===== 開発ユーティリティ =====

bash:
	$(COMPOSE) exec web bash

console:
	$(COMPOSE) exec web bundle exec rails console

bundle:
	$(COMPOSE) exec web bundle install

# 任意のコマンドを実行: make exec CMD="rails routes"
exec:
	$(COMPOSE) exec web $(CMD)

# ===== デプロイ（AWS ECS + ECR） =====

# ECR にログイン
ecr-login:
	aws ecr get-login-password --region $(AWS_REGION) | \
	  docker login --username AWS --password-stdin $(AWS_ACCOUNT).dkr.ecr.$(AWS_REGION).amazonaws.com

# イメージをビルドして ECR へ push
push: ecr-login
	docker build -f deploy/Dockerfile -t $(ECR_REPO):$(IMAGE_TAG) .
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
