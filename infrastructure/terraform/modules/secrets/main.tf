variable "name" {
  type = string
}

resource "aws_secretsmanager_secret" "api" {
  name                    = "${var.name}/api"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret" "web" {
  name                    = "${var.name}/web"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_rotation" "api" {
  count               = var.rotation_lambda_arn == "" ? 0 : 1
  secret_id           = aws_secretsmanager_secret.api.id
  rotation_lambda_arn = var.rotation_lambda_arn
  rotation_rules {
    automatically_after_days = 30
  }
}

variable "rotation_lambda_arn" {
  type    = string
  default = ""
}

output "api_secret_arn" {
  value = aws_secretsmanager_secret.api.arn
}

output "web_secret_arn" {
  value = aws_secretsmanager_secret.web.arn
}
