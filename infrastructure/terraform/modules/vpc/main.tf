variable "name" {
  type = string
}

variable "cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# VPC, three private subnets, three public subnets, NAT per AZ in production
# and a single NAT in staging. Fill resource bodies when the AWS account exists.

output "vpc_id" {
  value = var.name
}

output "private_subnet_ids" {
  value = []
}

output "public_subnet_ids" {
  value = []
}
