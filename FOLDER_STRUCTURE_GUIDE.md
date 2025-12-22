# 术木优选项目 - 文件夹结构说明

本文档详细介绍 shumu-main 项目中每个文件夹存放的文件类型及其主要功能。

## 📁 项目根目录

### 配置文件
- `docker-compose.yml` - Docker 容器编排配置
- `Dockerfile` - Web 前端容器构建配置
- `Dockerfile.api` - API 后端容器构建配置
- `package-lock.json` - 根目录依赖锁定文件
- `start-dev.sh` - 开发环境启动脚本
- `verify-setup.sh` - 环境验证脚本

### 文档文件
- `README.md` - 项目主说明文档
- `PROJECT_STRUCTURE.md` - 项目结构详细说明
- `DEVELOPMENT.md` - 开发指南
- `VERSION_MANAGEMENT.md` - 版本管理说明
- `SYNC_GUIDE.md` - 同步指南
- `COLLABORATION.md` - 协作指南
- `DATABASE_SETUP.md` - 数据库设置指南
- `MONITORING_GUIDE.md` - 监控指南
- `EXTERNAL_ACCESS_GUIDE.md` - 外部访问指南
- `GITHUB_DESKTOP_SYNC.md` - GitHub Desktop 同步指南
- `UPDATE_SERVER_CODE.md` - 服务器代码更新指南
- `INSTALL_APK_GUIDE.md` - APK 安装指南
- `ICON_UPDATE_GUIDE.md` - 图标更新指南
- `FIX_CLIENT_ERROR.md` - 客户端错误修复指南
- `EVENT_LOOP_TROUBLESHOOTING.md` - 事件循环故障排除
- `EMAIL_CONFIG.md` - 邮件配置说明
- `DOCKER_DEPLOYMENT_GUIDE.md` - Docker 部署指南
- `DEPLOY_GUIDE_BAOTA.md` - 宝塔部署指南
- `DEPLOY_UPDATE_25.10.03.04.md` - 部署更新说明
- `RELEASE_v25.10.03.01.md` - 版本发布说明
- `RELEASE_v25.10.03.03.md` - 版本发布说明
- `APK_HOSTING_GUIDE.md` - APK 托管指南
- `APK_UPLOAD_GUIDE.md` - APK 上传指南
- `SMLABELAPP_GUIDE.md` - 移动应用指南

### 钉钉相关文档
- `DINGTALK_CONFIG_GUIDE.md` - 钉钉配置指南
- `DINGTALK_SETUP.md` - 钉钉设置说明
- `DINGTALK_CONFIG_CHECKLIST.md` - 钉钉配置检查清单
- `DINGTALK_FRONTEND_CHECKLIST.md` - 钉钉前端检查清单
- `DINGTALK_LOGIN_FLOW.md` - 钉钉登录流程
- `DINGTALK_TROUBLESHOOTING.md` - 钉钉故障排除
- `DINGTALK_DIAGNOSIS.md` - 钉钉诊断
- `DINGTALK_DOCKER_FIX.md` - 钉钉 Docker 修复
- `DINGTALK_FINAL_FIX.md` - 钉钉最终修复
- `DINGTALK_FIX_URL_PARAMS_ERROR.md` - 钉钉 URL 参数错误修复

### 压缩文件
- `shumu-deploy.tar.gz` - 部署压缩包

---

## 📁 server/ - 后端服务目录

**主要功能**: NestJS 后端 API 服务，提供 RESTful API 接口

### 文件类型
- **TypeScript 源文件** (.ts) - 业务逻辑代码
- **配置文件** (.json, .mjs) - 项目配置
- **数据库文件** (.prisma, .db, .sql) - 数据库模型和迁移
- **测试文件** (.ts, .json) - 单元测试和 E2E 测试
- **文档文件** (.md) - 服务端相关文档

### 子目录结构

#### `server/src/` - 源代码目录

**主要模块**:

1. **`acl/`** - 权限控制模块
   - `acl.controller.ts` - 权限管理控制器
   - `acl.service.ts` - 权限业务逻辑
   - `acl.module.ts` - 权限模块定义
   - **功能**: 用户、角色、权限的 CRUD 操作

