# 开发指南 - 术木优选标签打印管理系统

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- MySQL 8.0+
- Git

### 初始化开发环境

```bash
# 1. 克隆项目
git clone https://github.com/xuxiang6/shumu.git
cd shumu

# 2. 安装依赖
# 后端
cd server && npm install

# 前端
cd ../web && npm install

# 移动端 (推荐)
cd ../SmLabelAppExpo && npm install

# 3. 配置环境变量
cd ../server
cp .env.example .env
# 编辑 .env 文件配置数据库连接

# 4. 初始化数据库
npx prisma generate
npx prisma db push

# 5. 启动开发服务
# 终端1: 启动后端
npm start

# 终端2: 启动前端
cd ../web && npm run dev

# 终端3: 启动移动端 (可选)
cd ../SmLabelAppExpo && npx expo start
```

## 📁 项目结构详解

### Web端 (`web/`)
```
web/
├── src/app/                 # Next.js App Router
│   ├── home/               # 主要功能页面
│   │   ├── admin-users/    # 用户管理
│   │   ├── admin-roles/    # 角色管理
│   │   ├── purchase/       # 收货单打印
│   │   └── templates/      # 模板管理
│   ├── login/              # 登录页面
│   └── api/                # API路由代理
├── src/components/         # 可复用组件
├── src/hooks/             # 自定义Hooks
└── src/lib/               # 工具库
```

### 后端 (`server/`)
```
server/
├── src/
│   ├── acl/               # 权限控制模块
│   ├── template/          # 模板管理
│   ├── product/           # 商品管理
│   ├── receipt/           # 收货单管理
│   ├── label-data/        # 标签数据
│   └── main.ts            # 应用入口
├── prisma/
│   └── schema.prisma      # 数据库模型
└── dist/                  # 编译输出
```

### 移动端 (`SmLabelAppExpo/`)
```
SmLabelAppExpo/
├── src/
│   ├── screens/           # 页面组件
│   ├── services/          # 业务服务
│   │   ├── BluetoothPrinter.ts    # 蓝牙打印
│   │   ├── TsplBuilder.ts         # TSPL指令
│   │   └── PrintService.ts        # 打印服务
│   └── api.ts             # API配置
└── assets/                # 静态资源
```

## 🛠️ 开发工具配置

### VS Code / Cursor 扩展
项目已配置推荐扩展列表 (`.vscode/extensions.json`):
- TypeScript支持
- ESLint代码检查
- Prettier代码格式化
- Prisma语法高亮
- React Native工具
- Expo工具

### 调试配置
使用 `F5` 或调试面板启动:
- 🌐 启动Web前端
- 🔧 启动后端API
- 📱 启动Expo应用
- 🚀 启动全栈开发环境

## 📝 开发规范

### 代码风格
- 使用TypeScript严格模式
- 遵循ESLint规则
- 使用Prettier自动格式化
- 组件使用函数式组件 + Hooks

### 命名规范
- 文件名: kebab-case (如: `user-management.tsx`)
- 组件名: PascalCase (如: `UserManagement`)
- 变量名: camelCase (如: `userName`)
- 常量名: UPPER_SNAKE_CASE (如: `API_BASE_URL`)

### Git工作流
```bash
# 1. 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/新功能名

# 2. 开发和提交
git add .
git commit -m "feat: 添加新功能描述"

# 3. 推送和创建PR
git push origin feature/新功能名
# 在GitHub创建Pull Request到develop分支
```

### 提交信息规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具或辅助工具的变动
```

## 🔧 常用开发命令

### 后端开发
```bash
cd server

# 开发模式启动
npm run start:dev

# 构建
npm run build

# 数据库操作
npx prisma generate    # 生成Prisma客户端
npx prisma db push     # 推送模型到数据库
npx prisma studio      # 打开数据库GUI

# 测试
npm test
```

### 前端开发
```bash
cd web

# 开发模式启动
npm run dev

# 构建
npm run build

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

### 移动端开发
```bash
cd SmLabelAppExpo

# 启动Expo开发服务器
npx expo start

# 在模拟器中运行
npx expo run:ios
npx expo run:android

# 构建
npx expo build
```

## 🐛 常见问题

### 端口冲突
- 前端: 3000 (可在package.json中修改)
- 后端: 4000 (在server/src/main.ts中修改)
- Expo: 19000 (自动分配)

### 数据库连接问题
检查 `server/.env` 文件中的数据库配置:
```
DATABASE_URL="mysql://username:password@localhost:3306/database_name"
```

### API代理问题
前端API请求通过 `web/next.config.ts` 代理到后端:
```javascript
rewrites: async () => [
  {
    source: '/api/:path*',
    destination: 'http://127.0.0.1:4000/:path*'
  }
]
```

### 移动端连接问题
确保移动设备和开发机在同一网络，修改API地址:
```typescript
// SmLabelAppExpo/src/api.ts
const API_BASE_URL = 'http://192.168.x.x:4000';
```

## 📚 技术文档

### API文档
- 后端API使用NestJS框架
- 支持Swagger文档 (如果配置)
- RESTful API设计

### 数据库设计
主要表结构:
- `sys_users` - 用户表
- `sys_roles` - 角色表
- `sys_permissions` - 权限表
- `product_master` - 商品主档
- `label_templates` - 标签模板
- `label_data` - 标签资料

### 权限系统
基于RBAC (Role-Based Access Control):
- 用户 → 角色 → 权限
- 前端使用 `PermissionGuard` 组件控制访问
- 后端使用装饰器进行权限验证

## 🚀 部署指南

### 开发环境
使用Docker Compose:
```bash
docker-compose up -d
```

### 生产环境
参考 `deploy/` 目录下的部署文档和脚本。

## 📞 技术支持

如有问题，请:
1. 查看项目文档
2. 检查GitHub Issues
3. 创建新的Issue描述问题
