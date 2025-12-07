# 宝塔面板完整部署指南

> 用于部署后端服务(sm-api-v2)和Web前端

---

## 📋 前置要求

1. ✅ 代码已推送到 GitHub `develop` 分支
2. ✅ 宝塔面板已安装 Node.js v20.19.5
3. ✅ 宝塔面板已安装 PM2
4. ✅ Git 已配置（如未配置，见下方）

---

## 🔧 Git 配置（如需要）

如果服务器上还没有配置 Git，先执行：

```bash
cd /www/wwwroot/sm-api-v2
git config --global --add safe.directory /www/wwwroot/sm-api-v2
git remote -v
# 如果没有 origin，执行：
git remote add origin https://github.com/xuxiang6/shumu.git
```

---

## 🚀 方案A：自动部署（推荐）

### 上传并执行自动部署脚本

1. 上传 `deploy/baota-full-deploy.sh` 到服务器 `/tmp/`
2. 在宝塔终端执行：

```bash
chmod +x /tmp/baota-full-deploy.sh
/tmp/baota-full-deploy.sh
```

---

## 📝 方案B：手动分步部署

### 第一部分：后端部署 (sm-api-v2)

#### 步骤1: 进入后端目录并拉取代码

```bash
cd /www/wwwroot/sm-api-v2
git fetch origin develop
git reset --hard origin/develop
```

#### 步骤2: 安装依赖

```bash
/www/server/nodejs/v20.19.5/bin/npm install --legacy-peer-deps
```

#### 步骤3: 确保 Playwright 已安装

```bash
# 检查是否已安装
/www/server/nodejs/v20.19.5/bin/npm list playwright

# 如果未安装，执行：
/www/server/nodejs/v20.19.5/bin/npm install playwright --save
```

#### 步骤4: 安装 Chromium

```bash
/www/server/nodejs/v20.19.5/bin/npx playwright install chromium
```

#### 步骤5: 安装系统依赖

```bash
yum install -y atk at-spi2-atk cups-libs gtk3 libXcomposite libXcursor libXdamage libXi libXrandr libXScrnSaver libXtst pango cairo alsa-lib liberation-fonts
```

#### 步骤6: 安装中文字体

```bash
yum install -y wqy-microhei-fonts
fc-cache -fv
```

#### 步骤7: 编译项目

```bash
/www/server/nodejs/v20.19.5/bin/npm run build
```

#### 步骤8: 验证编译结果

```bash
ls -lh dist/template/template.service.js
grep -c "renderHtmlToBitmap" dist/template/template.service.js
```

#### 步骤9: 重启服务

```bash
pm2 restart sm-api-v2
pm2 logs sm-api-v2 --lines 20
```

#### 步骤10: 测试后端

```bash
# 测试健康检查
curl http://127.0.0.1:5000/health

# 测试渲染接口
curl -X POST "http://127.0.0.1:5000/templates/1/render" \
  -H "Content-Type: application/json" \
  -d '{"spec":"测试","qrDataUrl":"123","barcodeTail":"456","renderAsBitmap":true,"copies":1}' \
  | head -c 500
```

---

### 第二部分：Web前端部署

#### 步骤1: 创建并进入Web项目目录

```bash
# 如果是首次部署
mkdir -p /www/wwwroot/sm-web
cd /www/wwwroot/sm-web
git clone -b develop https://github.com/xuxiang6/shumu.git .

# 如果已存在
cd /www/wwwroot/sm-web
git fetch origin develop
git reset --hard origin/develop
```

#### 步骤2: 进入 web 子目录并安装依赖

```bash
cd web
/www/server/nodejs/v20.19.5/bin/npm install
```

#### 步骤3: 构建生产版本

```bash
/www/server/nodejs/v20.19.5/bin/npm run build
```

#### 步骤4: 启动服务

```bash
# 首次启动
pm2 start npm --name "sm-web" -- start
pm2 save

# 后续重启
pm2 restart sm-web
```

#### 步骤5: 测试Web前端

```bash
# 检查服务状态
pm2 list | grep sm-web

# 测试首页
curl -I http://127.0.0.1:3000
```

---

## 🔗 配置域名和反向代理

### 在宝塔面板配置Web前端反向代理

1. 进入宝塔面板 → 网站 → 添加站点
2. 域名：`你的域名` (例如 `web.shuzhishanmu.com`)
3. 设置反向代理：
   - 目标URL: `http://127.0.0.1:3000`
   - 发送域名: `$host`
   - 内容替换: 留空

---

## 🧪 完整测试清单

### 后端测试

```bash
# 1. 健康检查
curl http://127.0.0.1:5000/health

# 2. 模板列表
curl http://127.0.0.1:5000/templates

# 3. 模板渲染（关键测试）
curl -X POST "http://127.0.0.1:5000/templates/1/render" \
  -H "Content-Type: application/json" \
  -d '{"spec":"测试规格","qrDataUrl":"TEST123","barcodeTail":"456","renderAsBitmap":true,"copies":1}' \
  > /tmp/test-render.txt

# 检查渲染结果
head -c 500 /tmp/test-render.txt
# 应该看到 BITMAP 指令，而不是全白的 AAAAAA
```

### Web前端测试

```bash
# 1. 首页访问
curl -I http://127.0.0.1:3000

# 2. 登录页
curl http://127.0.0.1:3000/login

# 3. API连接测试（在浏览器控制台）
fetch('http://api.shuzhishanmu.com:5000/health').then(r=>r.json()).then(console.log)
```

### APP测试

1. 打开 APP
2. 登录账号
3. 打印标签
4. 检查打印输出是否正确渲染（不应该是空白）

---

## 🐛 故障排查

### 后端渲染失败（返回全白AAAAAA）

```bash
# 1. 检查 Playwright 是否正常
cd /www/wwwroot/sm-api-v2
node -e "const {chromium} = require('playwright'); (async () => { try { const browser = await chromium.launch({headless: true}); console.log('✅ Chromium启动成功'); await browser.close(); } catch(e) { console.log('❌ 启动失败:', e.message); } })();"

# 2. 检查 Chromium 路径
ls -lh /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome

# 3. 检查系统依赖
ldd /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome | grep "not found"

# 4. 查看详细错误日志
pm2 logs sm-api-v2 --lines 100 | grep -i "error\|playwright\|chromium"
```

### Web前端无法访问

```bash
# 1. 检查服务状态
pm2 list | grep sm-web

# 2. 查看错误日志
pm2 logs sm-web --lines 50

# 3. 检查端口占用
netstat -tlnp | grep 3000

# 4. 手动启动测试
cd /www/wwwroot/sm-web/web
/www/server/nodejs/v20.19.5/bin/npm start
```

### Git 拉取失败

```bash
# 1. 检查 Git 配置
cd /www/wwwroot/sm-api-v2
git config --list | grep remote

# 2. 重新配置 remote
git remote remove origin
git remote add origin https://github.com/xuxiang6/shumu.git
git fetch origin develop

# 3. 强制重置到远程分支
git reset --hard origin/develop
```

---

## 📞 技术支持

如遇问题，请提供以下信息：

1. 错误截图
2. 相关日志：`pm2 logs sm-api-v2 --lines 50`
3. 服务状态：`pm2 list`
4. 系统环境：`uname -a` 和 `node -v`