2. **`template/`** - 标签模板模块
   - `template.controller.ts` - 模板管理控制器
   - `template.service.ts` - 模板业务逻辑
   - `template.module.ts` - 模板模块定义
   - `CpclConverter.ts` - CPCL 格式转换器
   - `dto/` - 数据传输对象
     - `create-template.dto.ts` - 创建模板 DTO
     - `update-template.dto.ts` - 更新模板 DTO
   - **功能**: 标签模板的创建、更新、删除，支持 HTML 和 TSPL 双模板格式

3. **`product/`** - 商品管理模块
   - `product.controller.ts` - 商品控制器
   - `product.service.ts` - 商品业务逻辑
   - `product.module.ts` - 商品模块定义
   - `master.controller.ts` - 商品主档控制器
   - **功能**: 商品主档和商品信息的 CRUD 操作

4. **`receipt/`** - 收货单模块
   - `receipt.controller.ts` - 收货单控制器
   - `receipt.service.ts` - 收货单业务逻辑
   - `receipt.module.ts` - 收货单模块定义
   - **功能**: 收货单查询、列表获取、打印数据生成

5. **`label-data/`** - 标签数据模块
   - `label-data.controller.ts` - 标签数据控制器
   - `label-data.service.ts` - 标签数据业务逻辑
   - `label-data.module.ts` - 标签数据模块定义
   - **功能**: 标签资料的增删改查，标签数据日志记录

6. **`label-print/`** - 标签打印模块
   - `label-print.controller.ts` - 标签打印控制器
   - `label-print.service.ts` - 标签打印业务逻辑
   - `label-print.module.ts` - 标签打印模块定义
   - **功能**: 批量标签打印、TSPL 指令生成、打印优化

7. **`supplier/`** - 供应商模块
   - `supplier.controller.ts` - 供应商控制器
   - `supplier.service.ts` - 供应商业务逻辑
   - `supplier.module.ts` - 供应商模块定义
   - **功能**: 供应商信息管理

8. **`supplier-management/`** - 供应商管理模块
   - `supplier-management.controller.ts` - 供应商管理控制器
   - `supplier-management.service.ts` - 供应商管理业务逻辑
   - `supplier-management.module.ts` - 供应商管理模块定义
   - **功能**: 供应商的完整管理功能

9. **`dingtalk/`** - 钉钉集成模块
   - `dingtalk.controller.ts` - 钉钉控制器
   - `dingtalk.service.ts` - 钉钉业务逻辑
   - `dingtalk.module.ts` - 钉钉模块定义
   - **功能**: 钉钉 SSO 登录、用户信息同步

10. **`email/`** - 邮件服务模块
    - `email.service.ts` - 邮件发送服务
    - `email.module.ts` - 邮件模块定义
    - **功能**: 邮件发送、多邮箱配置支持

11. **`prisma/`** - 数据库模块
    - `prisma.service.ts` - Prisma 数据库服务
    - `prisma.module.ts` - Prisma 模块定义
    - **功能**: 数据库连接和操作封装

12. **`security/`** - 安全模块
    - `roles.guard.ts` - 角色守卫
    - **功能**: 基于角色的访问控制

13. **`utils/`** - 工具模块
    - `logger.util.ts` - 日志工具
    - **功能**: 通用工具函数

14. **`health/`** - 健康检查模块
    - `health.controller.ts` - 健康检查控制器
    - **功能**: 服务健康状态检查

15. **`version/`** - 版本管理模块
    - `version.controller.ts` - 版本控制器
    - `version.service.ts` - 版本服务
    - `version.module.ts` - 版本模块定义
    - **功能**: API 版本管理

16. **业务模块**:
    - `max-purchase-quantity/` - 最大采购数量管理
    - `max-store-sku-inventory/` - 最大门店 SKU 库存管理
    - `ops-exclusion/` - 运营排除管理
    - `purchase-pass-difference/` - 采购通过差异管理
    - `refund-1688-follow-up/` - 1688 退款跟进（包含定时任务）
    - `store-rejection/` - 门店拒收管理

#### `server/prisma/` - 数据库配置目录
- `schema.prisma` - Prisma 数据库模型定义
- `*.db` - SQLite 数据库文件（开发环境）
- `*.sql` - SQL 迁移脚本

#### `server/test/` - 测试目录
- `*.ts` - 测试文件
- `*.json` - 测试配置文件

