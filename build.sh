#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 标题
echo "=========================================="
echo "  风灵月影宗 - 一键打包脚本"
echo "  FlingTrainer Manager Build Script"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Node.js，请先安装 Node.js (建议 v18+)${NC}"
    echo -e "${RED}[Error] Node.js not found. Please install Node.js (v18+ recommended)${NC}"
    exit 1
fi

echo -e "${GREEN}[✓] Node.js 已安装${NC}"
node --version
echo ""

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 npm${NC}"
    echo -e "${RED}[Error] npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}[✓] npm 已安装${NC}"
npm --version
echo ""

# 获取版本号
VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}[信息] 当前版本：${VERSION}${NC}"
echo ""

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[提示] 首次运行，正在安装依赖...${NC}"
    echo -e "${YELLOW}[Info] Installing dependencies for the first time...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[错误] 依赖安装失败${NC}"
        echo -e "${RED}[Error] Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}[✓] 依赖安装完成${NC}"
    echo ""
fi

# 清理旧的构建文件
echo -e "${BLUE}[提示] 清理旧的构建文件...${NC}"
echo -e "${BLUE}[Info] Cleaning old build files...${NC}"
rm -rf out dist
echo -e "${GREEN}[✓] 清理完成${NC}"
echo ""

# 执行构建
echo "=========================================="
echo "  开始构建..."
echo "  Starting build process..."
echo "=========================================="
echo ""

npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] 构建失败${NC}"
    echo -e "${RED}[Error] Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[✓] 构建完成${NC}"
echo ""

# 执行打包
echo "=========================================="
echo "  开始打包..."
echo "  Starting packaging process..."
echo "=========================================="
echo ""

npx electron-builder
if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] 打包失败${NC}"
    echo -e "${RED}[Error] Packaging failed${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  打包完成!${NC}"
echo -e "${GREEN}  Build completed successfully!${NC}"
echo "=========================================="
echo ""
echo -e "${BLUE}[输出目录] dist/${NC}"
echo -e "${BLUE}[安装包] 风灵月影宗 Setup ${VERSION}.exe${NC}"
echo -e "${BLUE}[便携版] 风灵月影宗-${VERSION}-Portable.exe${NC}"
echo ""