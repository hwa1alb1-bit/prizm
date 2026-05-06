param(
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"

function Write-Tmp($content) {
    $f = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($f, $content, [System.Text.UTF8Encoding]::new($false))
    return $f
}

$Region = "us-east-1"
$RuleSetName = "prizm-inbound"
$RuleName = "store-prizm-inbound-email"
$AccountId = aws sts get-caller-identity --query Account --output text
$Bucket = "prizm-ses-receipts-${AccountId}-${Region}"

$Recipients = @(
    "dmarc@prizmview.app",
    "dpo@prizmview.app",
    "legal@prizmview.app",
    "privacy@prizmview.app",
    "security@prizmview.app",
    "support@prizmview.app"
)

Write-Host "Account: $AccountId  Region: $Region"
Write-Host "Rule set: $RuleSetName  Rule: $RuleName"
Write-Host "Bucket: $Bucket"
Write-Host "Recipients: $($Recipients -join ', ')"

# ── 1. Ensure rule set exists and is active ─────────────────────────
Write-Host "`n[1/4] Rule set..."
$active = aws ses describe-active-receipt-rule-set --region $Region --query "Metadata.Name" --output text 2>$null
if ($active -eq $RuleSetName) {
    Write-Host "  active: $RuleSetName"
} else {
    if (-not $DryRun) {
        aws ses create-receipt-rule-set --rule-set-name $RuleSetName --region $Region 2>$null
        aws ses set-active-receipt-rule-set --rule-set-name $RuleSetName --region $Region
    }
    Write-Host "  created and activated: $RuleSetName"
}

# ── 2. Ensure S3 bucket exists ──────────────────────────────────────
Write-Host "`n[2/4] S3 bucket..."
aws s3api head-bucket --bucket $Bucket 2>$null
if ($LASTEXITCODE -ne 0) {
    if (-not $DryRun) {
        aws s3api create-bucket --bucket $Bucket --region $Region | Out-Null
        aws s3api put-public-access-block --bucket $Bucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
        $enc = Write-Tmp '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":false}]}'
        aws s3api put-bucket-encryption --bucket $Bucket --server-side-encryption-configuration "file://$enc"
        Remove-Item $enc -Force -Confirm:$false
        $policy = '{"Version":"2012-10-17","Statement":[{"Sid":"AllowSESPuts","Effect":"Allow","Principal":{"Service":"ses.amazonaws.com"},"Action":"s3:PutObject","Resource":"arn:aws:s3:::' + $Bucket + '/raw/*","Condition":{"StringEquals":{"AWS:SourceAccount":"' + $AccountId + '"}}}]}'
        $f = Write-Tmp $policy
        aws s3api put-bucket-policy --bucket $Bucket --policy "file://$f"
        Remove-Item $f -Force -Confirm:$false
    }
    Write-Host "  created with encryption + SES policy"
} else {
    Write-Host "  exists"
}

# ── 3. Create or update receipt rule ────────────────────────────────
Write-Host "`n[3/4] Receipt rule..."
$recipientsList = ($Recipients | ForEach-Object { "`"$_`"" }) -join ","
$ruleJson = @"
{
    "Name": "$RuleName",
    "Enabled": true,
    "TlsPolicy": "Optional",
    "Recipients": [$recipientsList],
    "Actions": [
        {
            "S3Action": {
                "BucketName": "$Bucket",
                "ObjectKeyPrefix": "raw/"
            }
        }
    ],
    "ScanEnabled": true
}
"@

if ($DryRun) {
    Write-Host "  [DRY RUN] would apply:"
    Write-Host $ruleJson
} else {
    $f = Write-Tmp $ruleJson
    $existing = aws ses describe-receipt-rule --rule-set-name $RuleSetName --rule-name $RuleName --region $Region 2>$null
    if ($LASTEXITCODE -eq 0) {
        aws ses update-receipt-rule --rule-set-name $RuleSetName --rule "file://$f" --region $Region
        Write-Host "  updated"
    } else {
        aws ses create-receipt-rule --rule-set-name $RuleSetName --rule "file://$f" --region $Region
        Write-Host "  created"
    }
    Remove-Item $f -Force -Confirm:$false
}

# ── 4. Verify ──────────────────────────────────────────────────────
Write-Host "`n[4/4] Verification..."
$result = aws ses describe-active-receipt-rule-set --region $Region --output json | ConvertFrom-Json
$rule = $result.Rules | Where-Object { $_.Name -eq $RuleName }
if ($rule) {
    Write-Host "  Recipients: $($rule.Recipients -join ', ')"
    Write-Host "  Enabled: $($rule.Enabled)"
    Write-Host "  S3 Bucket: $($rule.Actions[0].S3Action.BucketName)"
    Write-Host "  S3 Prefix: $($rule.Actions[0].S3Action.ObjectKeyPrefix)"
} else {
    Write-Host "  WARNING: rule not found in active rule set"
}

Write-Host "`n========================================"
Write-Host "SES Inbound Setup Complete"
Write-Host "========================================"
