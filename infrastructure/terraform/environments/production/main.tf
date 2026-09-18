terraform {
  required_version = ">= 1.8"
  backend "s3" {
    bucket         = "zion8-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "zion8-terraform-locks"
    encrypt        = true
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "zion8"
      Environment = "production"
    }
  }
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "node_security_group_id" {
  type = string
}

variable "kms_key_id" {
  type = string
}

module "rds" {
  source                     = "../../modules/rds"
  name                       = "zion8-production"
  vpc_id                     = var.vpc_id
  subnet_ids                 = var.private_subnet_ids
  allowed_security_group_ids = [var.node_security_group_id]
  instance_class             = "db.r6g.large"
  multi_az                   = true
  backup_retention_period    = 35
  kms_key_id                 = var.kms_key_id
}

module "redis" {
  source                     = "../../modules/redis"
  name                       = "zion8-production"
  vpc_id                     = var.vpc_id
  subnet_ids                 = var.private_subnet_ids
  allowed_security_group_ids = [var.node_security_group_id]
  node_type                  = "cache.r6g.large"
}

module "s3" {
  source             = "../../modules/s3"
  name               = "zion8-production"
  enable_object_lock = true
}

module "ecr" {
  source = "../../modules/ecr"
  name   = "zion8-production"
}

module "secrets" {
  source = "../../modules/secrets"
  name   = "zion8-production"
}

module "observability" {
  source = "../../modules/observability"
  name   = "zion8-production"
}
