# Terraform Infrastructure

This Terraform stack provisions a production-oriented AWS deployment for the ADHD Autism Platform.

## Assumptions

- Runtime platform: ECS Fargate
- Container registry: ECR
- Database: PostgreSQL on RDS
- Public ingress: Application Load Balancer
- Services:
  - `frontend` exposed publicly
  - `backend` exposed publicly for `/api/*` and `/health`
  - `ai-workers` runs privately without a load balancer

## Layout

- `environments/dev/` lower-cost development stack
- `environments/staging/` pre-production validation stack
- `environments/prod/` root production stack
- `modules/networking/` VPC, subnets, routes, and NAT
- `modules/ecr/` ECR repositories
- `modules/alb/` Application Load Balancer and target groups
- `modules/ecs-cluster/` ECS cluster, task execution role, and logging
- `modules/ecs-service/` reusable ECS service and task definition
- `modules/rds/` PostgreSQL instance and subnet group

## Quick start

1. Choose an environment folder such as `environments/dev`, `environments/staging`, or `environments/prod`
2. Copy that folder's `terraform.tfvars.example` to `terraform.tfvars`
3. Fill in AWS values such as region, account-specific image tags, and database credentials
4. Run `terraform init`
5. Run `terraform plan`
6. Run `terraform apply`

## Notes

- The ECS task definitions expect image URIs built from the ECR repositories created by this stack.
- The backend service is configured with the RDS endpoint and database name.
- The worker service is wired to the backend internal URL through ECS service discovery-friendly environment variables you can extend later.
