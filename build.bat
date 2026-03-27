@echo off
setlocal enabledelayedexpansion
cls

REM ==========================================
REM   FlingTrainer Manager Build Script
REM   Batch File Version (CMD)
REM ==========================================

echo ==========================================
echo   FlingTrainer Manager Build Script
echo   Batch File Version - Run in CMD
echo ==========================================
echo.
echo [NOTE] For PowerShell, please use: .\build.ps1
echo.

REM Check disk space (minimum 500MB recommended)
echo [INFO] Checking disk space...
for %%A in (.) do set "FREE_SPACE=%%~dA"
echo [INFO] Drive: %FREE_SPACE%
wmic logicaldisk where "DeviceID='%FREE_SPACE%'" get FreeSpace /value 2>nul | find "FreeSpace" >nul
if %errorlevel% neq 0 (
    echo [WARN] Could not determine free disk space
) else (
    echo [INFO] Disk space check completed
)
echo.

REM Check if Node.js is installed
echo [INFO] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js v18 or higher.
    echo [HELP] Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js is installed
for /f "tokens=*" %%a in ('node --version') do echo [VERSION] Node.js: %%a
echo.

REM Check if npm is installed
echo [INFO] Checking npm installation...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)

echo [OK] npm is installed
for /f "tokens=*" %%a in ('npm --version') do echo [VERSION] npm: %%a
echo.

REM Display project version
echo [INFO] Loading project version...
for /f "tokens=*" %%a in ('node -p "require('./package.json').version"') do set VERSION=%%a
echo [VERSION] Application Version: %VERSION%
echo [VERSION] Product Name: ^^^风灵月影宗
echo.

REM Check and install dependencies
echo [INFO] Checking dependencies...
if not exist "node_modules\" (
    echo [INFO] Dependencies not found, installing...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        echo [SOLUTION] Try running: npm cache clean --force ^&^& npm install
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed successfully
) else (
    echo [OK] Dependencies already installed
)
echo.

REM Clean old build files
echo [INFO] Cleaning previous build artifacts...
if exist "out" (
    echo [CLEAN] Removing out/ directory...
    rmdir /s /q "out"
)
if exist "dist" (
    echo [CLEAN] Removing dist/ directory...
    rmdir /s /q "dist"
)
echo [OK] Cleanup completed
echo.

REM Show build configuration
echo ==========================================
echo   Build Configuration
echo ==========================================
echo [CONFIG] Mode: Production
echo [CONFIG] Output: out/
echo [CONFIG] Package: dist/
echo [CONFIG] Platform: Windows x64
echo [CONFIG] Installer: NSIS
echo [CONFIG] Portable: Enabled
echo ==========================================
echo.

REM Step 1: Build production resources
echo ==========================================
echo   Step 1/2: Building production resources
echo ==========================================
echo.
echo [BUILD] Starting electron-vite build...
echo [TIME] Start time: %TIME%
echo.

call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed!
    echo [CHECK] Check for syntax errors in your code
    echo [LOG] See error messages above for details
    pause
    exit /b 1
)

echo.
echo [TIME] Build completed at: %TIME%
echo [OK] Build completed successfully
echo.

REM Check build output size
if exist "out" (
    echo [INFO] Calculating build output size...
    for /D %%I in (out\*) do (
        for %%A in ("%%I") do echo [SIZE] %%~nxA: %%~zA bytes
    )
)
echo.

REM Step 2: Package application
echo ==========================================
echo   Step 2/2: Packaging application
echo ==========================================
echo.
echo [PACKAGE] Starting electron-builder...
echo [TIME] Start time: %TIME%
echo.

call npm run dist
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Packaging failed!
    echo [CHECK] Common issues:
    echo   - Missing icon.ico file
    echo   - Insufficient disk space
    echo   - Antivirus interference
    echo [LOG] See error messages above for details
    pause
    exit /b 1
)

echo.
echo [TIME] Packaging completed at: %TIME%
echo [OK] Packaging completed successfully
echo.

REM Display output information
echo ==========================================
echo   BUILD COMPLETED SUCCESSFULLY
echo ==========================================
echo.
echo [OUTPUT] Files located in: dist/
echo.
if exist "dist" (
    echo [FILES] Generated files:
    dir /b dist 2>nul | findstr /i ".exe"
    echo.
    
    echo [SIZE] File sizes:
    for %%F in (dist\*.exe) do (
        set SIZE=%%~zF
        set NAME=%%~nxF
        call :FormatSize !SIZE! !NAME!
    )
)
echo.

echo [SUMMARY] Application: ^^^风灵月影宗 v%VERSION%
echo [SUMMARY] App ID: com.gdw.flingtrainermanager
echo [SUMMARY] Platform: Windows x64
echo [SUMMARY] Package Type: NSIS Installer + Portable
echo.

echo ==========================================
echo   Build Statistics
echo ==========================================
echo [STATS] Total files generated: 
dir /b dist 2>nul | find /c ".exe"
echo [STATS] Output directory: %CD%\dist
echo.

echo [NEXT STEPS]
echo   - Test the installer: dist\^^^风灵月影宗 Setup %VERSION%.exe
echo   - Test portable version: dist\^^^风灵月影宗-%VERSION%-Portable.exe
echo   - Verify application functionality
echo.

pause
exit /b 0

:FormatSize
set "SIZE=%1"
set "NAME=%2"
set /a "SIZE_MB=%SIZE%/1048576"
if %SIZE_MB% GEQ 1 (
    echo     %NAME%: %SIZE_MB% MB
) else (
    set /a "SIZE_KB=%SIZE%/1024"
    echo     %NAME%: %SIZE_KB% KB
)
exit /b 0
