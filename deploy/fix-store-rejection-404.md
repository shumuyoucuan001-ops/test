# 🔧 修复"驳回差异单"404错误

## 问题原因

`.gitignore` 排除了 `dist/` 目录，这是正常的。但服务器上必须运行 `npm run build` 来生成编译后的文件。如果服务器上缺少 `dist/store-rejection/` 目录中的文件，就会导致 404 错误。

## 诊断步骤

### 1. 检查服务器上的 dist 目录

在服务器终端执行：

```bash
cd /www/wwwroot/sm-api-v2

# 检查 dist 目录是否存在
ls -la dist/

# 检查 store-rejection 模块是否已编译
ls -la dist/store-rejection/

# 检查 controller 文件是否存在
ls -lh dist/store-rejection/store-rejection.controller.js
```

**如果文件不存在，说明需要重新构建。**

### 2. 检查源代码是否最新

```bash
cd /www/wwwroot/sm-api-v2

# 检查是否有 store-rejection 源代码
ls -la src/store-rejection/

# 检查 Git 状态
git status
git log --oneline -5
```

## 修复方案

### 方案A：重新构建项目（推荐）

```bash
cd /www/wwwroot/sm-api-v2

# 1. 确保代码是最新的
git fetch origin develop
git reset --hard origin/develop

# 2. 安装依赖（如果需要）
/www/server/nodejs/v20.19.5/bin/npm install

# 3. 重新构建
/www/server/nodejs/v20.19.5/bin/npm run build

# 4. 验证构建结果
ls -lh dist/store-rejection/store-rejection.controller.js
ls -lh dist/store-rejection/store-rejection.service.js
ls -lh dist/store-rejection/store-rejection.module.js

# 5. 重启服务
# 如果使用 PM2：
pm2 restart sm-api-v2

# 如果使用宝塔 Node 项目：
# 在宝塔面板中重启项目
```

### 方案B：检查并修复构建错误

如果构建失败，查看错误信息：

```bash
cd /www/wwwroot/sm-api-v2

# 查看详细构建日志
/www/server/nodejs/v20.19.5/bin/npm run build 2>&1 | tee /tmp/build.log

# 检查常见问题
cat /tmp/build.log | grep -i error
```

**常见构建错误：**
- TypeScript 编译错误：检查 `src/store-rejection/` 目录中的语法错误
- 缺少依赖：运行 `npm install`
- 模块导入错误：检查 `app.module.ts` 是否正确导入了 `StoreRejectionModule`

### 方案C：验证模块是否正确注册

检查 `dist/app.module.js` 是否包含 `StoreRejectionModule`：

```bash
cd /www/wwwroot/sm-api-v2

# 检查编译后的 app.module.js
grep -i "StoreRejectionModule" dist/app.module.js

# 检查路由是否注册
grep -i "store-rejection" dist/app.module.js
```

## 验证修复

修复后，验证接口是否可用：

```bash
# 测试列表接口
curl http://localhost:5002/store-rejection

# 测试发送邮件接口（需要 POST 数据）
curl -X POST http://localhost:5002/store-rejection/send-rejection-email \
  -H "Content-Type: application/json" \
  -d '{"item":{"门店/仓":"测试","商品名称":"测试商品","sku_id":"123","upc":"456","采购单号":"PO001","关联收货单号":"RO001"}}'
```

## 预防措施

### 1. 在部署脚本中确保构建

确保所有部署脚本都包含构建步骤：

```bash
npm run build
```

### 2. 添加构建验证

在部署脚本中添加验证步骤：

```bash
# 构建后验证关键文件
if [ ! -f "dist/store-rejection/store-rejection.controller.js" ]; then
  echo "❌ 构建失败：缺少 store-rejection.controller.js"
  exit 1
fi
```

### 3. 使用 CI/CD 自动构建

如果使用 Git 自动部署，确保部署钩子中包含构建命令。

## 相关文件

- 源代码：`server/src/store-rejection/`
- 编译输出：`server/dist/store-rejection/`
- 前端调用：`web/src/lib/api.ts` (line 400-410)
- 前端组件：`web/src/components/StoreRejectionPage.tsx`


