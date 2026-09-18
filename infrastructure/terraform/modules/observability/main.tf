variable "name" {
  type = string
}

# AMP workspace, Grafana, Tempo, and the OTel collector Helm values are
# applied after the EKS cluster exists. This module is the contract.

output "grafana_url" {
  value = "https://grafana.invalid"
}
