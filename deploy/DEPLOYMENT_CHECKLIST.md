# 🚀 部署检查清单

## 📋 部署前检查

### 1. 服务器环境
- [ ] 已安装宝塔面板
- [ ] 已安装 Docker 管理器插件
- [ ] 已安装 Nginx
- [ ] 服务器内存 ≥ 2GB
- [ ] 服务器可用存储 ≥ 10GB
- [ ] 已开放 80 端口和 443 端口

### 2. 域名配置（可选）
- [ ] 域名已解析到服务器 IP
- [ ] DNS 解析生效（可通过 `ping your-domain.com` 检查）

---

## 🔧 部署步骤

### 步骤 1: SSH 登录并克隆项目
```bash
ssh root@your-server-ip
cd /www/wwwroot
git clone https://github.com/xuxiang6/shumu.git
cd shumu
```
- [ ] 项目克隆成功
- [ ] 进入项目目录

### 步骤 2: 配置环境变量
```bash
cp .env.example .env
vim .env  # 或使用宝塔文件管理器编辑
```
- [ ] 已创建 `.env` 文件
- [ ] 已修改 `JWT_SECRET` 为复杂密钥
- [ ] 已检查 `DATABASE_URL` 配置

### 步骤 3: 构建和启动 Docker
```bash
# 赋予脚本执行权限
chmod +x deploy/*.sh

# 执行快速部署
./deploy/quick-start.sh
```
- [ ] Docker 镜像构建成功
- [ ] 容器启动成功
- [ ] `docker-compose ps` 显示两个容器都在运行
- [ ] API 健康检查通过 (`curl http://localhost:5000/health`)

### 步骤 4: 配置 Nginx 反向代理

#### 方法 A: 宝塔面板界面配置
1. **创建网站**
   - [ ] 网站管理 → 添加站点
   - [ ] 域名填写完成（或填写服务器 IP）
   - [ ] 根目录随意选择（不影响）

2. **配置反向代理**
   - [ ] 网站设置 → 配置文件
   - [ ] 复制 `deploy/nginx-config-example.conf` 内容
   - [ ] 替换域名为实际域名/IP
   - [ ] 保存配置

3. **重启 Nginx**
   - [ ] 点击"保存"后重启 Nginx

#### 方法 B: 命令行配置
```bash
# 复制配置文件
cp deploy/nginx-config-example.conf /www/server/panel/vhost/nginx/shumu.conf

# 编辑配置文件，替换域名
vim /www/server/panel/vhost/nginx/shumu.conf

# 测试配置
nginx -t

# 重启 Nginx
nginx -s reload
```
- [ ] 配置文件创建成功
- [ ] Nginx 配置测试通过
- [ ] Nginx 重启成功

### 步骤 5: 配置 SSL 证书（推荐）
- [ ] 在宝塔面板申请 Let's Encrypt 证书
- [ ] SSL 证书申请成功
- [ ] 开启"强制 HTTPS"

### 步骤 6: 配置防火墙
- [ ] 宝塔安全面板开放 80 端口
- [ ] 宝塔安全面板开放 443 端口
- [ ] **关闭** 5000 端口（API 端口不对外暴露）

---

## ✅ 部署验证

### 1. 检查 Docker 容器
```bash
docker-compose ps
```
**预期结果**: 两个容器都显示 "running"
- [ ] `shumu-api-1` 状态为 `running`
- [ ] `shumu-web-1` 状态为 `running`

### 2. 检查 API 健康状态
```bash
curl http://localhost:5000/health
```
**预期结果**: `{"status":"ok"}`
- [ ] API 健康检查返回正常

### 3. 检查 Web 前端
在浏览器访问:
- HTTP: `http://your-domain.com` 或 `http://服务器IP`
- HTTPS: `https://your-domain.com`

**预期结果**: 显示登录页面
- [ ] 页面正常显示
- [ ] 没有 404 或 502 错误
- [ ] 页面样式正常

### 4. 测试 API 代理
在浏览器控制台测试:
```javascript
fetch('/api/health')
  .then(r => r.json())
  .then(console.log)
```
**预期结果**: `{status: "ok"}`
- [ ] API 代理工作正常

### 5. 测试登录功能
- [ ] 可以访问登录页面
- [ ] 可以输入用户名和密码
- [ ] 可以成功登录（如果有测试账号）
- [ ] 登录后可以访问其他页面

