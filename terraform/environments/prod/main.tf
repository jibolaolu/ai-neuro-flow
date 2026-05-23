locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

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

module "ecr" {
  source = "../../modules/ecr"

  name_prefix = local.name_prefix
  repositories = [
    "frontend",
    "backend",
    "ai-workers",
  ]
  tags = local.common_tags
}

module "ecs_cluster" {
  source = "../../modules/ecs-cluster"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for the public ALB."
  vpc_id      = module.networking.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
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
  description = "Security group for the frontend ECS service."
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
  description = "Security group for the backend ECS service."
  vpc_id      = module.networking.vpc_id

  ingress {
    description     = "Backend from ALB"
    from_port       = var.backend_container_port
    to_port         = var.backend_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Backend from workers"
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
  description = "Security group for AI worker ECS service."
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
  description = "Security group for PostgreSQL."
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

module "rds" {
  source = "../../modules/rds"

  name_prefix              = local.name_prefix
  db_name                  = var.db_name
  db_username              = var.db_username
  db_password              = var.db_password
  db_instance_class        = var.db_instance_class
  allocated_storage        = var.db_allocated_storage
  subnet_ids               = module.networking.private_data_subnet_ids
  vpc_security_group_ids   = [aws_security_group.database.id]
  tags                     = local.common_tags
}

module "frontend_service" {
  source = "../../modules/ecs-service"

  name_prefix                = local.name_prefix
  service_name               = "frontend"
  cluster_arn                = module.ecs_cluster.cluster_arn
  task_execution_role_arn    = module.ecs_cluster.task_execution_role_arn
  task_role_arn              = module.ecs_cluster.task_role_arn
  subnet_ids                 = module.networking.private_app_subnet_ids
  security_group_ids         = [aws_security_group.frontend_service.id]
  desired_count              = var.frontend_desired_count
  cpu                        = var.frontend_task_cpu
  memory                     = var.frontend_task_memory
  container_name             = "frontend"
  container_image            = "${module.ecr.repository_urls["frontend"]}:${var.frontend_image_tag}"
  container_port             = var.frontend_container_port
  assign_public_ip           = false
  enable_load_balancer       = true
  target_group_arn           = module.alb.frontend_target_group_arn
  log_group_name             = module.ecs_cluster.log_group_name
  aws_region                 = var.aws_region
  environment_variables = [
    {
      name  = "NEXT_PUBLIC_API_URL"
      value = "https://${var.frontend_domain}"
    },
    {
      name  = "AUTH0_SECRET"
      value = var.auth0_secret
    },
    {
      name  = "AUTH0_BASE_URL"
      value = "https://${var.frontend_domain}"
    },
    {
      name  = "AUTH0_ISSUER_BASE_URL"
      value = "https://${var.auth0_domain}"
    },
    {
      name  = "AUTH0_CLIENT_ID"
      value = var.auth0_client_id
    },
    {
      name  = "AUTH0_CLIENT_SECRET"
      value = var.auth0_client_secret
    },
    {
      name  = "AUTH0_AUDIENCE"
      value = var.auth0_audience
    }
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
    {
      name  = "DATABASE_URL"
      value = "postgresql://${var.db_username}:${var.db_password}@${module.rds.endpoint}/${var.db_name}"
    },
    {
      name  = "OPENAI_MODEL"
      value = "gpt-4o-mini"
    },
    {
      name  = "OPENAI_API_KEY"
      value = var.openai_api_key
    },
    {
      name  = "JWT_SECRET"
      value = var.jwt_secret
    },
    {
      name  = "WEBHOOK_SECRET"
      value = var.webhook_secret
    },
    {
      name  = "ENVIRONMENT"
      value = "production"
    },
    {
      name  = "FRONTEND_URL"
      value = "https://${var.frontend_domain}"
    },
    {
      name  = "WORDPRESS_STAGING_URL"
      value = ""
    },
    {
      name  = "WORDPRESS_PRODUCTION_URL"
      value = ""
    },
    {
      name  = "AUTH0_DOMAIN"
      value = var.auth0_domain
    },
    {
      name  = "AUTH0_AUDIENCE"
      value = var.auth0_audience
    },
    {
      name  = "AUTH0_CLIENT_ID"
      value = var.auth0_client_id
    },
    {
      name  = "AUTH0_CLIENT_SECRET"
      value = var.auth0_client_secret
    }
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
  command                 = ["python", "workers/report_generator.py"]
  environment_variables = [
    {
      name  = "API_BASE_URL"
      value = "http://${module.alb.alb_dns_name}"
    },
    {
      name  = "OPENAI_API_KEY"
      value = var.openai_api_key
    }
  ]
  tags = local.common_tags
}
