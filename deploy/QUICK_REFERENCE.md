# 🚀 部署快速参考卡

## 📦 一键部署命令

### 首次部署

```bash
# 1. 克隆项目
git clone https://github.com/xuxiang6/shumu.git
cd shumu

# 2. 配置环境变量
cp .env.example .env
vim .env  # 修改 JWT_SECRET

# 3. 一键部署
chmod +x deploy/*.sh
./deploy/quick-start.sh
```

### 更新部署

```bash
cd /www/wwwroot/shumu
./deploy/update.sh
```

---

## 🔧 常用命令

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 启动服务
docker-compose up -d

# 检查 API 健康
curl http://localhost:5000/health
```

---

## 🌐 Nginx 配置（复制粘贴）

```nginx
# 在宝塔面板 → 网站设置 → 配置文件中添加

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

location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 🔒 安全检查清单

- [ ] 修改 `.env` 中的 `JWT_SECRET`
- [ ] 宝塔安全面板开放 80 和 443 端口
- [ ] 宝塔安全面板关闭 5000 端口
- [ ] 配置 SSL 证书（推荐）
- [ ] 开启 Nginx 强制 HTTPS

---

## 🐛 快速排错

### Web 无法访问

```bash
# 1. 检查容器
docker-compose ps

# 2. 查看日志
docker-compose logs web

# 3. 检查 Nginx
nginx -t
```

### API 请求失败

```bash
# 1. 测试健康检查
curl http://localhost:5000/health

# 2. 查看 API 日志
docker-compose logs api

# 3. 检查端口
netstat -tuln | grep 5000
```

### 容器无法启动

```bash
# 1. 查看详细日志
docker-compose logs

# 2. 检查端口占用
netstat -tuln | grep -E '80|5000'

# 3. 重建镜像
docker-compose build --no-cache
docker-compose up -d
```

---

## 📞 快速访问

- **Web 前端**: `http://your-domain.com` 或 `http://服务器IP`
- **API 健康检查**: `http://your-domain.com/api/health`
- **宝塔面板**: `http://服务器IP:8888`

---

## 📚 详细文档

- **完整部署指南**: `deploy/baota-docker-deploy.md`
- **检查清单**: `deploy/DEPLOYMENT_CHECKLIST.md`
- **文档导航**: `deploy/README.md`

---

**提示**: 将此文档保存为书签，随时查阅！
