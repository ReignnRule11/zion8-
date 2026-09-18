variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  type = list(string)
}

variable "instance_class" {
  type = string
}

variable "multi_az" {
  type    = bool
  default = true
}

variable "backup_retention_period" {
  type    = number
  default = 7
}

variable "kms_key_id" {
  type = string
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-pg"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "this" {
  name   = "${var.name}-pg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "aws_db_instance" "this" {
  identifier                   = "${var.name}-pg"
  engine                       = "postgres"
  engine_version               = "16"
  instance_class               = var.instance_class
  allocated_storage            = 50
  max_allocated_storage        = 500
  storage_encrypted            = true
  kms_key_id                   = var.kms_key_id
  db_name                      = "zion8"
  username                     = "zion8"
  manage_master_user_password  = true
  db_subnet_group_name         = aws_db_subnet_group.this.name
  vpc_security_group_ids       = [aws_security_group.this.id]
  parameter_group_name         = aws_db_parameter_group.this.name
  multi_az                     = var.multi_az
  publicly_accessible          = false
  backup_retention_period      = var.backup_retention_period
  deletion_protection          = true
  skip_final_snapshot          = false
  performance_insights_enabled = true
  auto_minor_version_upgrade   = true
  copy_tags_to_snapshot        = true
}

output "endpoint" {
  value = aws_db_instance.this.address
}

output "security_group_id" {
  value = aws_security_group.this.id
}
