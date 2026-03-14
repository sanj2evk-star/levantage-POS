# Le Vantage Print Proxy - Setup Script
# Right-click this file > "Run with PowerShell"

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "    Le Vantage Print Proxy v3.0 - Setup" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""

# ── Check Node.js ──────────────────────────────
Write-Host "  Checking Node.js..." -ForegroundColor Cyan

$nodePath = $null

# Try PATH first
try {
    $nodeVer = & node -v 2>$null
    if ($LASTEXITCODE -eq 0) { $nodePath = "node" }
} catch {}

# Try common location
if (-not $nodePath) {
    $commonPath = "C:\Program Files\nodejs\node.exe"
    if (Test-Path $commonPath) {
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
        $nodePath = $commonPath
        $nodeVer = & node -v
    }
}

# Try refreshing PATH from registry
if (-not $nodePath) {
    Write-Host "  Refreshing PATH from registry..." -ForegroundColor Yellow
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:PATH = "$machinePath;$userPath"
    try {
        $nodeVer = & node -v 2>$null
        if ($LASTEXITCODE -eq 0) { $nodePath = "node" }
    } catch {}
}

if (-not $nodePath) {
    Write-Host ""
    Write-Host "  [ERROR] Node.js is NOT installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Steps:" -ForegroundColor Yellow
    Write-Host "    1. Go to https://nodejs.org"
    Write-Host "    2. Click 'Download Node.js (LTS)'"
    Write-Host "    3. Run the installer (Next > Next > Finish)"
    Write-Host "    4. RESTART your laptop"
    Write-Host "    5. Run this setup again"
    Write-Host ""
    Start-Process "https://nodejs.org"
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host "  [OK] Node.js $nodeVer" -ForegroundColor Green
Write-Host ""

# ── Install directory ──────────────────────────
$dir = "$env:USERPROFILE\LeVantage-PrintProxy"
Write-Host "  Install path: $dir"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
if (-not (Test-Path "$dir\ui")) { New-Item -ItemType Directory -Path "$dir\ui" | Out-Null }
Write-Host ""

# ── Download files ─────────────────────────────
Write-Host "  Downloading files from GitHub..." -ForegroundColor Cyan
$base = "https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server"

$files = @(
    @("index.js", "index.js"),
    @("package.json", "package.json"),
    @("electron-main.js", "electron-main.js"),
    @("preload.js", "preload.js"),
    @("ui/index.html", "ui\index.html")
)

foreach ($f in $files) {
    $url = "$base/$($f[0])"
    $out = "$dir\$($f[1])"
    try {
        Invoke-WebRequest -Uri $url -OutFile $out -ErrorAction Stop
        Write-Host "    [OK] $($f[0])" -ForegroundColor Green
    } catch {
        Write-Host "    [FAIL] $($f[0])" -ForegroundColor Red
    }
}

if (-not (Test-Path "$dir\electron-main.js")) {
    Write-Host ""
    Write-Host "  [ERROR] Download failed! Check internet." -ForegroundColor Red
    Read-Host "  Press Enter to close"
    exit 1
}
Write-Host ""

# ── Setup .env ─────────────────────────────────
if (-not (Test-Path "$dir\.env")) {
    Write-Host "  .env file not found - creating one..." -ForegroundColor Yellow
    @"
SUPABASE_URL=https://ivhmvhnrxiodpneflszu.supabase.co
SUPABASE_KEY=PASTE_YOUR_ANON_KEY_HERE
"@ | Set-Content "$dir\.env"
    Write-Host "  Opening .env in Notepad..."
    Write-Host "  Replace PASTE_YOUR_ANON_KEY_HERE with your Supabase anon key." -ForegroundColor Yellow
    Write-Host "  Save and close Notepad to continue." -ForegroundColor Yellow
    Write-Host ""
    Start-Process notepad "$dir\.env" -Wait
    Write-Host "  [OK] .env saved" -ForegroundColor Green
} else {
    Write-Host "  [OK] .env already exists" -ForegroundColor Green
}
Write-Host ""

# ── Install dependencies ───────────────────────
Write-Host "  Installing dependencies (this takes 1-2 minutes)..." -ForegroundColor Cyan
Set-Location $dir
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install 2>nul" -WorkingDirectory $dir -Wait -NoNewWindow
Write-Host "  [OK] Dependencies installed" -ForegroundColor Green
Write-Host ""

# ── Create run.bat launcher ────────────────────
@"
@echo off
title Le Vantage Print Proxy
cd /d "$dir"
npx electron .
"@ | Set-Content "$dir\run.bat"

# ── Desktop shortcut ───────────────────────────
Write-Host "  Creating desktop shortcut..." -ForegroundColor Cyan
$desktop = [Environment]::GetFolderPath("Desktop")
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("$desktop\LeVantage Print Proxy.lnk")
$sc.TargetPath = "$dir\run.bat"
$sc.WorkingDirectory = $dir
$sc.Description = "Le Vantage Print Proxy"
$sc.WindowStyle = 7
$sc.Save()
Write-Host "  [OK] Shortcut created on Desktop" -ForegroundColor Green
Write-Host ""

# ── Auto-start ─────────────────────────────────
$autoStart = Read-Host "  Auto-start on Windows boot? (Y/N)"
if ($autoStart -eq "Y" -or $autoStart -eq "y") {
    $startup = [Environment]::GetFolderPath("Startup")
    $sc2 = $ws.CreateShortcut("$startup\LeVantage Print Proxy.lnk")
    $sc2.TargetPath = "$dir\run.bat"
    $sc2.WorkingDirectory = $dir
    $sc2.WindowStyle = 7
    $sc2.Save()
    Write-Host "  [OK] Auto-start enabled" -ForegroundColor Green
}
Write-Host ""

# ── Done ───────────────────────────────────────
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "    SETUP COMPLETE!" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Double-click 'LeVantage Print Proxy' on Desktop to start."
Write-Host ""

$launch = Read-Host "  Launch now? (Y/N)"
if ($launch -eq "Y" -or $launch -eq "y") {
    Write-Host "  Starting..." -ForegroundColor Cyan
    Set-Location $dir
    Start-Process "npx" "electron ." -WorkingDirectory $dir
}

Write-Host ""
Read-Host "  Press Enter to close"
