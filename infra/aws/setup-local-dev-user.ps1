$ErrorActionPreference = "Continue"

function Write-Tmp($content) {
    $f = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($f, $content, [System.Text.UTF8Encoding]::new($false))
    return $f
}

$Region = "us-east-1"
$Bucket = "prizm-uploads-staging"
$UserName = "prizm-local-dev"
$PolicyName = "prizm-local-dev-policy"
$KmsKeyId = "3cc33827-f5d2-4dd2-b816-35fc0057477f"

$AccountId = aws sts get-caller-identity --query Account --output text
$KmsArn = "arn:aws:kms:${Region}:${AccountId}:key/${KmsKeyId}"

Write-Host "Creating IAM user $UserName..."
aws iam create-user --user-name $UserName 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  user exists, continuing." }

Write-Host "Attaching policy..."
$permJson = '{"Version":"2012-10-17","Statement":[{"Sid":"S3","Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject","s3:ListBucket"],"Resource":["arn:aws:s3:::' + $Bucket + '","arn:aws:s3:::' + $Bucket + '/*"]},{"Sid":"KMS","Effect":"Allow","Action":["kms:Encrypt","kms:Decrypt","kms:GenerateDataKey","kms:DescribeKey"],"Resource":"' + $KmsArn + '"},{"Sid":"Textract","Effect":"Allow","Action":["textract:StartDocumentAnalysis","textract:GetDocumentAnalysis","textract:StartDocumentTextDetection","textract:GetDocumentTextDetection"],"Resource":"*"}]}'
$f = Write-Tmp $permJson
aws iam put-user-policy --user-name $UserName --policy-name $PolicyName --policy-document "file://$f"
Remove-Item $f -Force -Confirm:$false

Write-Host "Creating access key..."
$keyJson = aws iam create-access-key --user-name $UserName --output json | ConvertFrom-Json
$AccessKey = $keyJson.AccessKey.AccessKeyId
$SecretKey = $keyJson.AccessKey.SecretAccessKey

Write-Host "`n========================================"
Write-Host "PRIZM Local Dev Credentials"
Write-Host "========================================`n"
Write-Host "Add to .env.local:`n"
Write-Host "  AWS_REGION=$Region"
Write-Host "  AWS_ACCESS_KEY_ID=$AccessKey"
Write-Host "  AWS_SECRET_ACCESS_KEY=$SecretKey"
Write-Host "  S3_UPLOAD_BUCKET=$Bucket"
Write-Host "  S3_KMS_KEY_ID=$KmsArn"
Write-Host "`nSAVE THESE NOW. Secret shown once."
Write-Host "========================================"
