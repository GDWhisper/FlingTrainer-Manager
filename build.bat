@echo off
chcp 65001 >nul
cls

echo ==========================================
echo   风灵月影宗 - 一键打包脚本
echo   FlingTrainer Manager Build Script
echo ==========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (建议 v18+)
    echo [Error] Node.js not found. Please install Node.js (v18+ recommended)
    pause
    exit /b 1
)

echo [✓] Node.js 已安装
node --version
echo.

REM 检查 npm 是否安装
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 npm
    echo [Error] npm not found
    pause
    exit /b 1
)

echo [✓] npm 已安装
npm --version
echo.

REM 获取版本号
for /f "tokens=*" %%a in ('node -p "require('./package.json').version"') do set VERSION=%%a
echo [信息] 当前版本：%VERSION%
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [提示] 首次运行，正在安装依赖...
    echo [Info] Installing dependencies for the first time...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        echo [Error] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [✓] 依赖安装完成
    echo.
)

REM 清理旧的构建文件
echo [提示] 清理旧的构建文件...
echo [Info] Cleaning old build files...
if exist "out" rmdir /s /q "out"
if exist "dist" rmdir /s /q "dist"
echo [✓] 清理完成
echo.

REM 执行构建
echo ==========================================
echo   开始构建...
echo   Starting build process...
echo ==========================================
echo.

call npm run build
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    echo [Error] Build failed
    pause
    exit /b 1
)

echo.
echo [✓] 构建完成
echo.

REM 执行打包
echo ==========================================
echo   开始打包...
echo   Starting packaging process...
echo ==========================================
echo.

call electron-builder
if %errorlevel% neq 0 (
    echo [错误] 打包失败
    echo [Error] Packaging failed
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   打包完成!
echo   Build completed successfully!
echo ==========================================
echo.
echo [输出目录] dist/
echo [安装包] 风灵月影宗 Setup %VERSION%.exe
echo [便携版] 风灵月影宗-%VERSION%-Portable.exe
echo.

pause