#### `server/dist/` - 编译输出目录
- 编译后的 JavaScript 文件

#### 配置文件
- `package.json` - 项目依赖和脚本配置
- `package-lock.json` - 依赖锁定文件
- `tsconfig.json` - TypeScript 编译配置
- `tsconfig.build.json` - 构建配置
- `nest-cli.json` - NestJS CLI 配置
- `eslint.config.mjs` - ESLint 代码检查配置

#### 文档文件
- `README.md` - 服务端说明文档
- `EMAIL_SETUP_GUIDE.md` - 邮件设置指南
- `EMAIL_TROUBLESHOOTING.md` - 邮件故障排除
- `MULTI_EMAIL_SETUP.md` - 多邮箱设置
- `MULTI_EMAIL_QUICK_GUIDE.md` - 多邮箱快速指南
- `QQ_EMAIL_SETUP.md` - QQ 邮箱设置

#### 其他文件
- `test-login-api.ps1` - PowerShell 登录 API 测试脚本

---

## 📁 web/ - 前端 Web 应用目录

**主要功能**: Next.js 15 前端应用，提供 Web 管理界面

### 文件类型
- **React 组件** (.tsx) - UI 组件
- **TypeScript 文件** (.ts) - 工具函数和配置
- **样式文件** (.css, .module.css) - 样式定义
- **配置文件** (.json, .ts, .js) - 项目配置
- **静态资源** - 图片、图标等

### 子目录结构

#### `web/src/app/` - Next.js App Router 页面目录

**路由页面**:

1. **`app/login/`** - 登录页面
   - `page.tsx` - 登录页面组件
   - **功能**: 用户登录认证

2. **`app/home/`** - 主功能页面目录
   - `layout.tsx` - 主布局组件
   - `page.tsx` - 首页
   - `admin-users/` - 用户管理页面
   - `admin-roles/` - 角色管理页面
   - `admin-permissions/` - 权限管理页面
   - `products/` - 商品资料页面
   - `product-supplement/` - 标签资料管理页面
   - `templates/` - 标签模板管理页面
   - `purchase/` - 收货单查询打印页面
   - `print/` - 商品搜索打印页面
   - `supplier-management/` - 供应商管理页面
   - `max-purchase-quantity/` - 最大采购数量页面
   - `max-store-sku-inventory/` - 最大门店 SKU 库存页面
   - `ops-exclusion/` - 运营排除页面
   - `purchase-pass-difference/` - 采购通过差异页面
   - `refund-1688-follow-up/` - 1688 退款跟进页面
   - `store-rejection/` - 门店拒收页面

3. **`app/api/`** - API 代理路由
   - `[...path]/route.ts` - 动态 API 路由代理
   - `test/route.ts` - API 测试路由
   - **功能**: 将前端 API 请求代理到后端服务

4. **`app/print-labels/`** - 标签打印页面
   - `page.tsx` - 打印页面
   - `LabelPrint.tsx` - 打印组件

5. **其他页面**:
   - `page.tsx` - 根页面（重定向）
   - `redirect.tsx` - 重定向组件
   - `layout.tsx` - 根布局
   - `globals.css` - 全局样式
   - `icon.png` - 应用图标
   - `favicon.ico` - 网站图标

#### `web/src/components/` - React 组件目录

**主要组件**:
- `AdminUsers.tsx` - 用户管理组件
- `AdminRoles.tsx` - 角色管理组件
- `AdminPermissions.tsx` - 权限管理组件
- `Can.tsx` - 权限检查组件
- `PermissionGuard.tsx` - 权限守卫组件
- `ProductMasterPage.tsx` - 商品主档页面组件
- `ProductSupplementPage.tsx` - 标签资料页面组件
- `TemplatesPage.tsx` - 模板管理页面组件
- `PurchasePage.tsx` - 收货单页面组件
- `LabelPrint.tsx` - 标签打印组件
- `SupplierManagementPage.tsx` - 供应商管理组件
- `MaxPurchaseQuantityPage.tsx` - 最大采购数量组件
- `MaxStoreSkuInventoryPage.tsx` - 最大门店 SKU 库存组件
- `OpsExclusionPage.tsx` - 运营排除组件
- `PurchasePassDifferencePage.tsx` - 采购通过差异组件
- `Refund1688FollowUpPage.tsx` - 1688 退款跟进组件
- `StoreRejectionPage.tsx` - 门店拒收组件
- `ResponsiveTable.tsx` - 响应式表格组件

