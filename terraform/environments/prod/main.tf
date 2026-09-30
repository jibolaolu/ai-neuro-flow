locals {
  name_prefix       = "${var.project_name}-${var.environment}"
  frontend_hostname = var.frontend_domain
  api_hostname      = var.api_domain
  frontend_url      = "https://${local.frontend_hostname}"
  api_url           = "https://${local.api_hostname}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# â”€â”€ Networking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
module "networking" {
  source = "../../modules/networking"

  name_prefix               = local.name_prefix
  vpc_cidr                  = var.vpc_cidr
  availability_zones        = var.availability_zones
  public_subnet_cidrs       = var.public_subnet_cidrs
  private_app_subnet_cidrs  = var.private_app_subnet_cidrs
  private_data_subnet_cidrs = var.private_data_subnet_cidrs
  tags                      = local.common_tags
}

# â”€â”€ ECR repositories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
module "ecr" {
  source = "../../modules/ecr"

  name_prefix  = local.name_prefix
  repositories = ["frontend", "backend", "ai-workers"]
  tags         = local.common_tags
}

# â”€â”€ ECS cluster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
module "ecs_cluster" {
  source = "../../modules/ecs-cluster"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

# â”€â”€ Security groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "ALB - public HTTP and HTTPS ingress"
  vpc_id      = module.networking.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-alb-sg" })
}

resource "aws_security_group" "frontend_service" {
  name        = "${local.name_prefix}-frontend-sg"
  description = "Frontend ECS service - ingress from ALB only"
  vpc_id      = module.networking.vpc_id

  ingress {
    description     = "Frontend from ALB"
    from_port       = var.frontend_container_port
    to_port         = var.frontend_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-frontend-sg" })
}

resource "aws_security_group" "backend_service" {
  name        = "${local.name_prefix}-backend-sg"
  description = "Backend ECS service - ingress from ALB and AI workers"
  vpc_id      = module.networking.vpc_id

  ingress {
    description     = "Backend from ALB"
    from_port       = var.backend_container_port
    to_port         = var.backend_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Backend from AI workers"
    from_port       = var.backend_container_port
    to_port         = var.backend_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ai_workers_service.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-backend-sg" })
}

resource "aws_security_group" "ai_workers_service" {
  name        = "${local.name_prefix}-workers-sg"
  description = "AI workers - egress only"
  vpc_id      = module.networking.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-workers-sg" })
}

resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-db-sg"
  description = "PostgreSQL - ingress from backend only"
  vpc_id      = module.networking.vpc_id

  ingress {
    description     = "PostgreSQL from backend"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_service.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-db-sg" })
}

# â”€â”€ ACM certificate (covers both frontend and API subdomains) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
resource "aws_acm_certificate" "this" {
  domain_name               = local.frontend_hostname
  subject_alternative_names = [local.api_hostname]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-cert" })
}

data "aws_route53_zone" "this" {
  zone_id = var.route53_zone_id
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.this.zone_id
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# â”€â”€ ALB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
module "alb" {
  source = "../../modules/alb"

  name_prefix             = local.name_prefix
  vpc_id                  = module.networking.vpc_id
  public_subnet_ids       = module.networking.public_subnet_ids
  alb_security_group_id   = aws_security_group.alb.id
  frontend_container_port = var.frontend_container_port
  backend_container_port  = var.backend_container_port
  tags                    = local.common_tags
}

# HTTPS listener (redirects HTTP â†’ HTTPS and forwards to frontend by default)
resource "aws_lb_listener" "https" {
  load_balancer_arn = module.alb.alb_arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.this.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = module.alb.frontend_target_group_arn
  }

  depends_on = [aws_acm_certificate_validation.this]
}

resource "aws_lb_listener_rule" "https_backend_api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = module.alb.backend_target_group_arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health", "/docs", "/redoc", "/openapi.json"]
    }
  }
}

# HTTP â†’ HTTPS redirect
resource "aws_lb_listener_rule" "http_redirect" {
  listener_arn = module.alb.http_listener_arn
  priority     = 1

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }
}

# â”€â”€ RDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
module "rds" {
  source = "../../modules/rds"

  name_prefix            = local.name_prefix
  db_name                = var.db_name
  db_username            = var.db_username
  db_password            = var.db_password
  db_instance_class      = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  subnet_ids             = module.networking.private_data_subnet_ids
  vpc_security_group_ids = [aws_security_group.database.id]
  tags                   = local.common_tags
}

# â”€â”€ S3 uploads bucket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
resource "aws_s3_bucket" "uploads" {
  bucket        = "eagles-${var.environment}-neuroflow-uploads"
  force_destroy = false

  tags = merge(local.common_tags, { DataClassification = "PHI", Compliance = "HIPAA" })
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"
    filter {}
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Grant ECS task role read/write access to the uploads bucket
resource "aws_iam_role_policy" "task_s3_uploads" {
  name = "${local.name_prefix}-task-s3-uploads"
  role = module.ecs_cluster.task_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:HeadObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*",
        ]
      }
    ]
  })
}

# â”€â”€ ECS services â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
module "frontend_service" {
  source = "../../modules/ecs-service"

