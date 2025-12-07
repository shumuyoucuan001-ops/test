# 🔧 修复 npm 命令问题

## 问题原因

服务器上没有全局的 `npm` 命令，需要使用宝塔的 Node 版本管理器。

## 解决方案

在宝塔终端继续执行以下命令：

```bash
# 1. 进入项目目录
cd /www/wwwroot/sm-api-v2

# 2. 检查是否有 package.json
ls -la package.json

# 3. 使用宝塔的 pnpm 安装依赖
/www/server/nodejs/v20.19.5/bin/npm install

# 4. 构建项目
/www/server/nodejs/v20.19.5/bin/npm run build

# 5. 初始化数据库
/www/server/nodejs/v20.19.5/bin/npx prisma generate
/www/server/nodejs/v20.19.5/bin/npx prisma migrate deploy

# 6. 检查构建结果
ls -lh dist/main.js
```

如果以上命令成功，最后应该显示 `dist/main.js` 文件信息。
