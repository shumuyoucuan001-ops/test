# 外网访问部署指南

本文档说明如何让非局域网设备（外网设备）安装和使用本应用。

---

## 📱 方案概览

### 方案对比

| 方案                       | 优点                   | 缺点                     | 推荐度     |
| -------------------------- | ---------------------- | ------------------------ | ---------- |
| **方案 A: GitHub Release** | 简单、免费、全球可访问 | 需要 GitHub 账号         | ⭐⭐⭐⭐⭐ |
| **方案 B: 内网穿透**       | 可访问内网 API         | 需要配置、可能有网络延迟 | ⭐⭐⭐⭐   |
| **方案 C: 云服务器部署**   | 稳定、专业             | 需要购买服务器、有成本   | ⭐⭐⭐⭐⭐ |
| **方案 D: 蓝牙/USB 分享**  | 无需网络               | 需要物理接触             | ⭐⭐⭐     |

---

## 🚀 方案 A: GitHub Release（推荐）

### 优点

- ✅ **完全免费**
- ✅ **全球可访问**
- ✅ **自动版本管理**
- ✅ **下载速度快**（GitHub CDN）
- ✅ **无需服务器**

### 适用场景

- 外地同事/客户安装
- 应用分发
- 版本更新

### 实施步骤

#### 1. 创建 GitHub Release

```bash
# 1. 构建APK
cd SmLabelAppRN
npx react-native run-android --mode=release

# 2. 提交并创建标签
git add .
git commit -m "chore: 发布版本 v25.10.02.01"
git tag -a v25.10.02.01 -m "初始版本"
git push origin develop
git push origin v25.10.02.01

# 3. 创建GitHub Release（使用GitHub CLI）
gh release create v25.10.02.01 \
  SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk \
  --title "版本 25.10.02.01" \
  --notes "初始版本

## 功能特性
- 商品标签打印
- 收货单打印
- 蓝牙打印支持
- 自动登录
- 单点登录

## 安装方法
1. 点击下方 app-release.apk 下载
2. 在手机上安装APK
3. 首次使用需要配置后端API地址"
```

#### 2. 获取 APK 下载链接

**Release 页面**:

```
https://github.com/your-username/shumu/releases
```

**直接下载链接**:

```
https://github.com/your-username/shumu/releases/download/v25.10.02.01/app-release.apk
```

#### 3. 分享给用户

**方式 1: 分享 Release 页面链接**

- 用户访问 Release 页面
- 点击下载 APK
- 安装

**方式 2: 分享直接下载链接**

- 复制直接下载链接
- 通过微信/QQ/邮件分享
- 用户点击即可下载

**方式 3: 生成二维码**

```bash
# 使用在线工具生成二维码
# 输入：https://github.com/your-username/shumu/releases
# 用户扫码即可访问下载页面
```

---

## 🌐 方案 B: 内网穿透（API 访问）

### 说明

外网用户下载 APK 后，还需要访问后端 API。如果后端部署在内网（如`192.168.0.109:4000`），外网无法直接访问。

### 解决方案：使用内网穿透工具

#### 选项 1: frp（免费，需自己的公网服务器）

**服务端配置**（有公网 IP 的服务器）:

```ini
# frps.ini
[common]
bind_port = 7000
```

**客户端配置**（内网电脑）:

```ini
# frpc.ini
[common]
server_addr = 你的公网IP
server_port = 7000

[web]
type = http
local_ip = 127.0.0.1
local_port = 4000
custom_domains = api.yourdomain.com
```

启动：

```bash
# 服务端
./frps -c frps.ini

# 客户端
./frpc -c frpc.ini
```

#### 选项 2: 花生壳/Ngrok（付费，简单易用）

**花生壳**:

1. 注册账号：https://hsk.oray.com/
2. 下载客户端
3. 配置内网穿透规则
4. 获得公网域名，如：`http://abc123.natapp.cc`

**Ngrok**:

```bash
# 安装
brew install ngrok

# 启动（需要注册账号获取authtoken）
ngrok http 4000

# 会生成公网URL，如：https://abc-123-456.ngrok.io
```

#### 选项 3: Cloudflare Tunnel（免费，推荐）

```bash
# 1. 安装cloudflared
brew install cloudflare/cloudflare/cloudflared

# 2. 登录
cloudflared tunnel login

# 3. 创建tunnel
cloudflared tunnel create shumu-api

# 4. 配置路由
cloudflared tunnel route dns shumu-api api.yourdomain.com

# 5. 运行tunnel
cloudflared tunnel run --url http://localhost:4000 shumu-api
```

### 修改应用配置

修改 `SmLabelAppRN/src/api.ts`:

```typescript
// 使用内网穿透后的公网地址
const API_BASE_URL = "https://your-tunnel-url.com"; // 替换为实际的穿透地址
```

---

## ☁️ 方案 C: 云服务器部署（推荐生产环境）

### 适用场景

- 正式生产环境
- 多人使用
- 稳定性要求高

### 步骤

#### 1. 购买云服务器

**推荐云服务商**:

- 阿里云 ECS
- 腾讯云 CVM
- AWS EC2
- Azure VM

**最低配置**:

- CPU: 2 核
- 内存: 4GB
- 硬盘: 40GB
- 带宽: 5Mbps
- 系统: Ubuntu 22.04

