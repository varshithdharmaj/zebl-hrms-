# ZEBL_AMS — AWS Staging Deployment (150–200 users)

Target architecture for staging and controlled production:

| Layer | Service |
|-------|---------|
| App | ECS Fargate (1–2 tasks) behind ALB (HTTPS) |
| Database | RDS PostgreSQL (automated backups + PITR) |
| Files | S3 private bucket (`RECRUITMENT_STORAGE_DRIVER=s3`) |
| Email | Amazon SES SMTP |
| Workers | EventBridge schedule → ALB → `/api/*/process` |
| Secrets | AWS Secrets Manager / SSM Parameter Store |
| Logs | CloudWatch Logs |

Do **not** use local filesystem storage on multi-instance ECS.

---

## 1. Prerequisites

- AWS account + VPC with private subnets for RDS/ECS
- ACM certificate for HTTPS on ALB
- ECR repository for the app image
- Separate **staging** resources from production (DB, bucket, secrets, SSO app registration)

---

## 2. Database

1. Create RDS PostgreSQL 16 (Single-AZ OK for staging; Multi-AZ for production).
2. Enable automated backups (7–14 days) and confirm PITR is available.
3. Set connection strings:

```env
# App / ECS task — pooled if using RDS Proxy / PgBouncer
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/zebl_ams?sslmode=require
DATABASE_POOL_MAX=5

# Migrations — direct (non-pooler) connection
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/zebl_ams?sslmode=require
```

4. From a trusted runner (CI or bastion):

```bash
npx prisma migrate deploy
# Optional seed for staging only — never seed production with demo data
# npm run db:seed
```

5. **Restore drill (required before go-live):** restore a snapshot to a scratch instance and verify `SELECT 1` + login works.

---

## 3. Object storage (S3)

```env
RECRUITMENT_STORAGE_DRIVER=s3
RECRUITMENT_S3_BUCKET=zebl-ams-staging-recruitment
RECRUITMENT_S3_REGION=ap-southeast-1
RECRUITMENT_S3_PREFIX=recruitment
```

Attach an IAM task role with least privilege: `s3:GetObject`, `PutObject`, `DeleteObject`, `HeadObject` on that bucket/prefix.

Block public access on the bucket.

---

## 4. Build & run the container

```bash
docker build -t zebl-ams:staging .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=... \
  -e DIRECT_URL=... \
  -e AUTH_SECRET=... \
  -e APP_BASE_URL=https://ams-staging.example.com \
  -e RECRUITMENT_STORAGE_DRIVER=s3 \
  -e RECRUITMENT_S3_BUCKET=... \
  -e AWS_REGION=ap-southeast-1 \
  -e TZ=Asia/Kolkata \
  zebl-ams:staging
```

The Dockerfile already sets `TZ=Asia/Kolkata`, but ECS task definitions and
any `docker run` invocation should set it explicitly too — attendance,
leave, and payroll date logic assumes the process's local timezone is IST.
Running the container in UTC shifts "today" by up to ~5.5h around IST
midnight, so live biometric check-ins near that window can appear on the
dashboard under the wrong day.

Push to ECR and register the task definition skeleton at
[`deploy/ecs/task-definition.staging.json`](../deploy/ecs/task-definition.staging.json)
(replace `ACCOUNT_ID` / `REGION` / secret ARNs), then create an ECS service with:

- Desired count: 1 (staging) / 2 (production)
- ALB target group health check: `GET /api/health`
- CPU 512 / memory 1024 as a starting point
- Task role with S3 object permissions on the recruitment bucket/prefix

---

## 5. Environment checklist (staging)

```env
NODE_ENV=production
TZ=Asia/Kolkata
APP_BASE_URL=https://ams-staging.example.com
DATABASE_URL=...
DIRECT_URL=...
AUTH_SECRET=...                 # 32+ random chars
DATABASE_POOL_MAX=5
AUTH_SSO_AUTO_LINK=false
AUTH_SSO_AUTO_PROVISION=false
SMTP_HOST=email-smtp.<region>.amazonaws.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM=noreply@example.com
NOTIFICATION_CRON_SECRET=...
INTEGRATION_CRON_SECRET=...
ANALYTICS_CRON_SECRET=...
RECRUITMENT_MODULE_ENABLED=true
RECRUITMENT_STORAGE_DRIVER=s3
RECRUITMENT_S3_BUCKET=...
RECRUITMENT_S3_REGION=...
```

Microsoft Entra: use a **separate** app registration / redirect URI for staging.

---

## 6. EventBridge workers

Schedule HTTP targets (or ECS run-task) every 1–5 minutes:

| Schedule | Endpoint | Header |
|----------|----------|--------|
| rate(1 minute) | `POST /api/notifications/process` | `Authorization: Bearer $NOTIFICATION_CRON_SECRET` |
| rate(5 minutes) | `POST /api/integrations/process` | `Authorization: Bearer $INTEGRATION_CRON_SECRET` |
| rate(15 minutes) | `POST /api/analytics/process` | `Authorization: Bearer $ANALYTICS_CRON_SECRET` |

Verify a test leave/approval email is delivered via SES.

---

## 7. Health & ops

| Endpoint | Use |
|----------|-----|
| `GET /api/health` | ALB / public liveness (DB ping only) |
| `GET /api/health/deep` | Ops only (cron secret or admin) |
| `/admin/operations` | In-app worker/queue view |

Watch CloudWatch for JSON logs with `"message":"timing"` (e.g. `recruitment.dashboard.load`).

---

## 8. Staging smoke checklist

- [ ] Login / logout (JWT rejected after logout)
- [ ] Attendance check-in / check-out
- [ ] Leave apply + approve
- [ ] Candidate create + document upload/download (S3)
- [ ] Offer create → send → accept → convert
- [ ] Notification email received
- [ ] `/api/health` 200 behind ALB

---

## 9. Rollback

1. Redeploy previous ECS task definition revision.
2. If a migration is unsafe: restore RDS to pre-migrate snapshot (restore drill proves this path).
