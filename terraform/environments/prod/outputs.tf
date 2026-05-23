output "alb_dns_name" {
  description = "Public DNS name for the load balancer."
  value       = module.alb.alb_dns_name
}

output "frontend_ecr_repository_url" {
  description = "Frontend ECR repository URL."
  value       = module.ecr.repository_urls["frontend"]
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL."
  value       = module.ecr.repository_urls["backend"]
}

output "ai_workers_ecr_repository_url" {
  description = "AI workers ECR repository URL."
  value       = module.ecr.repository_urls["ai-workers"]
}

output "rds_endpoint" {
  description = "RDS endpoint."
  value       = module.rds.endpoint
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs_cluster.cluster_name
}
