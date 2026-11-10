# PayFlow — AWS Deployment Guide

## Prerequisites

- AWS CLI configured with appropriate IAM credentials
- Docker installed for building and pushing images
- AWS account with the following services available:
  - RDS (PostgreSQL 16)
  - ElastiCache (Redis 7)
  - ECS (Fargate)
  - ECR (Container Registry)
  - ALB (Application Load Balancer)
  - CloudWatch Logs
  - Secrets Manager

## Infrastructure Setup

### 1. Database — AWS RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier payflow-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username payflow_admin \
  --master-user-password "<SECURE_PASSWORD>" \
  --allocated-storage 20 \
  --vpc-security-group-ids "<SG_ID>" \
  --db-subnet-group-name "<SUBNET_GROUP>" \
  --no-publicly-accessible
```

Update `DATABASE_URL` in Secrets Manager once the RDS endpoint is available:
```
postgresql://payflow_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/payflow?sslmode=require
```

### 2. Cache — AWS ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id payflow-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --engine-version 7.0
```

### 3. Secrets Manager

Store all secrets in a single Secrets Manager secret:

```bash
aws secretsmanager create-secret \
  --name payflow/production \
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "JWT_SECRET": "<STRONG_SECRET>",
    "REDIS_URL": "redis://<ELASTICACHE_ENDPOINT>:6379",
    "KAFKA_BROKERS": "<MSK_BOOTSTRAP_SERVERS>"
  }'
```

### 4. ECR Repository

```bash
aws ecr create-repository --repository-name payflow
```

### 5. Build and Push Docker Image

```bash
aws ecr get-login-password | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

docker build -t payflow .
docker tag payflow:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/payflow:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/payflow:latest
```

### 6. ECS Service

Register the task definition from `aws/ecs-task-definition.json` (replace placeholder variables first), then create a service:

```bash
aws ecs register-task-definition --cli-input-json file://aws/ecs-task-definition.json
aws ecs create-service \
  --cluster payflow-cluster \
  --service-name payflow-api \
  --task-definition payflow-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<SUBNET_IDS>],securityGroups=[<SG_ID>],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=<TG_ARN>,containerName=payflow-api,containerPort=3000" \
  --health-check-grace-period-seconds 30
```

### 7. ALB + Health Checks

Configure the ALB target group health check:
- Path: `/health`
- Healthy threshold: 2
- Unhealthy threshold: 3
- Interval: 15s

Readiness endpoint for deployment gates: `/ready`

## Running Migrations in Production

Run migrations from a one-off ECS task or from within a bastion host connected to the VPC:

```bash
DATABASE_URL="<RDS_CONNECTION_STRING>" npm run migrate
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing key (min 32 chars) |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `production` / `development` / `test` |
| `REDIS_URL` | No | Redis connection string (default: `redis://localhost:6379`) |
| `KAFKA_BROKERS` | No | Comma-separated Kafka broker addresses |
| `KAFKA_CLIENT_ID` | No | Kafka client ID (default: `payflow`) |

## Monitoring

- **CloudWatch Logs**: `/ecs/payflow-api` log group with structured JSON logs from pino
- **Health**: `GET /health` returns uptime and timestamp
- **Readiness**: `GET /ready` checks PostgreSQL connectivity and Redis status

