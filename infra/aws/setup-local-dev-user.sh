#!/usr/bin/env bash
# Create IAM user with static keys for local PRIZM development.
# Uses staging bucket + KMS key.
# Run ONCE after setup-prizm-aws.sh staging completes.
#
# Usage:
#   ./setup-local-dev-user.sh <kms-key-id>
#
# Outputs access key ID + secret for .env.local

set -euo pipefail

KMS_KEY_ID="${1:?Usage: $0 <kms-key-id-from-staging-setup>}"
REGION="us-east-1"
BUCKET="prizm-uploads-staging"
USER_NAME="prizm-local-dev"
POLICY_NAME="prizm-local-dev-policy"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
KMS_ARN="arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/${KMS_KEY_ID}"

echo "Creating IAM user ${USER_NAME}..."

aws iam create-user --user-name "${USER_NAME}" 2>/dev/null || echo "User exists."

PERMISSIONS=$(cat <<PERMS
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${BUCKET}",
        "arn:aws:s3:::${BUCKET}/*"
      ]
    },
    {
      "Sid": "KMSAccess",
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "${KMS_ARN}"
    },
    {
      "Sid": "TextractAccess",
      "Effect": "Allow",
      "Action": [
        "textract:StartDocumentAnalysis",
        "textract:GetDocumentAnalysis",
        "textract:StartDocumentTextDetection",
        "textract:GetDocumentTextDetection"
      ],
      "Resource": "*"
    }
  ]
}
PERMS
)

aws iam put-user-policy \
  --user-name "${USER_NAME}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "${PERMISSIONS}"

echo "Creating access key..."
CREDS=$(aws iam create-access-key \
  --user-name "${USER_NAME}" \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
  --output text)

ACCESS_KEY=$(echo "${CREDS}" | awk '{print $1}')
SECRET_KEY=$(echo "${CREDS}" | awk '{print $2}')

cat <<EOF

========================================
PRIZM Local Dev Credentials
========================================

Add to .env.local:

  AWS_REGION=${REGION}
  AWS_ACCESS_KEY_ID=${ACCESS_KEY}
  AWS_SECRET_ACCESS_KEY=${SECRET_KEY}
  S3_UPLOAD_BUCKET=${BUCKET}
  S3_KMS_KEY_ID=${KMS_ARN}

SAVE THESE NOW. Secret key shown once.
========================================
EOF
