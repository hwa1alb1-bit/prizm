#!/usr/bin/env bash
# PRIZM AWS Infrastructure Setup
# Run once per environment (prod / staging).
# Requires: aws cli v2, authenticated session (`aws sso login` or env creds).
#
# Usage:
#   ./setup-prizm-aws.sh prod   <vercel-team-slug>
#   ./setup-prizm-aws.sh staging <vercel-team-slug>

set -euo pipefail

ENV="${1:?Usage: $0 <prod|staging> <vercel-team-slug>}"
VERCEL_TEAM_SLUG="${2:?Usage: $0 <prod|staging> <vercel-team-slug>}"
REGION="us-east-1"
BUCKET="prizm-uploads-${ENV}"
KMS_ALIAS="alias/prizm-uploads-${ENV}"
ROLE_NAME="vercel-prizm-${ENV}-role"
POLICY_NAME="vercel-prizm-${ENV}-policy"
OIDC_URL="https://oidc.vercel.com"
AUDIENCE="https://vercel.com/${VERCEL_TEAM_SLUG}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account: ${ACCOUNT_ID}  Env: ${ENV}  Region: ${REGION}"

# ── 1. KMS Key ──────────────────────────────────────────────────────
echo "Creating KMS key..."
KMS_KEY_ID=$(aws kms create-key \
  --region "${REGION}" \
  --description "PRIZM ${ENV} S3 upload encryption" \
  --query KeyMetadata.KeyId \
  --output text)

aws kms create-alias \
  --region "${REGION}" \
  --alias-name "${KMS_ALIAS}" \
  --target-key-id "${KMS_KEY_ID}"

KMS_ARN="arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/${KMS_KEY_ID}"
echo "KMS Key: ${KMS_ARN}"

# ── 2. S3 Bucket ────────────────────────────────────────────────────
echo "Creating S3 bucket..."
aws s3api create-bucket \
  --bucket "${BUCKET}" \
  --region "${REGION}"

# Block all public access
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Versioning OFF (default, but explicit)
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Suspended

# Lifecycle: delete after 1 day
aws s3api put-bucket-lifecycle-configuration \
  --bucket "${BUCKET}" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-after-1-day",
      "Status": "Enabled",
      "Filter": {},
      "Expiration": { "Days": 1 }
    }]
  }'

# Default encryption: SSE-KMS
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration "{
    \"Rules\": [{
      \"ApplyServerSideEncryptionByDefault\": {
        \"SSEAlgorithm\": \"aws:kms\",
        \"KMSMasterKeyID\": \"${KMS_KEY_ID}\"
      },
      \"BucketKeyEnabled\": true
    }]
  }"

aws s3api put-bucket-cors \
  --bucket "${BUCKET}" \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedOrigins": ["https://prizmview.app", "https://*.vercel.app", "http://localhost:3030"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }]
  }'

echo "S3 bucket ${BUCKET} configured."

# ── 3. OIDC Provider (idempotent) ───────────────────────────────────
echo "Setting up Vercel OIDC provider..."
OIDC_ARN=$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?ends_with(Arn, '/oidc.vercel.com')].Arn" \
  --output text 2>/dev/null || true)

if [ -z "${OIDC_ARN}" ] || [ "${OIDC_ARN}" = "None" ]; then
  # Fetch thumbprint from Vercel OIDC endpoint
  THUMBPRINT=$(openssl s_client -connect oidc.vercel.com:443 -servername oidc.vercel.com </dev/null 2>/dev/null \
    | openssl x509 -fingerprint -noout 2>/dev/null \
    | sed 's/://g' | cut -d= -f2 | tr '[:upper:]' '[:lower:]')

  OIDC_ARN=$(aws iam create-open-id-connect-provider \
    --url "${OIDC_URL}" \
    --client-id-list "${AUDIENCE}" \
    --thumbprint-list "${THUMBPRINT}" \
    --query OpenIDConnectProviderArn \
    --output text)
  echo "Created OIDC provider: ${OIDC_ARN}"
else
  # Add audience if not present
  aws iam add-client-id-to-open-id-connect-provider \
    --open-id-connect-provider-arn "${OIDC_ARN}" \
    --client-id "${AUDIENCE}" 2>/dev/null || true
  echo "OIDC provider exists: ${OIDC_ARN}"
fi

# ── 4. IAM Role + Policy ───────────────────────────────────────────
echo "Creating IAM role ${ROLE_NAME}..."

TRUST_POLICY=$(cat <<TRUST
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "${OIDC_ARN}" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "oidc.vercel.com:aud": "${AUDIENCE}"
      }
    }
  }]
}
TRUST
)

ROLE_ARN=$(aws iam create-role \
  --role-name "${ROLE_NAME}" \
  --assume-role-policy-document "${TRUST_POLICY}" \
  --query Role.Arn \
  --output text)

# Inline policy: S3 + KMS + Textract
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

aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "${PERMISSIONS}"

echo "Role created: ${ROLE_ARN}"

# ── 5. Output ───────────────────────────────────────────────────────
cat <<EOF

========================================
PRIZM AWS Setup Complete (${ENV})
========================================

Add to Vercel env vars:

  AWS_REGION=${REGION}
  AWS_ROLE_ARN=${ROLE_ARN}
  S3_UPLOAD_BUCKET=${BUCKET}
  S3_KMS_KEY_ID=${KMS_ARN}

========================================
EOF
