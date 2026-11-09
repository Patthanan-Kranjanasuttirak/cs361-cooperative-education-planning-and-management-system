<#
.SYNOPSIS
  Create or update a complete, separate copy of the CS361 co-op system on AWS (stack 1 + build + stack 2 + migrate + smoke test).

.DESCRIPTION
  Steps: pre-checks -> collect inputs -> build Lambda zips -> deploy network-data.yaml -> upload zips ->
         deploy app.yaml -> run database migration -> smoke test -> print the values the frontend needs.
  It is safe to run again: CloudFormation only changes what differs. Use -Destroy to remove the copy.
  Keep this file ASCII-only (Windows PowerShell 5.1 reads scripts with the system code page).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test

.EXAMPLE
  # After changing backend code: rebuild and push only the backend zip to the existing Lambda (a few minutes, no prompts)
  powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -CodeOnly

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -Destroy

.NOTES
  Secrets are read from environment variables or prompted (never written to disk, never committed):
    DB_PASSWORD (otherwise generated and kept in SSM Parameter Store), MOCK_PASSWORD, TU_API_KEY,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
#>
[CmdletBinding()]
param(
  [string]$Prefix = 'cs361-coop-test',
  [string]$Region = 'ap-southeast-2',
  [string]$WebOrigin = 'http://localhost:5173',
  [string]$MockLogins = '',
  [switch]$Seed,
  [switch]$SkipTests,
  [switch]$BuildOnly,
  [switch]$CodeOnly,
  [switch]$Migrate,
  [switch]$Destroy,
  [switch]$AllowExistingNames
)

$ErrorActionPreference = 'Stop'
$InfraDir = $PSScriptRoot
$RepoDir = Split-Path $InfraDir -Parent
$BuildDir = Join-Path $InfraDir '.build'
$DataStack = "$Prefix-data"
$AppStack = "$Prefix-app"
$TriggerNames = @('pre-sign-up', 'define-auth-challenge', 'create-auth-challenge', 'verify-auth-challenge')

function Write-Step([string]$Text) { Write-Host ''; Write-Host "==> $Text" -ForegroundColor Cyan }

function Resolve-Aws {
  $cmd = Get-Command aws -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $default = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
  if (Test-Path $default) { return $default }
  throw 'AWS CLI not found. Install it first (winget install -e --id Amazon.AWSCLI) and open a new terminal.'
}

# Runs the AWS CLI and stops the script when it fails. Returns the output lines.
function Invoke-Aws {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArgs)
  $result = & $script:Aws @CliArgs
  if ($LASTEXITCODE -ne 0) { throw "aws $($CliArgs[0]) $($CliArgs[1]) failed with exit code $LASTEXITCODE" }
  return $result
}

function Read-SecretValue([string]$Label, [string]$EnvName, [string]$Default = '') {
  $value = [Environment]::GetEnvironmentVariable($EnvName)
  if (-not [string]::IsNullOrEmpty($value)) { return $value }
  $secure = Read-Host -AsSecureString "$Label (press Enter to skip)"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ([string]::IsNullOrEmpty($plain)) { return $Default }
  return $plain
}

function New-RandomPassword([int]$Length = 24) {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
  $bytes = New-Object byte[] $Length
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  $rng.GetBytes($bytes)
  return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

# DB password: DB_PASSWORD env var, else the SecureString kept in SSM Parameter Store, else a new random one.
function Get-DbPassword {
  $paramName = "/$Prefix/deploy/db-password"
  $password = [Environment]::GetEnvironmentVariable('DB_PASSWORD')
  if ([string]::IsNullOrEmpty($password)) {
    $password = & $script:Aws ssm get-parameter --name $paramName --with-decryption --query Parameter.Value --output text --region $Region 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($password)) {
      $password = New-RandomPassword 24
      Write-Host "Generated a new database password and stored it in SSM Parameter Store ($paramName)."
    }
  }
  if ($password -notmatch '^[A-Za-z0-9_+=.-]{12,64}$') {
    throw 'DB_PASSWORD must be 12-64 characters of letters, digits and _ + = . -'
  }
  Invoke-Aws ssm put-parameter --name $paramName --type SecureString --value $password --overwrite --region $Region | Out-Null
  return $password
}

