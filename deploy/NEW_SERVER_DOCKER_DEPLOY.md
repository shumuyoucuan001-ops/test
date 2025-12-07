# 🚀 新服务器 Docker 快速部署指南

> 适用于已安装宝塔和 Docker 的新服务器

---

## 📋 部署前准备信息

在开始部署前，请准备以下信息：

### 1. 服务器信息
- [ ] 服务器 IP 地址
- [ ] SSH 登录账号和密码（通常是 root）
- [ ] 域名（如果有）

### 2. 数据库选择
选择以下一种方式：

**方式 A: 使用阿里云 RDS（推荐 - 生产环境）**
- [ ] RDS 连接地址（例如：`rm-xxxx.mysql.rds.aliyuncs.com`）
- [ ] 端口（默认 3306）
- [ ] 数据库名（例如：`sm_shangping`）
- [ ] 用户名和密码

**方式 B: 使用宝塔本地 MySQL**
- [ ] 在宝塔安装 MySQL 5.7 或 8.0
- [ ] 创建数据库和用户

**方式 C: 使用 SQLite（仅测试环境）**
- [ ] 无需配置，使用本地文件数据库

### 3. 域名和 SSL（可选）
- [ ] 域名已解析到服务器 IP
- [ ] 需要配置 HTTPS

---

## 🔧 快速部署步骤

### 步骤 1: SSH 登录服务器

```bash
# 从你的电脑连接到服务器
ssh root@你的服务器IP
```

### 步骤 2: 检查 Docker 是否正常

```bash
# 检查 Docker 版本
docker --version
docker-compose --version

# 如果未安装，在宝塔面板安装 Docker 管理器
```

### 步骤 3: 克隆项目代码

```bash
# 进入网站目录
cd /www/wwwroot

# 克隆项目（推荐使用 main 分支，已测试稳定）
git clone -b main https://github.com/xuxiang6/shumu.git

# 进入项目目录
cd shumu

# 确认分支
git branch
```

### 步骤 4: 配置环境变量

```bash
# 创建环境变量文件
cat > .env << 'EOF'
# ======================
# 数据库配置
# ======================

# 方式 A: 阿里云 RDS（推荐）
DATABASE_URL="mysql://用户名:密码@RDS地址:3306/sm_shangping"

# 方式 B: 本地 MySQL
# DATABASE_URL="mysql://root:密码@127.0.0.1:3306/sm_shangping"

# 方式 C: SQLite（测试用）
# DATABASE_URL="file:./prisma/dev.db"

# ======================
# JWT 安全密钥（必须修改！）
# ======================
JWT_SECRET="请在这里粘贴一个随机的复杂字符串"

# ======================
# 应用配置
# ======================
NODE_ENV=production
PORT=5000

# ======================
# Web 前端配置
# ======================
NEXT_PUBLIC_API_BASE=/api

EOF

# 编辑环境变量（根据你的实际情况修改）
vim .env
# 或者使用宝塔文件管理器编辑
```

**生成随机 JWT 密钥：**
```bash
openssl rand -base64 32
# 将输出的字符串复制到 .env 的 JWT_SECRET
```

### 步骤 5: 构建并启动 Docker 容器

```bash
# 确保在项目根目录
cd /www/wwwroot/shumu

# 构建镜像（首次构建需要 5-10 分钟，请耐心等待）
docker-compose build

# 启动服务
docker-compose up -d

# 查看容器状态
docker-compose ps
```

**预期输出：**
```
NAME                COMMAND                  SERVICE   STATUS    PORTS
shumu-api-1         "node dist/main.js"      api       Up        0.0.0.0:5000->5000/tcp
shumu-web-1         "node server.js"         web       Up        0.0.0.0:3000->3000/tcp
```

### 步骤 6: 验证服务是否正常

```bash
# 1. 测试 API 健康检查
curl http://127.0.0.1:5000/health
# 预期输出：{"status":"ok"}

# 2. 测试 Web 前端
curl -I http://127.0.0.1:3000
# 预期输出：HTTP/1.1 307 Temporary Redirect（重定向到登录页）

# 3. 查看服务日志（检查是否有错误）
docker-compose logs --tail=50
```

### 步骤 7: 在宝塔面板配置域名和反向代理

#### 如果你有域名：

1. **添加网站**
   - 登录宝塔面板
   - 网站 → 添加站点
   - 域名：`你的域名.com`
   - 根目录：`/www/wwwroot/shumu`（随便选，不会实际使用）
   - PHP 版本：纯静态

2. **配置反向代理**
   
   进入 **网站设置 → 配置文件**，找到 `server` 块，替换为：

