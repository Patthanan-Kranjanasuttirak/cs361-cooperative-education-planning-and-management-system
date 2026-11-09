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
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_TOKEN (only with -GitHubRepo).
#>
[CmdletBinding()]
param(
  [string]$Prefix = 'cs361-coop-test',
  [string]$Region = 'ap-southeast-2',
  [string]$WebOrigin = 'http://localhost:5173',
  [string]$MockLogins = '',
  # Optional frontend: with -GitHubRepo the script also creates an Amplify app (infra/frontend.yaml) connected to that
  # repository and uses its URL as the web origin. Needs the GITHUB_TOKEN secret (a GitHub personal access token).
  [string]$GitHubRepo = '',
  [string]$GitHubBranch = 'main',
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
$FrontendStack = "$Prefix-web"
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

# Runs the AWS CLI where a failure is an expected answer (for example "parameter not found").
# Windows PowerShell 5.1 turns native stderr into a terminating error when ErrorActionPreference is Stop,
# even with 2>$null, so the preference is relaxed here. The exit code is left in $script:AwsQuietExit.
function Invoke-AwsQuiet {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArgs)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $script:Aws @CliArgs 2>&1
    $script:AwsQuietExit = $LASTEXITCODE
  }
  finally { $ErrorActionPreference = $previous }
  return @($output | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] })
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
    $found = Invoke-AwsQuiet ssm get-parameter --name $paramName --with-decryption --query Parameter.Value --output text --region $Region
    $password = if ($script:AwsQuietExit -eq 0) { ($found -join '').Trim() } else { '' }
    if ([string]::IsNullOrEmpty($password)) {
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
  Invoke-AwsQuiet cloudformation describe-stacks --stack-name $StackName --region $Region | Out-Null
  return ($script:AwsQuietExit -eq 0)
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

function Wait-AmplifyJob([string]$AppId, [string]$Branch, [string]$JobId) {
  $last = ''
  for ($i = 0; $i -lt 90; $i++) {
    $status = (Invoke-Aws amplify get-job --app-id $AppId --branch-name $Branch --job-id $JobId --region $Region --query job.summary.status --output text) -join ''
    if ($status -ne $last) { Write-Host "  Amplify build: $status"; $last = $status }
    if ($status -eq 'SUCCEED') { return }
    if ($status -eq 'FAILED' -or $status -eq 'CANCELLED') {
      throw "Amplify build $status. Open the Amplify console (app $AppId, branch $Branch) to read the build log."
    }
    Start-Sleep -Seconds 10
  }
  throw 'The Amplify build did not finish within 15 minutes.'
}

# Amplify serves the single-page app for client routes with its "404-200" rule, which in practice keeps the status 404
# (the hand-made production site behaves the same) and redirects /login to /login/. So the check is on the content:
# a client route must return the same app shell as the home page, whatever the status code is (200 or 404).
function Test-SpaFallback([string]$Origin) {
  $name = 'Frontend serves the app for a client route (SPA fallback)'
  $rootHtml = ''; $deepHtml = ''; $deepStatus = 0
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try { $rootHtml = (Invoke-WebRequest -UseBasicParsing -Uri "$Origin/").Content } catch { $rootHtml = '' }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "$Origin/login/"
      $deepStatus = [int]$response.StatusCode; $deepHtml = $response.Content
    }
    catch {
      $deepHtml = ''
      if ($_.Exception.Response) {
        $deepStatus = [int]$_.Exception.Response.StatusCode
        # Invoke-WebRequest has already read the body once, so rewind the stream before reading it again.
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream.CanSeek) { $stream.Position = 0 }
        $reader = New-Object System.IO.StreamReader($stream)
        $deepHtml = $reader.ReadToEnd(); $reader.Close()
      }
    }
    if ($rootHtml -match 'id="root"') { break }
    Start-Sleep -Seconds 5
  }
  $ok = ($rootHtml -match 'id="root"') -and ($deepHtml -match 'id="root"') -and (@(200, 404) -contains $deepStatus)
  $label = if ($ok) { 'PASS' } else { 'FAIL' }
  $color = if ($ok) { 'Green' } else { 'Red' }
  Write-Host ("[{0}] {1} - /login/ returned HTTP {2}" -f $label, $name, $deepStatus) -ForegroundColor $color
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
if ($GitHubRepo -and $GitHubRepo -notmatch '^https://github\.com/[A-Za-z0-9-]+/(?!.*\.git$)[A-Za-z0-9._-]+$') {
  throw "GitHubRepo must look like https://github.com/owner/repo (no .git, no trailing slash). Got: $GitHubRepo"
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
  if (Test-StackExists $FrontendStack) {
    Invoke-Aws cloudformation delete-stack --stack-name $FrontendStack --region $Region | Out-Null
    Invoke-Aws cloudformation wait stack-delete-complete --stack-name $FrontendStack --region $Region | Out-Null
    Write-Host "Deleted $FrontendStack"
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
$githubToken = ''
if ($GitHubRepo) {
  $githubToken = Read-SecretValue 'GitHub personal access token (GITHUB_TOKEN)' 'GITHUB_TOKEN'
  if ([string]::IsNullOrEmpty($githubToken)) {
    throw '-GitHubRepo needs a GitHub personal access token: set GITHUB_TOKEN or enter it when asked.'
  }
}

# ------------------------------------------------------------------ build
Build-Packages

# ------------------------------------------------------------------ stack 3, first pass (optional): the Amplify domain
# The CORS origin and the Cognito callback URL of stack 2 need the frontend domain, and the frontend needs values from
# stack 2, so the Amplify app is created first without a build and updated after stack 2.
# It runs before the slow database stack so that a GitHub or Amplify problem shows up within a minute.
if ($GitHubRepo) {
  Write-Step "Deploying $FrontendStack (Amplify app, first pass)"
  Invoke-Aws cloudformation deploy --stack-name $FrontendStack --template-file (Join-Path $InfraDir 'frontend.yaml') `
    --parameter-overrides "Prefix=$Prefix" "Repository=$GitHubRepo" "GitHubAccessToken=$githubToken" "BranchName=$GitHubBranch" `
    --no-fail-on-empty-changeset --region $Region | Out-Null
  $frontendOut = Get-StackOutputs $FrontendStack
  $WebOrigin = $frontendOut['WebOrigin']
  Write-Host "Frontend origin: $WebOrigin"
}

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

# ------------------------------------------------------------------ stack 3, second pass (optional): values and build
if ($GitHubRepo) {
  Write-Step "Updating $FrontendStack with the backend values and building the frontend"
  Invoke-Aws cloudformation deploy --stack-name $FrontendStack --template-file (Join-Path $InfraDir 'frontend.yaml') `
    --parameter-overrides "Prefix=$Prefix" "Repository=$GitHubRepo" "GitHubAccessToken=$githubToken" "BranchName=$GitHubBranch" `
    "ApiUrl=$($appOut['ApiUrl'])" "UserPoolId=$($appOut['UserPoolId'])" "UserPoolClientId=$($appOut['UserPoolClientId'])" "CognitoDomain=$($appOut['CognitoDomain'])" `
    --no-fail-on-empty-changeset --region $Region | Out-Null
  $jobId = (Invoke-Aws amplify start-job --app-id $frontendOut['AppId'] --branch-name $GitHubBranch --job-type RELEASE --region $Region --query jobSummary.jobId --output text) -join ''
  Write-Host "Started Amplify build $jobId"
  Wait-AmplifyJob $frontendOut['AppId'] $GitHubBranch $jobId
}

# ------------------------------------------------------------------ migrate
Invoke-Migration $appOut['BackendFunctionName']

# ------------------------------------------------------------------ smoke tests
$allPassed = $true
if (-not $SkipTests) { $allPassed = Invoke-SmokeTests $appOut['ApiUrl'] }
if ($GitHubRepo -and -not $SkipTests) {
  $allPassed = (Test-SpaFallback $WebOrigin) -and $allPassed
}

# ------------------------------------------------------------------ summary
if ($GitHubRepo) {
  Write-Step "Done. Frontend: $WebOrigin (built from $GitHubRepo, branch $GitHubBranch)"
  Write-Host 'The values below were already set in the Amplify app (listed so you can check them):'
}
else {
  Write-Step 'Done. Values for the frontend (Amplify environment variables or frontend/.env)'
  Write-Host 'Also set AMPLIFY_MONOREPO_APP_ROOT=frontend and AMPLIFY_DIFF_DEPLOY=false in Amplify, then redeploy.'
}
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
  Write-Host 'Some smoke tests failed. See AUTOMATION.md (section A8, troubleshooting).' -ForegroundColor Red
  exit 1
}
