terraform {
  required_version = ">= 1.8"
  backend "s3" {
    bucket         = "zion8-terraform-state"
    key            = "staging/terraform.tfstate"
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
      Environment = "staging"
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
  name                       = "zion8-staging"
  vpc_id                     = var.vpc_id
  subnet_ids                 = var.private_subnet_ids
  allowed_security_group_ids = [var.node_security_group_id]
  instance_class             = "db.t4g.medium"
  multi_az                   = false
  backup_retention_period    = 7
  kms_key_id                 = var.kms_key_id
}

module "redis" {
  source                     = "../../modules/redis"
  name                       = "zion8-staging"
  vpc_id                     = var.vpc_id
  subnet_ids                 = var.private_subnet_ids
  allowed_security_group_ids = [var.node_security_group_id]
  node_type                  = "cache.t4g.small"
}

module "s3" {
  source             = "../../modules/s3"
  name               = "zion8-staging"
  enable_object_lock = false
}

module "ecr" {
  source = "../../modules/ecr"
  name   = "zion8-staging"
}

module "secrets" {
  source = "../../modules/secrets"
  name   = "zion8-staging"
}

module "observability" {
  source = "../../modules/observability"
  name   = "zion8-staging"
}
