param(
    [Parameter(Mandatory)][ValidateSet("prod","staging")][string]$Env,
    [Parameter(Mandatory)][string]$VercelTeamSlug
)

# Do NOT use "Stop" - native exe stderr triggers terminating errors in PS 5.1
$ErrorActionPreference = "Continue"

function Write-Tmp($content) {
    $f = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($f, $content, [System.Text.UTF8Encoding]::new($false))
    return $f
}

$Region = "us-east-1"
$Bucket = "prizm-uploads-$Env"
$KmsAlias = "alias/prizm-uploads-$Env"
$RoleName = "vercel-prizm-$Env-role"
$PolicyName = "vercel-prizm-$Env-policy"
$Audience = "https://vercel.com/$VercelTeamSlug"

$AccountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) { Write-Host "FATAL: not authenticated. Run 'aws configure' first."; exit 1 }
Write-Host "Account: $AccountId  Env: $Env  Region: $Region"

# ── 1. KMS Key ──────────────────────────────────────────────────────
Write-Host "`n[1/5] KMS key..."
$KmsKeyId = aws kms list-aliases --region $Region --query "Aliases[?AliasName=='$KmsAlias'].TargetKeyId" --output text
if ($KmsKeyId -and $KmsKeyId -ne "None" -and $KmsKeyId.Length -gt 10) {
    Write-Host "  exists: $KmsKeyId"
} else {
    $KmsKeyId = aws kms create-key --region $Region --description "PRIZM $Env S3 upload encryption" --query KeyMetadata.KeyId --output text
    if ($LASTEXITCODE -ne 0) { Write-Host "FATAL: KMS create failed"; exit 1 }
    aws kms create-alias --region $Region --alias-name $KmsAlias --target-key-id $KmsKeyId
    Write-Host "  created: $KmsKeyId"
}
$KmsArn = "arn:aws:kms:${Region}:${AccountId}:key/${KmsKeyId}"

# ── 2. S3 Bucket ────────────────────────────────────────────────────
Write-Host "`n[2/5] S3 bucket..."
aws s3api head-bucket --bucket $Bucket 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  creating bucket..."
    aws s3api create-bucket --bucket $Bucket --region $Region | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "FATAL: bucket create failed"; exit 1 }
}

Write-Host "  public access block..."
aws s3api put-public-access-block --bucket $Bucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

Write-Host "  versioning suspended..."
aws s3api put-bucket-versioning --bucket $Bucket --versioning-configuration "Status=Suspended"

Write-Host "  lifecycle (1-day expiry)..."
$f = Write-Tmp '{"Rules":[{"ID":"expire-after-1-day","Status":"Enabled","Filter":{},"Expiration":{"Days":1}}]}'
aws s3api put-bucket-lifecycle-configuration --bucket $Bucket --lifecycle-configuration "file://$f"
Remove-Item $f -Force -Confirm:$false

Write-Host "  encryption (SSE-KMS)..."
$f = Write-Tmp "{`"Rules`":[{`"ApplyServerSideEncryptionByDefault`":{`"SSEAlgorithm`":`"aws:kms`",`"KMSMasterKeyID`":`"$KmsKeyId`"},`"BucketKeyEnabled`":true}]}"
aws s3api put-bucket-encryption --bucket $Bucket --server-side-encryption-configuration "file://$f"
Remove-Item $f -Force -Confirm:$false

Write-Host "  browser upload CORS..."
$f = Write-Tmp '{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["PUT","GET"],"AllowedOrigins":["https://prizmview.app","https://*.vercel.app","http://localhost:3030"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}'
aws s3api put-bucket-cors --bucket $Bucket --cors-configuration "file://$f"
Remove-Item $f -Force -Confirm:$false

Write-Host "  done."

# ── 3. OIDC Provider ────────────────────────────────────────────────
Write-Host "`n[3/5] Vercel OIDC provider..."
$OidcArn = aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?ends_with(Arn, '/oidc.vercel.com')].Arn" --output text
if ($OidcArn -and $OidcArn -ne "None" -and $OidcArn.Length -gt 10) {
    aws iam add-client-id-to-open-id-connect-provider --open-id-connect-provider-arn $OidcArn --client-id $Audience 2>$null
    Write-Host "  exists: $OidcArn"
} else {
    $Thumbprint = "08745487e891c19e3078c1f2a07e452950ef36f6"
    $OidcArn = aws iam create-open-id-connect-provider --url "https://oidc.vercel.com" --client-id-list $Audience --thumbprint-list $Thumbprint --query OpenIDConnectProviderArn --output text
    if ($LASTEXITCODE -ne 0) { Write-Host "FATAL: OIDC create failed"; exit 1 }
    Write-Host "  created: $OidcArn"
}

# ── 4. IAM Role ─────────────────────────────────────────────────────
Write-Host "`n[4/5] IAM role $RoleName..."
$RoleArn = aws iam get-role --role-name $RoleName --query Role.Arn --output text 2>$null
if ($LASTEXITCODE -eq 0 -and $RoleArn -and $RoleArn.Length -gt 10) {
    Write-Host "  exists: $RoleArn"
} else {
    $trustJson = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"' + $OidcArn + '"},"Action":"sts:AssumeRoleWithWebIdentity","Condition":{"StringEquals":{"oidc.vercel.com:aud":"' + $Audience + '"}}}]}'
    $f = Write-Tmp $trustJson
    $RoleArn = aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$f" --query Role.Arn --output text
    Remove-Item $f -Force -Confirm:$false
    if ($LASTEXITCODE -ne 0) { Write-Host "FATAL: role create failed"; exit 1 }
    Write-Host "  created: $RoleArn"
}

# ── 5. Inline Policy ────────────────────────────────────────────────
Write-Host "`n[5/5] Policy on $RoleName..."
$permJson = '{"Version":"2012-10-17","Statement":[{"Sid":"S3","Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject","s3:ListBucket"],"Resource":["arn:aws:s3:::' + $Bucket + '","arn:aws:s3:::' + $Bucket + '/*"]},{"Sid":"KMS","Effect":"Allow","Action":["kms:Encrypt","kms:Decrypt","kms:GenerateDataKey","kms:DescribeKey"],"Resource":"' + $KmsArn + '"},{"Sid":"Textract","Effect":"Allow","Action":["textract:StartDocumentAnalysis","textract:GetDocumentAnalysis","textract:StartDocumentTextDetection","textract:GetDocumentTextDetection"],"Resource":"*"}]}'
$f = Write-Tmp $permJson
aws iam put-role-policy --role-name $RoleName --policy-name $PolicyName --policy-document "file://$f"
Remove-Item $f -Force -Confirm:$false
if ($LASTEXITCODE -ne 0) { Write-Host "FATAL: policy attach failed"; exit 1 }
Write-Host "  attached."

# ── Output ──────────────────────────────────────────────────────────
Write-Host "`n========================================"
Write-Host "PRIZM AWS Setup Complete ($Env)"
Write-Host "========================================`n"
Write-Host "Vercel env vars:`n"
Write-Host "  AWS_REGION=$Region"
Write-Host "  AWS_ROLE_ARN=$RoleArn"
Write-Host "  S3_UPLOAD_BUCKET=$Bucket"
Write-Host "  S3_KMS_KEY_ID=$KmsArn"
Write-Host "`n========================================"