function Get-StackOutputs([string]$StackName) {
  $json = Invoke-Aws cloudformation describe-stacks --stack-name $StackName --query Stacks[0].Outputs --output json --region $Region
  $outputs = @{}
  foreach ($item in ($json -join '' | ConvertFrom-Json)) { $outputs[$item.OutputKey] = $item.OutputValue }
  return $outputs
}

function Test-StackExists([string]$StackName) {
  & $script:Aws cloudformation describe-stacks --stack-name $StackName --region $Region 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function New-Zip([string]$ZipPath, [string]$WorkDir, [string[]]$Items) {
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
  New-Item -ItemType Directory -Force -Path (Split-Path $ZipPath -Parent) | Out-Null
  # bsdtar (built into Windows 10/11) writes zip entries with forward slashes, which Lambda requires.
  # Compress-Archive in Windows PowerShell 5.1 writes backslashes and breaks the Lambda package.
  $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
  Push-Location $WorkDir
  try {
    & $tar -a -cf $ZipPath @Items
    if ($LASTEXITCODE -ne 0) { throw "tar failed while creating $ZipPath" }
  }
  finally { Pop-Location }
}

function Build-Packages {
  param([switch]$BackendOnly)
  Write-Step 'Building Lambda packages'
  if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
  $stage = Join-Path $BuildDir 'backend'
  New-Item -ItemType Directory -Force -Path $stage | Out-Null

  Copy-Item (Join-Path $RepoDir 'backend\src') (Join-Path $stage 'src') -Recurse
  Copy-Item (Join-Path $RepoDir 'backend\cognito-triggers') (Join-Path $stage 'cognito-triggers') -Recurse
  Copy-Item (Join-Path $RepoDir 'backend\package.json') $stage
  Copy-Item (Join-Path $RepoDir 'backend\package-lock.json') $stage

  # SQL files used by the "migrate" action (src/schema/{init,migrations,seeds})
  $schema = Join-Path $stage 'src\schema'
  New-Item -ItemType Directory -Force -Path $schema | Out-Null
  foreach ($dir in @('init', 'migrations', 'seeds')) {
    Copy-Item (Join-Path $RepoDir "database\$dir") (Join-Path $schema $dir) -Recurse
  }

  Push-Location $stage
  try {
    npm ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
  }
  finally { Pop-Location }

  New-Zip (Join-Path $BuildDir 'function.zip') $stage @('src', 'cognito-triggers', 'node_modules', 'package.json')
  if (-not $BackendOnly) {
    foreach ($name in $TriggerNames) {
      New-Zip (Join-Path $BuildDir "triggers\$name.zip") (Join-Path $RepoDir "backend\cognito-triggers\$name") @('index.mjs')
    }
  }
  $size = [math]::Round((Get-Item (Join-Path $BuildDir 'function.zip')).Length / 1MB, 1)
  if ($BackendOnly) { Write-Host "Built function.zip ($size MB) in $BuildDir" }
  else { Write-Host "Built function.zip ($size MB) and $($TriggerNames.Count) trigger zips in $BuildDir" }
}

# Calls the backend Lambda with the "migrate" action (creates or updates the database tables).
function Invoke-Migration([string]$FunctionName) {
  Write-Step 'Running database migration'
  New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
  $payloadPath = Join-Path $BuildDir 'migrate-payload.json'
  $seedFlag = if ($Seed) { 'true' } else { 'false' }
  Set-Content -Path $payloadPath -Value ('{"action":"migrate","seeds":' + $seedFlag + '}') -Encoding Ascii
  $outPath = Join-Path $BuildDir 'migrate-result.json'
  $invoke = (Invoke-Aws lambda invoke --function-name $FunctionName --payload ('file://' + ($payloadPath -replace '\\', '/')) `
    --cli-binary-format raw-in-base64-out --cli-read-timeout 300 --region $Region --output json $outPath) -join '' | ConvertFrom-Json
  if ($invoke.FunctionError) { throw "Migration failed: $(Get-Content $outPath -Raw)" }
  Write-Host (Get-Content $outPath -Raw)
}

function Test-Http {
  param([string]$Name, [string]$Method, [string]$Url, [int[]]$Expected, [hashtable]$Headers = @{}, [string]$HeaderName = '', [string]$HeaderValue = '')
  $status = 0; $responseHeaders = $null
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Url -Headers $Headers
      $status = [int]$response.StatusCode; $responseHeaders = $response.Headers
    }
    catch {
      if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        $responseHeaders = $_.Exception.Response.Headers
      }
      else { $status = 0 }
    }
    if ($status -ne 0 -and $status -lt 500) { break }
    Start-Sleep -Seconds 5
  }
  $ok = $Expected -contains $status
  $detail = "HTTP $status"
  if ($ok -and $HeaderName) {
    $actual = if ($responseHeaders) { [string]$responseHeaders[$HeaderName] } else { '' }
    if ($actual -ne $HeaderValue) { $ok = $false; $detail += " but $HeaderName is '$actual' (expected '$HeaderValue')" }
  }
  $label = if ($ok) { 'PASS' } else { 'FAIL' }
  $color = if ($ok) { 'Green' } else { 'Red' }
  Write-Host ("[{0}] {1} - {2}" -f $label, $Name, $detail) -ForegroundColor $color
  return $ok
}

function Invoke-SmokeTests([string]$Api) {
  Write-Step 'Smoke tests'
  $passed = $true
  $passed = (Test-Http 'GET /health is public' 'GET' "$Api/health" @(200)) -and $passed
  $passed = (Test-Http 'GET /companies is public' 'GET' "$Api/companies" @(200)) -and $passed
  $passed = (Test-Http 'GET /auth/me without a token is rejected' 'GET' "$Api/auth/me" @(401)) -and $passed
  $passed = (Test-Http 'OPTIONS /auth/me preflight returns the CORS origin' 'OPTIONS' "$Api/auth/me" @(200, 204) `
    @{ 'Origin' = $WebOrigin; 'Access-Control-Request-Method' = 'GET'; 'Access-Control-Request-Headers' = 'authorization' } `
    'Access-Control-Allow-Origin' $WebOrigin) -and $passed
  return $passed
}

# ------------------------------------------------------------------ build only (no AWS calls)
if ($BuildOnly) {
  Build-Packages
  Write-Host 'Build finished. Nothing was uploaded.'
  return
}

# ------------------------------------------------------------------ pre-checks
$script:Aws = Resolve-Aws
Write-Step 'Pre-checks'
$identity = (Invoke-Aws sts get-caller-identity --output json --region $Region) -join '' | ConvertFrom-Json
Write-Host "Account: $($identity.Account)"
Write-Host "Region:  $Region"
Write-Host "Prefix:  $Prefix (stacks: $DataStack, $AppStack)"

if ($Prefix -eq 'cs361-coop' -and -not $AllowExistingNames) {
  throw "Prefix 'cs361-coop' is used by the hand-made production resources (Lambda cs361-coop-api, ...), so creation would collide. Use another prefix such as cs361-coop-test."
}
if ($WebOrigin -notmatch '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$') {
  throw "WebOrigin must look like https://example.com with no trailing slash (a trailing slash breaks CORS). Got: $WebOrigin"
}

# ------------------------------------------------------------------ destroy
if ($Destroy) {
  Write-Step "Destroying $Prefix"
  $confirm = Read-Host "This deletes stacks $AppStack and $DataStack and the files in their buckets. Type the prefix ($Prefix) to confirm"
  if ($confirm -ne $Prefix) { throw 'Confirmation did not match. Nothing was deleted.' }
  $buckets = @()
  if (Test-StackExists $DataStack) {
    $dataOut = Get-StackOutputs $DataStack
    $buckets = @($dataOut['FilesBucketName'], $dataOut['ArtifactsBucketName'])
  }
  if (Test-StackExists $AppStack) {
    Invoke-Aws cloudformation delete-stack --stack-name $AppStack --region $Region | Out-Null
    Invoke-Aws cloudformation wait stack-delete-complete --stack-name $AppStack --region $Region | Out-Null
    Write-Host "Deleted $AppStack"
  }
  foreach ($bucket in $buckets) {
    if ($bucket) { Invoke-Aws s3 rm "s3://$bucket" --recursive --region $Region | Out-Null }
  }
  if (Test-StackExists $DataStack) {
    Invoke-Aws cloudformation delete-stack --stack-name $DataStack --region $Region | Out-Null
    Invoke-Aws cloudformation wait stack-delete-complete --stack-name $DataStack --region $Region | Out-Null
    Write-Host "Deleted $DataStack (RDS keeps one final snapshot; delete it in the RDS console if you do not need it)"
  }
  Write-Host "The SSM parameter /$Prefix/deploy/db-password was kept. Delete it with: aws ssm delete-parameter --name /$Prefix/deploy/db-password --region $Region"
  return
}

# ------------------------------------------------------------------ code only (backend update, no prompts)
# Rebuilds the backend zip and points the existing Lambda at it. CloudFormation is not touched, so the stack still
# records the older zip key until the next full deploy (which sets a new key anyway). API Gateway needs no redeploy.
if ($CodeOnly) {
  if (-not (Test-StackExists $DataStack) -or -not (Test-StackExists $AppStack)) {
    throw "Stacks $DataStack and $AppStack must exist. Run the full deploy first (without -CodeOnly)."
  }
  $dataOut = Get-StackOutputs $DataStack
  $appOut = Get-StackOutputs $AppStack
  $functionName = $appOut['BackendFunctionName']
  Build-Packages -BackendOnly
  Write-Step "Updating the code of $functionName"
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
  $backendKey = "backend/$stamp/function.zip"
  Invoke-Aws s3 cp (Join-Path $BuildDir 'function.zip') "s3://$($dataOut['ArtifactsBucketName'])/$backendKey" --region $Region | Out-Null
  Invoke-Aws lambda update-function-code --function-name $functionName --s3-bucket $dataOut['ArtifactsBucketName'] --s3-key $backendKey --region $Region | Out-Null
  Invoke-Aws lambda wait function-updated --function-name $functionName --region $Region | Out-Null
  Write-Host "$functionName now runs s3://$($dataOut['ArtifactsBucketName'])/$backendKey"
  if ($Migrate -or $Seed) { Invoke-Migration $functionName }
  if (-not $SkipTests) {
    if (-not (Invoke-SmokeTests $appOut['ApiUrl'])) { Write-Host 'Some smoke tests failed.' -ForegroundColor Red; exit 1 }
  }
  Write-Host 'Backend updated.'
  return
}

# ------------------------------------------------------------------ inputs
Write-Step 'Collecting inputs (secrets stay in memory only)'
$dbPassword = Get-DbPassword
$mockPassword = Read-SecretValue 'Demo login password (MOCK_PASSWORD)' 'MOCK_PASSWORD'
$tuApiKey = Read-SecretValue 'TU API Application-Key (TU_API_KEY)' 'TU_API_KEY'
$googleClientId = [Environment]::GetEnvironmentVariable('GOOGLE_CLIENT_ID')
if ([string]::IsNullOrEmpty($googleClientId)) { $googleClientId = Read-Host 'Google OAuth client ID (press Enter to use "unused")' }
if ([string]::IsNullOrEmpty($googleClientId)) { $googleClientId = 'unused' }
$googleClientSecret = Read-SecretValue 'Google OAuth client secret (GOOGLE_CLIENT_SECRET)' 'GOOGLE_CLIENT_SECRET' 'unused'
if ($mockPassword -and -not $MockLogins) {
  Write-Host 'Note: MOCK_PASSWORD is set but -MockLogins is empty, so no demo login will work.' -ForegroundColor Yellow
}

# ------------------------------------------------------------------ build
Build-Packages

# ------------------------------------------------------------------ stack 1
Write-Step "Deploying $DataStack (network, database, buckets) - the database takes 10-15 minutes the first time"
$prefixList = (Invoke-Aws ec2 describe-managed-prefix-lists --filters "Name=prefix-list-name,Values=com.amazonaws.$Region.s3" --query PrefixLists[0].PrefixListId --output text --region $Region) -join ''
if ($prefixList -notmatch '^pl-[0-9a-f]+$') { throw "Could not find the S3 prefix list for $Region (got '$prefixList')" }
Invoke-Aws cloudformation deploy --stack-name $DataStack --template-file (Join-Path $InfraDir 'network-data.yaml') `
  --parameter-overrides "Prefix=$Prefix" "S3PrefixListId=$prefixList" "DbPassword=$dbPassword" `
  --no-fail-on-empty-changeset --region $Region | Out-Null
$dataOut = Get-StackOutputs $DataStack
Write-Host "Database host: $($dataOut['DbHost'])"

# ------------------------------------------------------------------ upload
Write-Step 'Uploading Lambda packages'
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$artifacts = $dataOut['ArtifactsBucketName']
$backendKey = "backend/$stamp/function.zip"
$triggerPrefix = "triggers/$stamp/"
Invoke-Aws s3 cp (Join-Path $BuildDir 'function.zip') "s3://$artifacts/$backendKey" --region $Region | Out-Null
foreach ($name in $TriggerNames) {
  Invoke-Aws s3 cp (Join-Path $BuildDir "triggers\$name.zip") "s3://$artifacts/$triggerPrefix$name.zip" --region $Region | Out-Null
}
Write-Host "Uploaded to s3://$artifacts ($stamp)"

# ------------------------------------------------------------------ stack 2
Write-Step "Deploying $AppStack (IAM, Lambda, Cognito, API Gateway)"
$overrides = @(
  "Prefix=$Prefix", "BackendCodeKey=$backendKey", "TriggerKeyPrefix=$triggerPrefix", "WebOrigin=$WebOrigin",
  "DbPassword=$dbPassword", "GoogleClientId=$googleClientId", "GoogleClientSecret=$googleClientSecret",
  "ApiDeploymentVersion=$stamp"
)
if ($MockLogins) { $overrides += "MockLogins=$MockLogins" }
if ($mockPassword) { $overrides += "MockPassword=$mockPassword" }
if ($tuApiKey) { $overrides += "TuApiKey=$tuApiKey" }
Invoke-Aws cloudformation deploy --stack-name $AppStack --template-file (Join-Path $InfraDir 'app.yaml') `
  --capabilities CAPABILITY_IAM --parameter-overrides @overrides `
  --no-fail-on-empty-changeset --region $Region | Out-Null
$appOut = Get-StackOutputs $AppStack

# ------------------------------------------------------------------ migrate
Invoke-Migration $appOut['BackendFunctionName']

# ------------------------------------------------------------------ smoke tests
$allPassed = $true
if (-not $SkipTests) { $allPassed = Invoke-SmokeTests $appOut['ApiUrl'] }

# ------------------------------------------------------------------ summary
Write-Step 'Done. Values for the frontend (Amplify environment variables or frontend/.env)'
Write-Host "VITE_AUTH_MODE            = cognito"
Write-Host "VITE_API_URL              = $($appOut['ApiUrl'])"
Write-Host "VITE_COGNITO_USER_POOL_ID = $($appOut['UserPoolId'])"
Write-Host "VITE_COGNITO_CLIENT_ID    = $($appOut['UserPoolClientId'])"
Write-Host "VITE_COGNITO_DOMAIN       = $($appOut['CognitoDomain'])"
Write-Host ''
Write-Host "Google Cloud redirect URI (add it to the OAuth client if you use Google login):"
Write-Host "  $($appOut['GoogleRedirectUri'])"
Write-Host ''
Write-Host "Remove this copy when finished: powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix $Prefix -Destroy"
if (-not $allPassed) {
  Write-Host 'Some smoke tests failed. See infra/README.md (Troubleshooting).' -ForegroundColor Red
  exit 1
}
