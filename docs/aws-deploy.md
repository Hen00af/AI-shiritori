# AWS deployment

このアプリは Rails 8 + Action Cable を使っているため、AWS では `ECS Fargate + ALB + EFS + ElastiCache Redis` の単一タスク構成が一番無理がありません。

## 推奨構成

- `ECR`: アプリイメージ保管
- `ECS Fargate`: Rails/Puma コンテナ実行
- `ALB`: HTTPS 終端と WebSocket 中継
- `EFS`: `storage/` を永続化し、SQLite と Active Storage の保存先に使う
- `ElastiCache for Redis`: Action Cable 用
- `Secrets Manager` または `SSM Parameter Store`: `RAILS_MASTER_KEY` や `GEMINI_API_KEY` などを保存

この構成は 1 タスク前提です。SQLite と Solid Queue を使っているので、タスクを複数台に増やすなら RDS/PostgreSQL への移行を先にやってください。

## 必須環境変数

- `RAILS_ENV=production`
- `RAILS_MASTER_KEY`
- `SECRET_KEY_BASE`
- `APP_HOST`
- `APP_PROTOCOL=https`
- `REDIS_URL`
- `SOLID_QUEUE_IN_PUMA=true`
- `DATABASE_URL=sqlite3:/rails/storage/production.sqlite3`
- `ACTIVE_STORAGE_SERVICE=local`
- `GEMINI_API_KEY`

## デプロイ手順

1. ECR リポジトリを作る
2. Docker イメージをビルドして ECR に push する
3. EFS を作成し、ECS タスクに `/rails/storage` としてマウントする
4. ElastiCache for Redis を作成し、`REDIS_URL` を設定する
5. ALB を作成し、ECS サービスをぶら下げる
6. ECS タスク定義に上の環境変数と Secret を設定する
7. ヘルスチェックパスを `/up` にする

## 例: ローカルから ECR へ push

```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t ai-shiritori .
docker tag ai-shiritori:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/ai-shiritori:latest
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/ai-shiritori:latest
```

## ECS タスク定義での注意

- コンテナポートは `3000`
- 起動コマンドは Dockerfile のデフォルトのままでよい
- `bin/docker-entrypoint` が起動時に `db:prepare` を実行する
- ALB 側は HTTP/1.1 を使う
- `/cable` を通すため、ALB の idle timeout はデフォルトより長めにしておくと安定しやすい

## スケールに関する注意

今の実装では SQLite を使っているため、ECS サービスの desired count を 2 以上にすると整合性とジョブ実行で問題が出ます。複数タスク構成にしたい場合は次を先に対応してください。

- `pg` gem を追加して `DATABASE_URL` を PostgreSQL に変更する
- 本番 DB を RDS PostgreSQL に移行する
- Queue/Cache/Cable の永続化戦略を PostgreSQL/Redis ベースに統一する
