@echo off
chcp 65001 >nul
cls

echo ==========================================
echo   FlingTrainer Manager Build Script
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js (v18+ recommended)
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found
    pause
    exit /b 1
)

echo [OK] npm is installed
npm --version
echo.

REM Get version number
for /f "tokens=*" %%a in ('node -p "require('./package.json').version"') do set VERSION=%%a
echo [INFO] Current version: %VERSION%
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] First run, installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
    echo.
)

REM Clean old build files
echo [INFO] Cleaning old build files...
if exist "out" rmdir /s /q "out"
if exist "dist" rmdir /s /q "dist"
echo [OK] Cleanup completed
echo.

REM Execute build
echo ==========================================
echo   Starting build process...
echo ==========================================
echo.

call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo [OK] Build completed
echo.

REM Execute packaging
echo ==========================================
echo   Starting packaging process...
echo ==========================================
echo.

call electron-builder
if %errorlevel% neq 0 (
    echo [ERROR] Packaging failed
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Build completed successfully!
echo ==========================================
echo.
echo [Output directory] dist/
echo [Installer] FlingTrainer Setup %VERSION%.exe
echo [Portable] FlingTrainer-%VERSION%-Portable.exe
echo.

pause