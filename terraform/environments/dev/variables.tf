variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "project_name" {
  type    = string
  default = "neuroflow"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "vpc_cidr" {
  type    = string
  default = "10.10.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["eu-west-2a", "eu-west-2b"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.10.0.0/24", "10.10.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  type    = list(string)
  default = ["10.10.10.0/24", "10.10.11.0/24"]
}

variable "private_data_subnet_cidrs" {
  type    = list(string)
  default = ["10.10.20.0/24", "10.10.21.0/24"]
}

variable "frontend_container_port" {
  type    = number
  default = 3000
}

variable "backend_container_port" {
  type    = number
  default = 8000
}

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

# Dev — single replicas, smaller instances
variable "frontend_task_cpu" {
  type    = number
  default = 256
}

variable "frontend_task_memory" {
  type    = number
  default = 512
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
  default = 1
}

variable "backend_desired_count" {
  type    = number
  default = 1
}

variable "workers_desired_count" {
  type    = number
  default = 1
}

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
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "frontend_domain" {
  type    = string
  default = "neuroflow.development.eaglessolutions.co.uk"
}

variable "api_domain" {
  type    = string
  default = "neuroflow-api.development.eaglessolutions.co.uk"
}

variable "route53_zone_id" {
  type    = string
  default = "Z02866112UE0M0NEAFMZO"
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
}

variable "anthropic_model" {
  type    = string
  default = "claude-sonnet-4-5"
}

variable "sendgrid_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "sendgrid_from_email" {
  type    = string
  default = "noreply@neuroflow.eaglessolutions.co.uk"
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "stripe_price_starter" {
  type    = string
  default = ""
}

variable "stripe_price_professional" {
  type    = string
  default = ""
}

variable "stripe_price_enterprise" {
  type    = string
  default = ""
}

variable "platform_display_name" {
  type    = string
  default = "NeuroFlow"
}

variable "platform_tagline" {
  type    = string
  default = "NICE-aligned neurodevelopmental assessment for clinics"
}

variable "support_email" {
  type    = string
  default = "support@neuroflow.eaglessolutions.co.uk"
}

variable "admin_notification_email" {
  type    = string
  default = "admin@neuroflow.eaglessolutions.co.uk"
}
