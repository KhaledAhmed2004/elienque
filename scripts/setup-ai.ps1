# scripts/setup-ai.ps1
# This script sets up the code-review-graph for any AI assistant (Antigravity, Cursor, etc.)

$PythonScriptsPath = "$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
$InstallCmd = "pip install --upgrade code-review-graph"

Write-Host "`n--- 🚀 AI Workflow Setup: code-review-graph ---" -ForegroundColor Cyan

# 1. Check for Python/Pip
if (!(Get-Command pip -ErrorAction SilentlyContinue)) {
    Write-Error "pip not found. Please install Python 3.10+ from python.org."
    exit 1
}

# 2. Install the tool
Write-Host "Installing/Updating code-review-graph..." -ForegroundColor Yellow
Invoke-Expression $InstallCmd

# 3. Add to User Path permanently
Write-Host "Configuring Environment..." -ForegroundColor Yellow
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$PythonScriptsPath*") {
    Write-Host "Adding $PythonScriptsPath to User PATH..." -ForegroundColor Gray
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$PythonScriptsPath", "User")
    # Update current session as well
    $env:Path += ";$PythonScriptsPath"
} else {
    Write-Host "PATH is already correctly configured." -ForegroundColor Green
}

# 4. Integrate with IDEs
Write-Host "Registering with Cursor..." -ForegroundColor Yellow
& code-review-graph install --platform cursor --yes

# 5. Build initial graph
Write-Host "Building project knowledge graph..." -ForegroundColor Yellow
& code-review-graph build

Write-Host "`n--- ✅ Setup Complete! ---" -ForegroundColor Cyan
Write-Host "NOTE: You may need to restart your terminal or IDE (Cursor/Trea) for the PATH changes to take effect." -ForegroundColor DarkGray