#### `web/src/hooks/` - 自定义 Hooks
- `usePermissions.ts` - 权限管理 Hook
- **功能**: 封装权限检查逻辑

#### `web/src/lib/` - 工具库
- `api.ts` - API 客户端配置
- **功能**: Axios 实例配置、请求拦截器、响应处理

#### `web/public/` - 静态资源目录
- 图片、字体等静态文件

#### 配置文件
- `package.json` - 项目依赖配置
- `package-lock.json` - 依赖锁定文件
- `tsconfig.json` - TypeScript 配置
- `next.config.ts` - Next.js 配置
- `eslint.config.mjs` - ESLint 配置

---

## 📁 deploy/ - 部署配置目录

**主要功能**: 部署脚本、配置文件和部署文档

### 文件类型
- **Shell 脚本** (.sh) - 部署和修复脚本
- **Markdown 文档** (.md) - 部署指南和说明
- **配置文件** (.conf) - Nginx 等配置文件
- **SQL 脚本** (.sql) - 数据库更新脚本

### 主要文件

#### 部署脚本
- `start.sh` - 服务启动脚本
- `update.sh` - 更新脚本
- `quick-start.sh` - 快速启动脚本
- `simple-deploy.sh` - 简单部署脚本
- `baota-full-deploy.sh` - 宝塔完整部署脚本
- `fix-deployment.sh` - 部署修复脚本
- `fix-server-playwright.sh` - Playwright 修复脚本
- `fix-store-rejection-404.sh` - 门店拒收 404 修复脚本
- `update-server-sso.sh` - 服务器 SSO 更新脚本
- `update-spec-deploy.sh` - 规格更新部署脚本

#### 部署文档
- `README.md` - 部署主文档
- `README_FIRST_DEPLOY_IP.md` - 首次部署 IP 说明
- `DEPLOYMENT_GUIDE_v2.md` - 部署指南 v2
- `DOCKER_DEPLOY_GUIDE.md` - Docker 部署指南
- `BAOTA_DEPLOY_GUIDE.md` - 宝塔部署指南
- `baota-docker-deploy.md` - 宝塔 Docker 部署
- `baota-git-deploy.md` - 宝塔 Git 部署
- `NEW_SERVER_DOCKER_DEPLOY.md` - 新服务器 Docker 部署
- `DEPLOYMENT_CHECKLIST.md` - 部署检查清单
- `QUICK_REFERENCE.md` - 快速参考
- `quick-deploy-checklist.md` - 快速部署检查清单
- `step-by-step-guide.md` - 逐步部署指南

#### 问题修复文档
- `CHECK_LOGS.md` - 日志检查
- `CHECK_PROCESS_OUTPUT.md` - 进程输出检查
- `CHECK_SERVICE_STATUS.md` - 服务状态检查
- `check-printing-logs.md` - 打印日志检查
- `check-service-status.md` - 服务状态检查脚本
- `DEBUG_PLAYWRIGHT.md` - Playwright 调试
- `FIX_PRINTING_ISSUE.md` - 打印问题修复
- `FIX_LIBATK.md` - libatk 修复
- `fix-npm-issue.md` - NPM 问题修复
- `fix-store-rejection-404.md` - 门店拒收 404 修复

#### 依赖安装文档
- `INSTALL_ALL_MISSING_LIBS.md` - 安装所有缺失库
- `INSTALL_CHINESE_FONTS.md` - 安装中文字体
- `INSTALL_FONTS_ALTERNATIVE.md` - 字体安装替代方案
- `INSTALL_PLAYWRIGHT_DEPS.md` - Playwright 依赖安装
- `INSTALL_REMAINING_DEPS.md` - 安装剩余依赖
- `MANUAL_INSTALL_DEPS.md` - 手动安装依赖
- `install-git-on-server.md` - 服务器安装 Git

#### 字体相关文档
- `DOWNLOAD_FONT_DIRECTLY.md` - 直接下载字体
- `FINAL_FONT_SOLUTION.md` - 最终字体解决方案
- `RESTART_WITH_FONTS.md` - 使用字体重启
- `RESTART_AND_TEST.md` - 重启和测试

