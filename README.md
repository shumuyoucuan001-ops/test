# 🏷️ 术木优选 - 标签打印管理系统

一个完整的标签打印管理系统，包含Web端管理界面、后端API服务和移动端应用。

## ✨ 主要功能

- 🔐 **权限管理系统** - 基于RBAC的用户、角色、权限管理
- 📦 **商品资料管理** - 商品主档和标签资料管理
- 🏷️ **标签模板管理** - 支持HTML和TSPL双模板格式
- 🖨️ **标签打印功能** - 收货单查询和批量标签打印
- 🏢 **供应商管理** - 供应商信息维护
- 📱 **移动端支持** - React Native和Expo应用

## 🏗️ 项目结构

```
├── web/                    # 🌐 Next.js 前端应用
├── server/                 # 🔧 NestJS 后端API
├── LabelPrintApp/          # 📱 React Native 应用
├── SmLabelAppExpo/         # 📱 Expo 应用
├── deploy/                 # 🚀 部署配置
├── scripts/                # 🛠️ 工具脚本
└── PROJECT_STRUCTURE.md    # 📖 详细项目说明
```

## 🚀 快速开始

### 1. 安装依赖
```bash
# 后端API
cd server && npm install

# 前端Web
cd web && npm install

# React Native (可选)
cd LabelPrintApp && npm install

# Expo (可选)
cd SmLabelAppExpo && npm install
```

### 2. 启动服务
```bash
# 启动后端 (端口 4000)
cd server && npm start

# 启动前端 (端口 3000)
cd web && npm run dev
```

### 3. 访问应用
- **Web端**: http://localhost:3000
- **API服务**: http://localhost:4000
- **默认账号**: admin18984581968 (具有全部权限)

## 🛠️ 技术栈

### 前端
- **Next.js 15.5** - React全栈框架
- **Ant Design 5.27** - UI组件库
- **TypeScript** - 类型安全

### 后端
- **NestJS** - Node.js企业级框架
- **Prisma** - 现代化ORM
- **MySQL** - 关系型数据库

### 移动端
- **React Native** - 跨平台移动应用
- **Expo** - 快速开发工具

## 📚 详细文档

查看 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) 了解详细的项目结构和开发说明。

## 🔄 版本信息

- **当前版本**: v1.4
- **最后更新**: 2025年9月
- **开发状态**: 持续开发中

## 📄 许可证

本项目为私有项目，版权所有。

---

💡 **提示**: 首次部署请参考 `deploy/README_FIRST_DEPLOY_IP.md` 进行环境配置。
