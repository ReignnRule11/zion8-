variable "REGISTRY" {
  default = "ghcr.io/reignnrule11"
}

variable "REVISION" {
  default = "dev"
}

group "default" {
  targets = ["api", "web", "migrate"]
}

target "api" {
  context    = "../.."
  dockerfile = "infrastructure/docker/api.Dockerfile"
  tags = [
    "${REGISTRY}/zion8-api:${REVISION}",
  ]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "web" {
  context    = "../.."
  dockerfile = "infrastructure/docker/web.Dockerfile"
  tags = [
    "${REGISTRY}/zion8-web:${REVISION}",
  ]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "migrate" {
  context    = "../.."
  dockerfile = "infrastructure/docker/migrate.Dockerfile"
  tags = [
    "${REGISTRY}/zion8-migrate:${REVISION}",
  ]
  platforms = ["linux/amd64", "linux/arm64"]
}
