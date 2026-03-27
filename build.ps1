# FlingTrainer Manager Build Script
# PowerShell Native Version

Write-Host "=========================================="
Write-Host "  FlingTrainer Manager Build Script"
Write-Host "  PowerShell Native Version"
Write-Host "=========================================="
Write-Host ""

# Check disk space
Write-Host "[INFO] Checking disk space..." -ForegroundColor Cyan
try {
    $drive = (Get-Location).Drive.Name
    $disk = Get-PSDrive -Name $drive -ErrorAction Stop
    $freeSpaceGB = [math]::Round($disk.Free / 1GB, 2)
    Write-Host "[INFO] Drive: $drive" -ForegroundColor Gray
    Write-Host "[INFO] Free space: ${freeSpaceGB}GB" -ForegroundColor Gray
    
    if ($disk.Free -lt 500MB) {
        Write-Host "[WARN] Low disk space detected (< 500MB)" -ForegroundColor Yellow
    } else {
        Write-Host "[OK] Disk space check completed" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] Could not determine free disk space" -ForegroundColor Yellow
}
Write-Host ""

# Check Node.js
Write-Host "[INFO] Checking Node.js installation..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Node.js is installed" -ForegroundColor Green
        Write-Host "[VERSION] Node.js: $nodeVersion" -ForegroundColor Gray
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host "[ERROR] Node.js not found. Please install Node.js v18 or higher." -ForegroundColor Red
    Write-Host "[HELP] Download from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Check npm
Write-Host "[INFO] Checking npm installation..." -ForegroundColor Cyan
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] npm is installed" -ForegroundColor Green
        Write-Host "[VERSION] npm: $npmVersion" -ForegroundColor Gray
    } else {
        throw "npm not found"
    }
} catch {
    Write-Host "[ERROR] npm not found. Please reinstall Node.js." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Display project version
Write-Host "[INFO] Loading project version..." -ForegroundColor Cyan
try {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $version = $packageJson.version
    $productName = $packageJson.build.productName
    Write-Host "[VERSION] Application Version: $version" -ForegroundColor Gray
    Write-Host "[VERSION] Product Name: $productName" -ForegroundColor Gray
} catch {
    Write-Host "[WARN] Could not read package.json" -ForegroundColor Yellow
    $version = "unknown"
}
Write-Host ""

# Check and install dependencies
Write-Host "[INFO] Checking dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Dependencies not found, installing..." -ForegroundColor Yellow
    Write-Host ""
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        Write-Host "[SOLUTION] Try running: npm cache clean --force && npm install" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host ""
    Write-Host "[OK] Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "[OK] Dependencies already installed" -ForegroundColor Green
}
Write-Host ""

# Clean old build files
Write-Host "[INFO] Cleaning previous build artifacts..." -ForegroundColor Cyan
if (Test-Path "out") {
    Write-Host "[CLEAN] Removing out/ directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "out" -ErrorAction SilentlyContinue
}
if (Test-Path "dist") {
    Write-Host "[CLEAN] Removing dist/ directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
}
Write-Host "[OK] Cleanup completed" -ForegroundColor Green
Write-Host ""

# Show build configuration
Write-Host "=========================================="
Write-Host "  Build Configuration"
Write-Host "=========================================="
Write-Host "[CONFIG] Mode: Production" -ForegroundColor Gray
Write-Host "[CONFIG] Output: out/" -ForegroundColor Gray
Write-Host "[CONFIG] Package: dist/" -ForegroundColor Gray
Write-Host "[CONFIG] Platform: Windows x64" -ForegroundColor Gray
Write-Host "[CONFIG] Installer: NSIS" -ForegroundColor Gray
Write-Host "[CONFIG] Portable: ZIP Archive" -ForegroundColor Gray
Write-Host "=========================================="
Write-Host ""

# Step 1: Build production resources
Write-Host "=========================================="
Write-Host "  Step 1/2: Building production resources"
Write-Host "=========================================="
Write-Host ""
Write-Host "[BUILD] Starting electron-vite build..." -ForegroundColor Cyan
$startTime = Get-Date
Write-Host "[TIME] Start time: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Gray
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    Write-Host "[CHECK] Check for syntax errors in your code" -ForegroundColor Yellow
    Write-Host "[LOG] See error messages above for details" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
