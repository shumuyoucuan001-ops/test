# 前端部署包

## 部署说明

### 1. 上传到服务器
将整个 `standalone` 目录上传到服务器的 `/www/wwwroot/sm-web/` 目录。

### 2. 安装 Node.js
确保服务器已安装 Node.js v20+（在宝塔面板中通过“Node版本管理器”安装）。

### 3. 启动服务
```bash
cd /www/wwwroot/sm-web/standalone
chmod +x start.sh
./start.sh
```

或者使用 PM2 管理：
```bash
cd /www/wwwroot/sm-web/standalone
pm2 start server.js --name "sm-web" --env production
pm2 startup
pm2 save
```

### 4. Nginx 配置
确保 Nginx 配置包含以下静态资源代理：
```nginx
location ^~ /_next/static/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ^~ /public/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  expires 30d;
}
```

### 5. 验证
访问 http://your-domain 应该能看到登录页面。
