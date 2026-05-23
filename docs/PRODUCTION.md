# Neuro Flow — production deployment

## Pre-deploy checklist

- [ ] `ENVIRONMENT=production`
- [ ] PostgreSQL `DATABASE_URL` (not SQLite)
- [ ] **Auth0**: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` (API identifier), frontend `AUTH0_*` SDK vars
- [ ] Auth0 API: enable **email** in access tokens (Action or RBAC)
- [ ] Provision users in Auth0 with same email as `users` table (`node scripts/setup-auth0.js`)
- [ ] HTTPS `FRONTEND_URL` and `PLATFORM_BASE_URL`
- [ ] `EXTRA_CORS_ORIGINS` set to your public origins only
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` if billing enabled
- [ ] `ENABLE_LEGACY_WOOCOMMERCE_WEBHOOK=false`
- [ ] SendGrid (or email provider) configured
- [ ] Secrets in AWS Secrets Manager / SSM — not plain text in task defs
- [ ] ALB HTTPS listener + ACM certificate
- [ ] Health: ALB → `/health` (liveness), `/ready` (readiness + DB)

## Startup validation

The API **refuses to start** in production if:

- Auth0 is not configured (`AUTH0_DOMAIN` + `AUTH0_AUDIENCE`)
- Default/dev webhook secrets are used
- SQLite is configured
- URLs use `http://` or `localhost`
- Legacy WooCommerce webhooks are enabled
- Stripe is configured without a webhook secret

## Security defaults in production

| Item | Behavior |
|------|----------|
| OpenAPI `/docs` | Disabled |
| Demo routes (`/assessments`, `/billing`, `/api-keys`, `/checkout`) | Not mounted |
| Webhook test endpoints | 404 |
| `GET /forms/client/{id}` | Requires auth + tenant isolation |
| `GET /system/status` | Super-platform-admin only |
| Stripe subscription webhook | Signature required |
| CORS | No localhost origins |
| Cookies | `Secure` flag when behind HTTPS |

## Database

Use PostgreSQL with the provided driver:

```env
DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/neuroflow
```

Run migrations (Alembic) before first deploy; `create_all` is a fallback for dev only.

## Docker

```bash
docker compose -f docker-compose.prod.yml up --build
```

Set `JWT_SECRET` in the shell or a `.env` file next to the compose file.

## Smoke test

```bash
curl -s http://localhost:8004/health
curl -s http://localhost:8004/ready
```

## Multi-tenancy

Every clinic row is scoped by `clinic_id`. Verify isolation after deploy with two org admin accounts.