#### 2. 部署后端到云服务器

```bash
# SSH连接到服务器
ssh root@your-server-ip

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装MySQL
sudo apt-get install mysql-server

# 克隆代码
git clone https://github.com/your-username/shumu.git
cd shumu/server

# 安装依赖
npm install

# 配置数据库
mysql -u root -p < init.sql

# 启动服务（使用PM2保持运行）
npm install -g pm2
pm2 start npm --name "shumu-api" -- run start:prod
pm2 save
pm2 startup
```

#### 3. 配置 Nginx 反向代理

```bash
# 安装Nginx
sudo apt-get install nginx

# 配置
sudo nano /etc/nginx/sites-available/shumu
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/shumu /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. 配置 HTTPS（可选但推荐）

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d api.yourdomain.com
```

#### 5. 修改应用配置

```typescript
// SmLabelAppRN/src/api.ts
const API_BASE_URL = "https://api.yourdomain.com";
```

#### 6. 重新构建 APK

```bash
cd SmLabelAppRN
npx react-native run-android --mode=release
```

---

## 📲 方案 D: 本地分享

### 方法 1: 通过微信/QQ 分享 APK 文件

```bash
# 1. 找到APK文件
SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk

# 2. 通过微信/QQ/钉钉发送给对方

# 3. 对方下载后安装
```

### 方法 2: 使用 ADB 无线安装

```bash
# 发送方
adb connect 对方手机IP:5555
adb install -r SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
```

### 方法 3: 设置本地 HTTP 服务器

```bash
# 在APK所在目录启动简单HTTP服务器
cd SmLabelAppRN/android/app/build/outputs/apk/release/
python3 -m http.server 8080

# 获取本机IP（如192.168.1.100）
ifconfig | grep inet

# 告诉对方访问: http://192.168.1.100:8080/app-release.apk
```

---

## 🔧 完整部署方案（推荐）

### 组合方案: GitHub Release + 云服务器

**APK 分发**: GitHub Release

- 外网用户从 GitHub 下载 APK
- 自动版本管理
- 全球 CDN 加速

**API 服务**: 云服务器

- 后端部署在云服务器
- 配置域名: `api.yourdomain.com`
- HTTPS 加密传输

### 实施步骤总结

```bash
# 1. 后端部署到云服务器
# 参考"方案C: 云服务器部署"

# 2. 修改应用API地址
# SmLabelAppRN/src/api.ts
const API_BASE_URL = 'https://api.yourdomain.com';

# 3. 更新后端版本服务配置
# server/src/version/version.service.ts
downloadUrl: 'https://github.com/your-username/shumu/releases/download/v25.10.02.01/app-release.apk'

# 4. 构建并发布APK到GitHub Release
./scripts/release-new-version.sh 25.10.02.01 "初始版本"

# 5. 分享GitHub Release链接给用户
https://github.com/your-username/shumu/releases
```

---

## 📝 用户安装指南（模板）

您可以将以下内容发送给外网用户：

---

### 📱 SmLabelApp 安装指南

#### 下载应用

**方式 1**: 访问 GitHub Release 页面

1. 打开链接: https://github.com/your-username/shumu/releases
2. 点击最新版本的 `app-release.apk` 下载
3. 下载完成后点击安装

**方式 2**: 直接下载 APK
点击链接直接下载: [下载 APK](https://github.com/your-username/shumu/releases/download/v25.10.02.01/app-release.apk)

#### 安装步骤

1. 下载 APK 文件到手机
2. 打开 APK 文件
3. 如果提示"不允许安装未知来源应用"，请前往设置开启权限:
   - 设置 → 应用管理 → 特殊访问权限 → 安装未知应用
   - 选择浏览器或文件管理器，开启"允许安装未知应用"
4. 点击"安装"
5. 安装完成后点击"打开"

#### 首次使用

1. 打开应用
2. 输入登录账号密码
3. 进入主页后，点击"打印机设置"连接蓝牙打印机
4. 开始使用

#### 常见问题

**Q: 无法连接到服务器？**
A: 请确保手机网络正常，如果问题持续，请联系管理员。

**Q: 版本更新提示？**
A: 应用会自动检测新版本，发现新版本时请及时更新。

**Q: 需要帮助？**
A: 请联系技术支持: your-email@example.com

---

## 🔒 安全注意事项

1. **APK 签名**: 生产环境使用正式签名密钥
2. **HTTPS**: API 通信使用 HTTPS 加密
3. **访问控制**: 后端 API 添加身份验证
4. **防火墙**: 云服务器配置安全组规则
5. **备份**: 定期备份数据库

---

## 💰 成本估算

### 免费方案（适合小团队）

- GitHub Release: 免费
- 内网穿透（Cloudflare Tunnel）: 免费
- 总成本: **0 元/月**

### 付费方案（推荐生产环境）

- 云服务器（阿里云 ECS 2 核 4G）: ~100 元/月
- 域名: ~50 元/年
- SSL 证书（Let's Encrypt）: 免费
- GitHub Release: 免费
- 总成本: **~100 元/月**

---

## 📞 技术支持

如需帮助，请联系:

- Email: your-email@example.com
- GitHub Issues: https://github.com/your-username/shumu/issues
