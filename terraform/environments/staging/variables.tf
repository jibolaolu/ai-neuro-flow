variable "aws_region" {
  description = "AWS region for staging resources."
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
  default     = "staging"
}

variable "vpc_cidr" {
  description = "CIDR range for the VPC."
  type        = string
  default     = "10.15.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for the deployment."
  type        = list(string)
  default     = ["eu-west-2a", "eu-west-2b"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs."
  type        = list(string)
  default     = ["10.15.0.0/24", "10.15.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "Private subnet CIDRs for ECS services."
  type        = list(string)
  default     = ["10.15.10.0/24", "10.15.11.0/24"]
}

variable "private_data_subnet_cidrs" {
  description = "Private subnet CIDRs for data services."
  type        = list(string)
  default     = ["10.15.20.0/24", "10.15.21.0/24"]
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
  default     = "staging"
}

variable "backend_image_tag" {
  description = "Backend image tag."
  type        = string
  default     = "staging"
}

variable "ai_workers_image_tag" {
  description = "AI workers image tag."
  type        = string
  default     = "staging"
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
  default     = 1
}

variable "backend_desired_count" {
  description = "Number of backend tasks."
  type        = number
  default     = 1
}

variable "workers_desired_count" {
  description = "Number of worker tasks."
  type        = number
  default     = 1
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "neuroaccess_staging"
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
  default     = "db.t4g.small"
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
