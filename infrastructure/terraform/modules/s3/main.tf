variable "name" {
  type = string
}

variable "enable_object_lock" {
  type    = bool
  default = false
}

resource "aws_s3_bucket" "archives" {
  bucket              = "${var.name}-archives"
  object_lock_enabled = var.enable_object_lock
}

resource "aws_s3_bucket_public_access_block" "archives" {
  bucket                  = aws_s3_bucket.archives.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "archives" {
  bucket = aws_s3_bucket.archives.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "archives" {
  bucket = aws_s3_bucket.archives.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "archives" {
  bucket = aws_s3_bucket.archives.id
  rule {
    id     = "age-off-hot"
    status = "Enabled"
    filter {}
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 365
      storage_class = "GLACIER_IR"
    }
  }
}

output "archives_bucket" {
  value = aws_s3_bucket.archives.id
}
