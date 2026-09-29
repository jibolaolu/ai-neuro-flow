output "alb_dns_name" {
  description = "ALB public DNS name."
  value       = module.alb.alb_dns_name
}

output "frontend_url" {
  description = "NeuroFlow frontend URL."
  value       = "https://${var.frontend_domain}"
}

output "api_url" {
  description = "NeuroFlow API URL."
  value       = "https://${var.api_domain}"
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
  description = "RDS endpoint (host:port)."
  value       = module.rds.endpoint
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs_cluster.cluster_name
}

output "uploads_bucket_name" {
  description = "S3 uploads bucket name."
  value       = aws_s3_bucket.uploads.bucket
}