### 6. 测试 APP 连接（如果已部署 APP）
- [ ] APP 可以连接到服务器
- [ ] APP 可以登录
- [ ] APP 打印功能正常

---

## 📊 监控检查

### 容器资源使用
```bash
docker stats --no-stream
```
- [ ] CPU 使用率正常（< 80%）
- [ ] 内存使用率正常（< 80%）

### 日志检查
```bash
# 查看最近日志
docker-compose logs --tail=50

# 实时查看日志
docker-compose logs -f
```
- [ ] 没有严重错误（ERROR）
- [ ] 没有崩溃信息

---

## 🔒 安全检查

### 1. JWT 密钥
- [ ] `.env` 中的 `JWT_SECRET` 已修改为复杂密钥
- [ ] 密钥长度 ≥ 32 字符
- [ ] 密钥包含字母、数字、特殊字符

### 2. 端口安全
- [ ] 80 端口已开放（HTTP）
- [ ] 443 端口已开放（HTTPS）
- [ ] 5000 端口已关闭（不对外暴露）
- [ ] 其他不必要的端口已关闭

### 3. SSL 证书
- [ ] SSL 证书已配置
- [ ] 强制 HTTPS 已启用
- [ ] 证书自动续期已配置

### 4. 防火墙规则
- [ ] 宝塔面板防火墙已启用
- [ ] 只开放必要端口
- [ ] SSH 端口已修改（推荐）

---

## 📝 后续维护

### 定期检查（每周）
- [ ] 查看 Docker 容器状态
- [ ] 查看错误日志
- [ ] 查看磁盘使用情况
- [ ] 检查 SSL 证书有效期

### 更新部署（需要时）
```bash
cd /www/wwwroot/shumu
./deploy/update.sh
```
- [ ] 更新脚本执行成功
- [ ] 服务重启成功
- [ ] 功能测试通过

### 备份数据（每天/每周）
```bash
# 备份数据库
cp /www/wwwroot/shumu/server/prisma/dev.db /backup/shumu-db-$(date +%Y%m%d).db

# 备份配置文件
cp /www/wwwroot/shumu/.env /backup/shumu-env-$(date +%Y%m%d).env
```
- [ ] 数据库备份成功
- [ ] 配置文件备份成功

---

## 🐛 问题排查

### 如果 Web 前端无法访问
1. [ ] 检查 Docker 容器是否运行: `docker-compose ps`
2. [ ] 检查 Nginx 配置是否正确: `nginx -t`
3. [ ] 检查防火墙是否开放端口
4. [ ] 查看 Web 容器日志: `docker-compose logs web`

### 如果 API 请求失败
1. [ ] 检查 API 容器是否运行: `docker-compose ps`
2. [ ] 检查 API 健康状态: `curl http://localhost:5000/health`
3. [ ] 检查 Nginx 反向代理配置中的 `/api` 路径
4. [ ] 查看 API 容器日志: `docker-compose logs api`

### 如果数据库错误
```bash
# 进入 API 容器
docker-compose exec api bash

# 重新生成 Prisma Client
npx prisma generate

# 推送数据库结构
npx prisma db push

# 退出容器
exit
```

### 如果容器无法启动
1. [ ] 查看详细日志: `docker-compose logs`
2. [ ] 检查端口是否被占用: `netstat -tuln | grep -E '80|5000'`
3. [ ] 检查磁盘空间: `df -h`
4. [ ] 重建镜像: `docker-compose build --no-cache`

---

## 🎉 部署完成确认

所有检查项都通过后，你的系统已成功部署！

### 最终确认清单
- [ ] ✅ Docker 容器正常运行
- [ ] ✅ API 健康检查通过
- [ ] ✅ Web 前端可以访问
- [ ] ✅ Nginx 反向代理正常
- [ ] ✅ SSL 证书已配置（推荐）
- [ ] ✅ 防火墙规则已设置
- [ ] ✅ JWT 密钥已修改
- [ ] ✅ 登录功能正常
- [ ] ✅ APP 可以连接（如果需要）

**恭喜！你的树木标签系统已成功部署并可以正常使用！** 🎊

---

## 📞 获取帮助

如果遇到问题，请按以下步骤操作：
1. 查看 `deploy/baota-docker-deploy.md` 详细文档
2. 检查 Docker 日志: `docker-compose logs -f`
3. 查看 Nginx 错误日志: `/www/wwwlogs/shumu-error.log`
4. 查看项目 GitHub Issues
5. 联系技术支持