#### 功能更新文档
- `WEB_DEV_ACCESS.md` - Web 开发访问
- `WEB_LABEL_DATA_LOG_FEATURE.md` - Web 标签数据日志功能
- `WEB_LABEL_DATA_UPDATES.md` - Web 标签数据更新
- `WEB_PRODUCT_SUPPLEMENT_UPDATED.md` - Web 商品补充更新
- `LABEL_DATA_LOG_FIXED.md` - 标签数据日志修复
- `SPEC_COLUMN_UPDATE.md` - 规格列更新
- `TEST_PRINT_API.md` - 测试打印 API
- `APK_25.10.03.04_READY.md` - APK 版本就绪

#### 配置文件
- `nginx-config-example.conf` - Nginx 配置示例

#### 子目录
- `new-server-47.106.87.166/` - 新服务器特定配置
  - 包含服务器特定的配置文件和脚本

---

## 📁 scripts/ - 工具脚本目录

**主要功能**: 项目维护和部署相关的工具脚本

### 文件类型
- **Shell 脚本** (.sh) - Bash 脚本

### 主要脚本
- `first_deploy_ip.sh` - 首次部署 IP 配置脚本
- `update_ip.sh` - IP 更新脚本
- `release-new-version.sh` - 新版本发布脚本

---

## 📁 SmLabelApp/ - React Native 应用目录

**主要功能**: React Native 原生移动应用（完整功能版本）

### 文件类型
- **TypeScript/TSX** (.ts, .tsx) - React Native 组件和逻辑
- **配置文件** (.json, .js) - 项目配置
- **Android 配置** - Gradle、Manifest 等
- **iOS 配置** - Xcode 项目文件
- **资源文件** (.png, .xml) - 图标、图片等

### 子目录结构

#### `SmLabelApp/src/` - 源代码目录
- `api.ts` - API 客户端配置
- `screens/` - 页面组件
  - `LoginScreen.tsx` - 登录页面
  - `HomeScreen.tsx` - 主页

#### `SmLabelApp/android/` - Android 平台配置
- `app/` - Android 应用配置
  - `build.gradle` - 构建配置
  - `src/main/` - 主源代码
    - `AndroidManifest.xml` - Android 清单文件
    - `java/` - Java/Kotlin 代码
    - `res/` - 资源文件（图标、样式等）
- `build.gradle` - 项目构建配置
- `gradle/` - Gradle 包装器
- `settings.gradle` - Gradle 设置

#### `SmLabelApp/ios/` - iOS 平台配置
- `Podfile` - CocoaPods 依赖配置
- `SmLabelApp/` - iOS 项目文件
  - `Info.plist` - iOS 应用配置
  - `Images.xcassets/` - 图标资源
  - Xcode 项目文件

#### 配置文件
- `package.json` - 项目依赖
- `tsconfig.json` - TypeScript 配置
- `babel.config.js` - Babel 配置
- `metro.config.js` - Metro 打包器配置
- `app.json` - 应用配置
- `jest.config.js` - Jest 测试配置

#### 测试文件
- `__tests__/` - 测试文件目录
  - `App.test.tsx` - 应用测试

---

## 📁 SmLabelAppExpo/ - Expo 应用目录

**主要功能**: Expo 框架移动应用（推荐版本，功能最完整）

### 文件类型
- **TypeScript/TSX** (.ts, .tsx) - React Native 组件和逻辑
- **配置文件** (.json, .js) - Expo 和项目配置
- **Android 配置** - Expo 生成的 Android 配置
- **资源文件** (.png) - 图片资源

### 子目录结构

#### `SmLabelAppExpo/src/` - 源代码目录
- `api.ts` - API 客户端配置
- `screens/` - 页面组件
  - `LoginScreen.tsx` - 登录页面
  - `HomeScreen.tsx` - 主页
  - `ReceiptPrintScreen.tsx` - 收货单打印页面
  - `ProductLabelScreen.tsx` - 商品标签页面
  - `PrinterSettingsScreen.tsx` - 打印机设置页面