```nginx
server {
    listen 80;
    server_name 你的域名.com;
    
    # API 反向代理
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Web 前端反向代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. **保存并重启 Nginx**
   
   在宝塔面板：软件商店 → Nginx → 重启

4. **配置 SSL（可选但推荐）**
   - 网站设置 → SSL → Let's Encrypt
   - 勾选域名 → 申请
   - 开启 "强制 HTTPS"

#### 如果你没有域名（直接用 IP 访问）：

1. **修改 docker-compose.yml 的端口映射**

```bash
# 编辑 docker-compose.yml
vim docker-compose.yml
```

找到 `web` 服务的 `ports`，改为：
```yaml
ports:
  - "80:3000"  # 将 Web 前端映射到 80 端口
```

2. **重启容器**

```bash
docker-compose down
docker-compose up -d
```

3. **在宝塔安全面板放行端口**
   - 安全 → 放行端口：80、5000

4. **直接访问**
   - Web 前端：`http://服务器IP`
   - API：`http://服务器IP:5000`

---

## 🧪 测试部署

### 1. 浏览器访问

- 打开浏览器，访问：`http://你的域名.com` 或 `http://服务器IP`
- 应该看到登录页面
- 尝试登录（默认账号需要在数据库创建）

### 2. 检查 Docker 日志

```bash
# 如果遇到问题，查看日志
docker-compose logs -f

# 只看 API 日志
docker-compose logs -f api

# 只看 Web 日志
docker-compose logs -f web
```

---

## 🔄 日常维护

### 更新代码

```bash
cd /www/wwwroot/shumu

# 拉取最新代码
git pull origin main

# 重新构建并重启
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 查看状态
docker-compose ps
```

### 查看日志

```bash
cd /www/wwwroot/shumu

# 实时查看所有日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100
```

### 重启服务

```bash
cd /www/wwwroot/shumu

# 重启所有服务
docker-compose restart

# 只重启 API
docker-compose restart api

# 只重启 Web
docker-compose restart web
```

### 停止服务

```bash
cd /www/wwwroot/shumu

# 停止所有服务
docker-compose down

# 停止并删除所有数据（谨慎使用！）
docker-compose down -v
```

---

## 🐛 常见问题

### 1. 端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep -E '80|3000|5000'

# 如果 80 端口被占用，可能是宝塔的 Nginx 或 Apache
# 在宝塔面板停止 Apache（如果安装了）
```

### 2. Docker 镜像构建失败

```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建
cd /www/wwwroot/shumu
docker-compose build --no-cache
```

### 3. 数据库连接失败

```bash
# 检查 .env 文件中的数据库配置
cat .env | grep DATABASE_URL

# 测试数据库连接
docker-compose exec api npx prisma db push
```

### 4. Web 前端显示空白

```bash
# 检查 Web 容器日志
docker-compose logs web

# 确认静态文件是否正确构建
docker-compose exec web ls -la /app/web/.next/static
```

### 5. API 请求返回 404

```bash
# 检查 Nginx 配置
cat /www/server/panel/vhost/nginx/你的域名.conf

# 测试 API 直接访问
curl http://127.0.0.1:5000/health
```

---

## 🔒 安全建议

### 1. 修改默认配置
- ✅ 修改 `.env` 中的 `JWT_SECRET`
- ✅ 使用强密码
- ✅ 定期备份数据库

### 2. 防火墙设置
- ✅ 在宝塔安全面板，只开放 80 和 443 端口
- ✅ 关闭 3000 和 5000 端口对外访问（通过 Nginx 代理）
- ✅ 启用 SSH 密钥登录

### 3. 定期更新
- ✅ 定期拉取最新代码：`git pull origin main`
- ✅ 更新 Docker 镜像：`docker-compose build --no-cache`
- ✅ 更新宝塔面板和插件

---

## 📞 需要帮助？

如果部署遇到问题，请提供以下信息：

```bash
# 1. 系统信息
uname -a
docker --version
docker-compose --version

# 2. 容器状态
docker-compose ps

# 3. 容器日志
docker-compose logs --tail=100

# 4. 端口占用
netstat -tlnp | grep -E '80|3000|5000'

# 5. Nginx 配置
cat /www/server/panel/vhost/nginx/你的域名.conf
```

---

## 🎉 部署完成检查清单

- [ ] Docker 容器正常运行
- [ ] API 健康检查返回正常
- [ ] Web 前端可以访问
- [ ] Nginx 反向代理配置正确
- [ ] 域名可以正常访问（如果配置了）
- [ ] SSL 证书已配置（如果需要）
- [ ] 可以正常登录系统
- [ ] 各功能模块测试正常

**恭喜！你的树木标签系统已成功部署到新服务器！** 🎊

---

## 📝 下一步

1. **创建管理员账号**（在数据库中手动添加或通过 API）
2. **导入商品数据**
3. **配置标签模板**
4. **测试打印功能**
5. **配置定期备份**（在宝塔面板的计划任务中）


