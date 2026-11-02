# Builds JSONsetRight.exe and signs it with Azure Artifact Signing.
#
# Run with:  npm run build:signed
# Output:    release\JSONsetRight.exe (signed and timestamped, ready to attach to a GitHub Release)
#
# Signing opens a Microsoft sign-in page in your browser. Sign in with the account that has the
# "Artifact Signing Certificate Profile Signer" role on the signing account.
# Account details are in src-tauri\signing\metadata.json; the Azure directory (tenant) ID is in
# src-tauri\signing\tenant-id.txt. Neither is a secret.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$signingDir = Join-Path $root "src-tauri\signing"
$metadata = Join-Path $signingDir "metadata.json"
$tenantId = (Get-Content (Join-Path $signingDir "tenant-id.txt") -Raw).Trim()

# Signing tools: the newest Windows SDK signtool, and Microsoft's Artifact Signing plug-in.
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
  Sort-Object { [version]$_.Directory.Parent.Name } -Descending | Select-Object -First 1
$dlib = Join-Path $env:LOCALAPPDATA "Microsoft\MicrosoftArtifactSigningClientTools\Azure.CodeSigning.Dlib.dll"
if (-not $signtool) { throw "signtool.exe not found. Install the Windows SDK signing tools (Visual Studio Build Tools include them)." }
if (-not (Test-Path $dlib)) { throw "Artifact Signing plug-in not found. Install it with: winget install -e --id Microsoft.Azure.ArtifactSigningClientTools" }

Write-Host "1/3  Building JSONsetRight..." -ForegroundColor Cyan
Push-Location $root
try {
  npm run tauri build -- --no-bundle
  if ($LASTEXITCODE -ne 0) { throw "Build failed." }
} finally {
  Pop-Location
}

$releaseDir = Join-Path $root "release"
New-Item -ItemType Directory -Force $releaseDir | Out-Null
$exe = Join-Path $releaseDir "JSONsetRight.exe"
Copy-Item (Join-Path $root "src-tauri\target\release\jsonsetright.exe") $exe -Force

Write-Host "2/3  Signing (a Microsoft sign-in page will open in your browser)..." -ForegroundColor Cyan
# Only for this script's run: tells the browser sign-in which Azure directory to use.
$env:AZURE_TENANT_ID = $tenantId
& $signtool.FullName sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 /dlib $dlib /dmdf $metadata $exe
if ($LASTEXITCODE -ne 0) { throw "Signing failed. (403 Forbidden usually means the signing role is missing or still taking effect.)" }

Write-Host "3/3  Checking the signature..." -ForegroundColor Cyan
& $signtool.FullName verify /pa $exe
if ($LASTEXITCODE -ne 0) { throw "The signature could not be verified." }
$signature = Get-AuthenticodeSignature $exe
Write-Host ""
Write-Host "Done: $exe" -ForegroundColor Green
Write-Host "Version:   $((Get-Item $exe).VersionInfo.ProductVersion)"
Write-Host "Signed by: $($signature.SignerCertificate.Subject)"
Write-Host "Status:    $($signature.Status)"