- `services/` - 服务模块
  - `PrintService.ts` - 打印服务
  - `BluetoothPrinter.ts` - 蓝牙打印机服务
  - `TsplBuilder.ts` - TSPL 指令构建器
  - `TemplateHtmlToTspl.ts` - HTML 模板转 TSPL
  - `PrinterSettings.ts` - 打印机设置服务

#### `SmLabelAppExpo/android/` - Android 平台配置
- Expo 自动生成的 Android 配置

#### `SmLabelAppExpo/assets/` - 静态资源
- 图片、图标等资源文件

#### 配置文件
- `package.json` - 项目依赖
- `tsconfig.json` - TypeScript 配置
- `metro.config.js` - Metro 打包器配置
- `app.json` - Expo 应用配置
- `eas.json` - EAS Build 配置
- `App.tsx` - 应用入口
- `index.ts` - 入口文件

---

## 📁 SmLabelAppRN/ - React Native 应用目录（另一个版本）

**主要功能**: React Native 移动应用的另一个实现版本

### 文件类型
- **TypeScript/TSX** (.ts, .tsx) - React Native 组件和逻辑
- **配置文件** (.json, .js) - 项目配置
- **Android 配置** - Gradle、Manifest 等
- **iOS 配置** - Xcode 项目文件
- **资源文件** (.png, .xml) - 图标、图片等
- **JAR 文件** (.jar) - Java 库文件

### 子目录结构

#### `SmLabelAppRN/src/` - 源代码目录
- `api.ts` - API 客户端配置
- `screens/` - 页面组件
  - `LoginScreen.tsx` - 登录页面
  - `HomeScreen.tsx` - 主页
  - `ReceiptPrintScreen.tsx` - 收货单打印页面
  - `ProductLabelScreen.tsx` - 商品标签页面
  - `PrinterSettingsScreen.tsx` - 打印机设置页面
- `components/` - 组件
  - `BarcodeScannerModal.tsx` - 条码扫描模态框
- `services/` - 服务模块
  - `PrintService.ts` - 打印服务
  - `BluetoothPrinter.ts` - 蓝牙打印机服务
  - `CtplPrinter.ts` - CTPL 打印机服务
  - `TsplBuilder.ts` - TSPL 指令构建器
  - `TemplateHtmlToTspl.ts` - HTML 模板转 TSPL
  - `PrinterSettings.ts` - 打印机设置服务
  - `TokenValidationService.ts` - Token 验证服务
  - `VersionUpdateService.ts` - 版本更新服务

#### `SmLabelAppRN/android/` - Android 平台配置
- 完整的 Android 项目配置
- `libs/` - 第三方库
  - `ctaiotCtpl1.1.8.jar` - CTPL 打印库

#### `SmLabelAppRN/ios/` - iOS 平台配置
- 完整的 iOS 项目配置

#### 配置文件
- `package.json` - 项目依赖
- `tsconfig.json` - TypeScript 配置
- `babel.config.js` - Babel 配置
- `metro.config.js` - Metro 打包器配置
- `app.json` - 应用配置
- `jest.config.js` - Jest 测试配置

---

## 📋 总结

### 项目架构
- **前端**: Next.js 15 (web/)
- **后端**: NestJS (server/)
- **移动端**: React Native / Expo (SmLabelApp*, SmLabelAppExpo/, SmLabelAppRN/)
- **部署**: Docker + 宝塔面板 (deploy/)
- **工具**: Shell 脚本 (scripts/)

### 主要功能模块
1. **权限管理** - 用户、角色、权限的 RBAC 系统
2. **商品管理** - 商品主档和标签资料管理
3. **标签打印** - 支持 HTML 和 TSPL 双模板格式
4. **收货单管理** - 收货单查询和批量打印
5. **供应商管理** - 供应商信息维护
6. **业务管理** - 采购数量、库存、运营排除等业务功能
7. **钉钉集成** - SSO 登录和用户同步
8. **邮件服务** - 多邮箱配置支持

### 技术栈
- **前端**: Next.js 15, React 18, Ant Design 5, TypeScript
- **后端**: NestJS, Prisma, MySQL, TypeScript
- **移动端**: React Native, Expo, TypeScript
- **部署**: Docker, Nginx, 宝塔面板
- **数据库**: MySQL (生产), SQLite (开发)

---

**最后更新**: 2025年1月

