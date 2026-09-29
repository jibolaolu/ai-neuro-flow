output "alb_dns_name" {
  value = module.alb.alb_dns_name
}

output "frontend_url" {
  value = "https://${var.frontend_domain}"
}

output "api_url" {
  value = "https://${var.api_domain}"
}

output "frontend_ecr_repository_url" {
  value = module.ecr.repository_urls["frontend"]
}

output "backend_ecr_repository_url" {
  value = module.ecr.repository_urls["backend"]
}

output "ai_workers_ecr_repository_url" {
  value = module.ecr.repository_urls["ai-workers"]
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "ecs_cluster_name" {
  value = module.ecs_cluster.cluster_name
}

output "uploads_bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}
