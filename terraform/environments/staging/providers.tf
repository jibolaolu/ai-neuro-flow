terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "eagles-solutions-tfstate"
    key          = "apps/neuroflow/staging.tfstate"
    region       = "eu-west-2"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "eagles-solutions"
      App         = "neuroflow"
      Environment = "staging"
      ManagedBy   = "Terraform"
      Layer       = "app"
    }
  }
}
