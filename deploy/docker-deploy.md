# 🚀 Docker部署指南

## 📋 部署前准备

### 1. 服务器要求
- **操作系统**: Ubuntu 20.04+ / CentOS 7+
- **内存**: 最少2GB，推荐4GB+
- **存储**: 最少10GB可用空间
- **网络**: 开放80端口(HTTP)、443端口(HTTPS)

### 2. 安装Docker和Docker Compose
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 🔧 部署步骤

### 1. 克隆项目到服务器
```bash
# 克隆项目
git clone https://github.com/xuxiang6/shumu.git
cd shumu

# 切换到生产分支
git checkout main
```

### 2. 配置环境变量
```bash
# 创建环境配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

### 3. 环境变量配置示例
```env
# 数据库配置
DATABASE_URL="mysql://username:password@localhost:3306/shumu_db"

# JWT密钥
JWT_SECRET="your-super-secret-jwt-key"

# 应用配置
NODE_ENV=production
API_PORT=4000
WEB_PORT=3000

# 数据库连接
DB_HOST=localhost
DB_PORT=3306
DB_USER=shumu_user
DB_PASSWORD=your_db_password
DB_NAME=shumu_db
```

### 4. 构建和启动服务
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 5. 数据库初始化
```bash
# 进入API容器
docker-compose exec api bash

# 运行数据库迁移
npx prisma generate
npx prisma db push

# 退出容器
exit
```

## 🔄 更新部署

### 自动化更新脚本
```bash
#!/bin/bash
# 文件名: update.sh

echo "🚀 开始更新部署..."

# 拉取最新代码
git pull origin main

# 重新构建镜像
docker-compose build --no-cache

# 重启服务
docker-compose down
docker-compose up -d

# 检查服务状态
docker-compose ps

echo "✅ 更新完成！"
```

## 📊 监控和维护

### 查看服务状态
```bash
# 查看容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 查看资源使用
docker stats

# 重启服务
docker-compose restart
```

### 备份数据库
```bash
# 备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T api mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup_$DATE.sql
```

## 🌐 域名和SSL配置

### 使用Nginx反向代理
```nginx
# /etc/nginx/sites-available/shumu
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL证书 (Let's Encrypt)
```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```