$endTime = Get-Date
Write-Host "[TIME] Build completed at: $($endTime.ToString('HH:mm:ss'))" -ForegroundColor Gray
Write-Host "[OK] Build completed successfully" -ForegroundColor Green
Write-Host ""

# Check build output size
if (Test-Path "out") {
    Write-Host "[INFO] Calculating build output size..." -ForegroundColor Cyan
    Get-ChildItem "out" -Directory | ForEach-Object {
        $size = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "[SIZE] $($_.Name): ${sizeMB} MB" -ForegroundColor Gray
    }
}
Write-Host ""

# Step 2: Package application
Write-Host "=========================================="
Write-Host "  Step 2/2: Packaging application"
Write-Host "=========================================="
Write-Host ""
Write-Host "[PACKAGE] Starting electron-builder..." -ForegroundColor Cyan
$startTime = Get-Date
Write-Host "[TIME] Start time: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Gray
Write-Host ""

npm run dist
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Packaging failed!" -ForegroundColor Red
    Write-Host "[CHECK] Common issues:" -ForegroundColor Yellow
    Write-Host "  - Missing icon.ico file" -ForegroundColor Gray
    Write-Host "  - Insufficient disk space" -ForegroundColor Gray
    Write-Host "  - Antivirus interference" -ForegroundColor Gray
    Write-Host "[LOG] See error messages above for details" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
$endTime = Get-Date
Write-Host "[TIME] Packaging completed at: $($endTime.ToString('HH:mm:ss'))" -ForegroundColor Gray
Write-Host "[OK] Packaging completed successfully" -ForegroundColor Green
Write-Host ""

# Display output information
Write-Host "=========================================="
Write-Host "  BUILD COMPLETED SUCCESSFULLY"
Write-Host "=========================================="
Write-Host ""
Write-Host "[OUTPUT] Files located in: dist/" -ForegroundColor Cyan
Write-Host ""

if (Test-Path "dist") {
    Write-Host "[FILES] Generated files:" -ForegroundColor Gray
    Get-ChildItem "dist\*.exe" | ForEach-Object {
        Write-Host "  $($_.Name)" -ForegroundColor White
    }
    Get-ChildItem "dist\*.zip" | ForEach-Object {
        Write-Host "  $($_.Name)" -ForegroundColor White
    }
    Write-Host ""
    
    Write-Host "[SIZE] File sizes:" -ForegroundColor Gray
    Get-ChildItem "dist\*.exe" | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  $($_.Name): ${sizeMB} MB" -ForegroundColor White
    }
    Get-ChildItem "dist\*.zip" | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  $($_.Name): ${sizeMB} MB" -ForegroundColor White
    }
    Write-Host ""
}

Write-Host "[SUMMARY] Application: $productName v$version" -ForegroundColor Cyan
Write-Host "[SUMMARY] App ID: com.gdw.flingtrainermanager" -ForegroundColor Gray
Write-Host "[SUMMARY] Platform: Windows x64" -ForegroundColor Gray
Write-Host "[SUMMARY] Package Type: NSIS Installer + ZIP Archive" -ForegroundColor Gray
Write-Host ""

Write-Host "=========================================="
Write-Host "  Build Statistics"
Write-Host "=========================================="
$exeCount = (Get-ChildItem "dist\*.exe" -ErrorAction SilentlyContinue | Measure-Object).Count
$zipCount = (Get-ChildItem "dist\*.zip" -ErrorAction SilentlyContinue | Measure-Object).Count
$totalFiles = $exeCount + $zipCount
Write-Host "[STATS] Total files generated: $totalFiles" -ForegroundColor Gray
Write-Host "[STATS] Output directory: $(Get-Location)\dist" -ForegroundColor Gray
Write-Host ""

Write-Host "[NEXT STEPS]" -ForegroundColor Cyan
Write-Host "  - Test the installer: dist\$productName Setup $version.exe" -ForegroundColor Gray
Write-Host "  - Extract portable: dist\$productName-$version-win.zip" -ForegroundColor Gray
Write-Host "  - Verify application functionality" -ForegroundColor Gray
Write-Host ""

Write-Host "Build completed! Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
