variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Project name prefix for all resources."
  type        = string
  default     = "neuroflow"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "prod"
}

# ── Networking ────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  type    = string
  default = "10.30.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["eu-west-2a", "eu-west-2b"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.30.0.0/24", "10.30.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  type    = list(string)
  default = ["10.30.10.0/24", "10.30.11.0/24"]
}

variable "private_data_subnet_cidrs" {
  type    = list(string)
  default = ["10.30.20.0/24", "10.30.21.0/24"]
}

# ── Container ports ───────────────────────────────────────────────────────────
variable "frontend_container_port" {
  type    = number
  default = 3000
}

variable "backend_container_port" {
  type    = number
  default = 8000
}

# ── Image tags (overridden by CI) ─────────────────────────────────────────────
variable "frontend_image_tag" {
  type    = string
  default = "latest"
}

variable "backend_image_tag" {
  type    = string
  default = "latest"
}

variable "ai_workers_image_tag" {
  type    = string
  default = "latest"
}

# ── ECS sizing ────────────────────────────────────────────────────────────────
variable "frontend_task_cpu" {
  type    = number
  default = 512
}

variable "frontend_task_memory" {
  type    = number
  default = 1024
}

variable "backend_task_cpu" {
  type    = number
  default = 512
}

variable "backend_task_memory" {
  type    = number
  default = 1024
}

variable "workers_task_cpu" {
  type    = number
  default = 256
}

variable "workers_task_memory" {
  type    = number
  default = 512
}

variable "frontend_desired_count" {
  type    = number
  default = 2
}

variable "backend_desired_count" {
  type    = number
  default = 2
}

variable "workers_desired_count" {
  type    = number
  default = 1
}

# ── RDS ───────────────────────────────────────────────────────────────────────
variable "db_name" {
  type    = string
  default = "neuroflow"
}

variable "db_username" {
  type    = string
  default = "neuroflow_admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

# ── DNS ───────────────────────────────────────────────────────────────────────
variable "frontend_domain" {
  description = "Public hostname for the NeuroFlow app (e.g. neuroflow.eaglessolutions.co.uk)"
  type        = string
  default     = "neuroflow.eaglessolutions.co.uk"
}

variable "api_domain" {
  description = "Public hostname for the NeuroFlow API (e.g. neuroflow-api.eaglessolutions.co.uk)"
  type        = string
  default     = "neuroflow-api.eaglessolutions.co.uk"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for the eaglessolutions.co.uk domain."
  type        = string
  default     = "Z02866112UE0M0NEAFMZO"
}

# ── App secrets (injected as TF_VAR_* by GitHub Actions) ─────────────────────
variable "jwt_secret" {
  description = "HS256 signing secret. Generate: openssl rand -hex 32"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude AI features."
  type        = string
  sensitive   = true
}

variable "anthropic_model" {
  description = "Claude model ID."
  type        = string
  default     = "claude-sonnet-4-5"
}

variable "sendgrid_api_key" {
  description = "SendGrid API key for transactional email."
  type        = string
  sensitive   = true
  default     = ""
}

variable "sendgrid_from_email" {
  description = "From address used for all platform emails."
  type        = string
  default     = "noreply@neuroflow.eaglessolutions.co.uk"
}

variable "stripe_secret_key" {
  description = "Stripe secret key for clinic subscription billing."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_price_starter" {
  description = "Stripe Price ID for the Starter plan."
  type        = string
  default     = ""
}

variable "stripe_price_professional" {
  description = "Stripe Price ID for the Professional plan."
  type        = string
  default     = ""
}

variable "stripe_price_enterprise" {
  description = "Stripe Price ID for the Enterprise plan."
  type        = string
  default     = ""
}

# ── Platform branding ─────────────────────────────────────────────────────────
variable "platform_display_name" {
  description = "Platform name shown in the UI and emails when no clinic branding is set."
  type        = string
  default     = "NeuroFlow"
}

variable "platform_tagline" {
  description = "Platform tagline shown in the UI."
  type        = string
  default     = "NICE-aligned neurodevelopmental assessment for clinics"
}

variable "support_email" {
  description = "Platform-level support email (fallback when clinic has none set)."
  type        = string
  default     = "support@neuroflow.eaglessolutions.co.uk"
}

variable "admin_notification_email" {
  description = "Internal admin email that receives platform alerts."
  type        = string
  default     = "admin@neuroflow.eaglessolutions.co.uk"
}

# ── Auth0 (injected as TF_VAR_* by GitHub Actions) ───────────────────────────
variable "auth0_secret" {
  description = "Long random secret used to encrypt Auth0 session cookies."
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth0_issuer_base_url" {
  description = "Auth0 tenant URL, e.g. https://your-tenant.eu.auth0.com"
  type        = string
  default     = ""
}

variable "auth0_client_id" {
  description = "Auth0 application Client ID."
  type        = string
  default     = ""
}

variable "auth0_client_secret" {
  description = "Auth0 application Client Secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth0_audience" {
  description = "Auth0 API audience identifier."
  type        = string
  default     = ""
}
