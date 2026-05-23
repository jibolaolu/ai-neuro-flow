variable "aws_region" {
  description = "AWS region for production resources."
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Project name used as a naming prefix."
  type        = string
  default     = "adhd-autism-platform"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR range for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for multi-AZ deployment."
  type        = list(string)
  default     = ["eu-west-2a", "eu-west-2b"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs."
  type        = list(string)
  default     = ["10.20.0.0/24", "10.20.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "Private subnet CIDRs for ECS services."
  type        = list(string)
  default     = ["10.20.10.0/24", "10.20.11.0/24"]
}

variable "private_data_subnet_cidrs" {
  description = "Private subnet CIDRs for data services."
  type        = list(string)
  default     = ["10.20.20.0/24", "10.20.21.0/24"]
}

variable "frontend_container_port" {
  description = "Frontend container port."
  type        = number
  default     = 3000
}

variable "backend_container_port" {
  description = "Backend container port."
  type        = number
  default     = 8000
}

variable "frontend_image_tag" {
  description = "Frontend image tag."
  type        = string
  default     = "latest"
}

variable "backend_image_tag" {
  description = "Backend image tag."
  type        = string
  default     = "latest"
}

variable "ai_workers_image_tag" {
  description = "AI workers image tag."
  type        = string
  default     = "latest"
}

variable "frontend_task_cpu" {
  description = "Frontend Fargate CPU units."
  type        = number
  default     = 256
}

variable "frontend_task_memory" {
  description = "Frontend Fargate memory in MiB."
  type        = number
  default     = 512
}

variable "backend_task_cpu" {
  description = "Backend Fargate CPU units."
  type        = number
  default     = 512
}

variable "backend_task_memory" {
  description = "Backend Fargate memory in MiB."
  type        = number
  default     = 1024
}

variable "workers_task_cpu" {
  description = "AI workers Fargate CPU units."
  type        = number
  default     = 256
}

variable "workers_task_memory" {
  description = "AI workers Fargate memory in MiB."
  type        = number
  default     = 512
}

variable "frontend_desired_count" {
  description = "Number of frontend tasks."
  type        = number
  default     = 2
}

variable "backend_desired_count" {
  description = "Number of backend tasks."
  type        = number
  default     = 2
}

variable "workers_desired_count" {
  description = "Number of worker tasks."
  type        = number
  default     = 1
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "neuroaccess"
}

variable "db_username" {
  description = "PostgreSQL admin username."
  type        = string
  default     = "platform_admin"
}

variable "db_password" {
  description = "PostgreSQL admin password."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "openai_api_key" {
  description = "OpenAI API key injected into backend and worker tasks."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret key for signing JWT access tokens. Use: openssl rand -hex 32"
  type        = string
  sensitive   = true
}

variable "webhook_secret" {
  description = "Shared secret for verifying WooCommerce webhook signatures (HMAC-SHA256)."
  type        = string
  sensitive   = true
}

variable "frontend_domain" {
  description = "Public domain name for the NeuroFlow frontend (e.g. app.neuroflow.co.uk or your custom domain)."
  type        = string
  default     = "app.neuroflow.co.uk"
}

# ── Auth0 ──────────────────────────────────────────────────────────────────────
# Dashboard → Applications → Your App
variable "auth0_domain" {
  description = "Auth0 tenant domain, e.g. your-tenant.eu.auth0.com"
  type        = string
  default     = ""
}

variable "auth0_audience" {
  description = "Auth0 API audience identifier, e.g. https://neuroaccess-api"
  type        = string
  default     = ""
}

variable "auth0_client_id" {
  description = "Auth0 application client ID"
  type        = string
  default     = ""
}

variable "auth0_client_secret" {
  description = "Auth0 application client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth0_secret" {
  description = "Random 32+ char secret for Next.js Auth0 SDK session encryption (AUTH0_SECRET)"
  type        = string
  sensitive   = true
  default     = ""
}
