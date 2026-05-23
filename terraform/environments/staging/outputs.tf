output "alb_dns_name" {
  description = "Public DNS name for the load balancer."
  value       = module.environment.alb_dns_name
}

output "frontend_ecr_repository_url" {
  description = "Frontend ECR repository URL."
  value       = module.environment.frontend_ecr_repository_url
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL."
  value       = module.environment.backend_ecr_repository_url
}

output "ai_workers_ecr_repository_url" {
  description = "AI workers ECR repository URL."
  value       = module.environment.ai_workers_ecr_repository_url
}

output "rds_endpoint" {
  description = "RDS endpoint."
  value       = module.environment.rds_endpoint
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.environment.ecs_cluster_name
}