  name_prefix             = local.name_prefix
  service_name            = "frontend"
  cluster_arn             = module.ecs_cluster.cluster_arn
  task_execution_role_arn = module.ecs_cluster.task_execution_role_arn
  task_role_arn           = module.ecs_cluster.task_role_arn
  subnet_ids              = module.networking.private_app_subnet_ids
  security_group_ids      = [aws_security_group.frontend_service.id]
  desired_count           = var.frontend_desired_count
  cpu                     = var.frontend_task_cpu
  memory                  = var.frontend_task_memory
  container_name          = "frontend"
  container_image         = "${module.ecr.repository_urls["frontend"]}:${var.frontend_image_tag}"
  container_port          = var.frontend_container_port
  assign_public_ip        = false
  enable_load_balancer    = true
  target_group_arn        = module.alb.frontend_target_group_arn
  log_group_name          = module.ecs_cluster.log_group_name
  aws_region              = var.aws_region
  environment_variables = [
    { name = "NEXT_PUBLIC_API_URL", value = local.api_url },
    { name = "BACKEND_URL", value = "http://${local.name_prefix}-backend.${local.name_prefix}.local:${var.backend_container_port}" },
    { name = "NEXT_PUBLIC_PLATFORM_NAME", value = var.platform_display_name },
    { name = "NEXT_PUBLIC_PLATFORM_TAGLINE", value = var.platform_tagline },
    { name = "NEXT_PUBLIC_SUPPORT_EMAIL", value = var.support_email },
    { name = "NODE_ENV", value = "production" },
    { name = "AUTH0_SECRET", value = var.auth0_secret },
    { name = "AUTH0_ISSUER_BASE_URL", value = var.auth0_issuer_base_url },
    { name = "AUTH0_CLIENT_ID", value = var.auth0_client_id },
    { name = "AUTH0_CLIENT_SECRET", value = var.auth0_client_secret },
    { name = "AUTH0_BASE_URL", value = local.frontend_url },
    { name = "AUTH0_AUDIENCE", value = var.auth0_audience },
  ]
  tags = local.common_tags
}

module "backend_service" {
  source = "../../modules/ecs-service"

  name_prefix             = local.name_prefix
  service_name            = "backend"
  cluster_arn             = module.ecs_cluster.cluster_arn
  task_execution_role_arn = module.ecs_cluster.task_execution_role_arn
  task_role_arn           = module.ecs_cluster.task_role_arn
  subnet_ids              = module.networking.private_app_subnet_ids
  security_group_ids      = [aws_security_group.backend_service.id]
  desired_count           = var.backend_desired_count
  cpu                     = var.backend_task_cpu
  memory                  = var.backend_task_memory
  container_name          = "backend"
  container_image         = "${module.ecr.repository_urls["backend"]}:${var.backend_image_tag}"
  container_port          = var.backend_container_port
  assign_public_ip        = false
  enable_load_balancer    = true
  target_group_arn        = module.alb.backend_target_group_arn
  log_group_name          = module.ecs_cluster.log_group_name
  aws_region              = var.aws_region
  environment_variables = [
    { name = "DATABASE_URL", value = "postgresql://${var.db_username}:${var.db_password}@${module.rds.endpoint}/${var.db_name}" },
    { name = "ENVIRONMENT", value = var.environment },
    { name = "JWT_SECRET", value = var.jwt_secret },
    { name = "ANTHROPIC_API_KEY", value = var.anthropic_api_key },
    { name = "ANTHROPIC_MODEL", value = var.anthropic_model },
    { name = "SENDGRID_API_KEY", value = var.sendgrid_api_key },
    { name = "SENDGRID_FROM_EMAIL", value = var.sendgrid_from_email },
    { name = "STRIPE_SECRET_KEY", value = var.stripe_secret_key },
    { name = "STRIPE_WEBHOOK_SECRET", value = var.stripe_webhook_secret },
    { name = "STRIPE_PRICE_STARTER", value = var.stripe_price_starter },
    { name = "STRIPE_PRICE_PROFESSIONAL", value = var.stripe_price_professional },
    { name = "STRIPE_PRICE_ENTERPRISE", value = var.stripe_price_enterprise },
    { name = "PLATFORM_BASE_URL", value = local.frontend_url },
    { name = "FRONTEND_URL", value = local.frontend_url },
    { name = "PLATFORM_DISPLAY_NAME", value = var.platform_display_name },
    { name = "SUPPORT_EMAIL", value = var.support_email },
    { name = "ADMIN_NOTIFICATION_EMAIL", value = var.admin_notification_email },
    { name = "S3_BUCKET_NAME", value = aws_s3_bucket.uploads.bucket },
    { name = "AWS_REGION", value = var.aws_region },
  ]
  tags = local.common_tags
}

module "ai_workers_service" {
  source = "../../modules/ecs-service"

  name_prefix             = local.name_prefix
  service_name            = "ai-workers"
  cluster_arn             = module.ecs_cluster.cluster_arn
  task_execution_role_arn = module.ecs_cluster.task_execution_role_arn
  task_role_arn           = module.ecs_cluster.task_role_arn
  subnet_ids              = module.networking.private_app_subnet_ids
  security_group_ids      = [aws_security_group.ai_workers_service.id]
  desired_count           = var.workers_desired_count
  cpu                     = var.workers_task_cpu
  memory                  = var.workers_task_memory
  container_name          = "ai-workers"
  container_image         = "${module.ecr.repository_urls["ai-workers"]}:${var.ai_workers_image_tag}"
  container_port          = 8080
  assign_public_ip        = false
  enable_load_balancer    = false
  log_group_name          = module.ecs_cluster.log_group_name
  aws_region              = var.aws_region
  environment_variables = [
    { name = "API_BASE_URL", value = local.api_url },
    { name = "ANTHROPIC_API_KEY", value = var.anthropic_api_key },
    { name = "ANTHROPIC_MODEL", value = var.anthropic_model },
  ]
  tags = local.common_tags
}

# â”€â”€ Route53 DNS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
resource "aws_route53_record" "frontend" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = local.frontend_hostname
  type    = "A"

  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = local.api_hostname
  type    = "A"

  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}

