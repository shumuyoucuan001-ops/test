#!/bin/bash

# 新版本发布脚本
# 使用方法: ./scripts/release-new-version.sh 25.10.02.02 "更新内容描述"

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
  echo -e "${RED}错误: 请提供版本号${NC}"
  echo "使用方法: ./scripts/release-new-version.sh 25.10.02.02 \"更新内容\""
  exit 1
fi

NEW_VERSION=$1
RELEASE_NOTES=${2:-"常规更新"}

# 计算version code (去掉点号)
VERSION_CODE=$(echo $NEW_VERSION | tr -d '.')

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}准备发布新版本: ${NEW_VERSION}${NC}"
echo -e "${GREEN}版本代码: ${VERSION_CODE}${NC}"
echo -e "${GREEN}========================================${NC}"

# 步骤1: 更新build.gradle
echo -e "\n${YELLOW}步骤1: 更新build.gradle版本号...${NC}"
cd "$(dirname "$0")/.."
BUILD_GRADLE="SmLabelAppRN/android/app/build.gradle"

sed -i.bak "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$BUILD_GRADLE"
sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" "$BUILD_GRADLE"
rm "${BUILD_GRADLE}.bak"
echo -e "${GREEN}✓ build.gradle 已更新${NC}"

# 步骤2: 更新App.tsx
echo -e "\n${YELLOW}步骤2: 更新App.tsx版本号...${NC}"
APP_TSX="SmLabelAppRN/App.tsx"
sed -i.bak "s/const APP_VERSION = '[^']*'/const APP_VERSION = '$NEW_VERSION'/" "$APP_TSX"
rm "${APP_TSX}.bak"
echo -e "${GREEN}✓ App.tsx 已更新${NC}"

# 步骤3: 更新HomeScreen.tsx
echo -e "\n${YELLOW}步骤3: 更新HomeScreen.tsx版本号...${NC}"
HOME_SCREEN="SmLabelAppRN/src/screens/HomeScreen.tsx"
sed -i.bak "s/const APP_VERSION = '[^']*'/const APP_VERSION = '$NEW_VERSION'/" "$HOME_SCREEN"
rm "${HOME_SCREEN}.bak"
echo -e "${GREEN}✓ HomeScreen.tsx 已更新${NC}"

# 步骤4: 构建APK
echo -e "\n${YELLOW}步骤4: 构建Release APK...${NC}"
cd SmLabelAppRN
npx react-native run-android --mode=release > /dev/null 2>&1
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"

if [ -f "$APK_PATH" ]; then
  echo -e "${GREEN}✓ APK构建成功: $APK_PATH${NC}"
  APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo -e "${GREEN}  APK大小: $APK_SIZE${NC}"
else
  echo -e "${RED}✗ APK构建失败${NC}"
  exit 1
fi

cd ..

# 步骤5: Git提交
echo -e "\n${YELLOW}步骤5: 提交代码到Git...${NC}"
git add .
git commit -m "chore: 发布版本 v${NEW_VERSION}

更新内容:
${RELEASE_NOTES}"
git tag -a "v${NEW_VERSION}" -m "版本 ${NEW_VERSION}

更新内容:
${RELEASE_NOTES}"

echo -e "${GREEN}✓ Git提交完成${NC}"

# 步骤6: 推送到GitHub
echo -e "\n${YELLOW}步骤6: 推送到GitHub...${NC}"
read -p "是否推送到GitHub? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin develop
  git push origin "v${NEW_VERSION}"
  echo -e "${GREEN}✓ 已推送到GitHub${NC}"
else
  echo -e "${YELLOW}⚠ 跳过推送，请手动执行:${NC}"
  echo "  git push origin develop"
  echo "  git push origin v${NEW_VERSION}"
fi

# 步骤7: 提示创建GitHub Release
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}版本 ${NEW_VERSION} 准备完成!${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "\n下一步操作:"
echo -e "1. 访问GitHub仓库创建Release"
echo -e "2. 上传APK文件: ${APK_PATH}"
echo -e "3. 更新后端版本配置: server/src/version/version.service.ts"
echo -e "4. 重启后端服务器\n"

echo -e "${YELLOW}或使用GitHub CLI快速创建Release:${NC}"
echo -e "gh release create v${NEW_VERSION} \\"
echo -e "  SmLabelAppRN/${APK_PATH} \\"
echo -e "  --title \"版本 ${NEW_VERSION}\" \\"
echo -e "  --notes \"${RELEASE_NOTES}\"\n"

