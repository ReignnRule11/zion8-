variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "kubernetes_version" {
  type    = string
  default = "1.31"
}

# Cluster, IRSA, Karpenter discovery tags, and add-ons (AWS LB controller,
# External Secrets, Argo CD) are created here. The module is a contract for
# environments; fill cluster resource bodies when the AWS account exists.
output "cluster_name" {
  value = var.name
}

output "oidc_provider" {
  value = "placeholder"
}
