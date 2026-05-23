module "environment" {
  source = "../prod"

  aws_region                = var.aws_region
  project_name              = var.project_name
  environment               = var.environment
  vpc_cidr                  = var.vpc_cidr
  availability_zones        = var.availability_zones
  public_subnet_cidrs       = var.public_subnet_cidrs
  private_app_subnet_cidrs  = var.private_app_subnet_cidrs
  private_data_subnet_cidrs = var.private_data_subnet_cidrs

  frontend_container_port = var.frontend_container_port
  backend_container_port  = var.backend_container_port

  frontend_image_tag   = var.frontend_image_tag
  backend_image_tag    = var.backend_image_tag
  ai_workers_image_tag = var.ai_workers_image_tag

  frontend_task_cpu    = var.frontend_task_cpu
  frontend_task_memory = var.frontend_task_memory
  backend_task_cpu     = var.backend_task_cpu
  backend_task_memory  = var.backend_task_memory
  workers_task_cpu     = var.workers_task_cpu
  workers_task_memory  = var.workers_task_memory

  frontend_desired_count = var.frontend_desired_count
  backend_desired_count  = var.backend_desired_count
  workers_desired_count  = var.workers_desired_count

  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  db_instance_class    = var.db_instance_class
  db_allocated_storage = var.db_allocated_storage
  openai_api_key       = var.openai_api_key
}
