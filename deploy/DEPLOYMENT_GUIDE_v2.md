# 部署指南 - 标签补充信息功能更新

> 本次更新包含：商品搜索打印规格字段修复、标签补充信息的新增/删除功能修复

## 📋 更新内容

### 1. 数据库更改

- ✅ 已完成：将 `商品主档销售规格` 表的 `规格` 列重命名为 `规格名称`

### 2. 后端更改

- 修复商品搜索打印接口的规格字段查询
- 所有查询 `label_data_audit` 表的接口都已更新

### 3. 前端更改

- 修复标签补充信息的显示、新增、删除功能
- 使用新的 `label_data_audit` API
- 修复 Modal.confirm 在 Next.js 中的兼容性问题

---

## 🚀 部署步骤

### 第一步：确认数据库已更新

如果还没有执行数据库更改，请先执行：

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 连接 MySQL
mysql -h guishumu999666.rwlb.rds.aliyuncs.com -u xitongquanju -p

# 输入密码：b4FFS6kVGKV4jV

# 执行更改
USE sm_shangping;
ALTER TABLE `商品主档销售规格`
CHANGE COLUMN `规格` `规格名称` VARCHAR(255);

# 验证
SHOW COLUMNS FROM `商品主档销售规格` LIKE '规格%';

# 退出
EXIT;
```

### 第二步：进入项目目录

```bash
cd /www/docker/shumu
```

### 第三步：拉取最新代码

```bash
# 拉取最新代码
git pull origin develop

# 查看最近的提交
git log --oneline -10
```

应该看到以下提交记录：

- `fix: 修复 labelDataApi.delete 方法的 URL 路径`
- `fix: 修复 Modal.confirm 在 Next.js 客户端组件中的使用`
- `fix: 修复商品资料页面标签补充信息的显示和刷新`
- `fix: 修复 labelDataApi.create 方法的 API 端点`
- `fix: 修复商品资料标签补充信息保存和删除功能`
- `fix: 优化商品搜索打印规格字段查询逻辑`

### 第四步：重新构建并启动服务

#### 方案 A：完全重新构建（推荐，首次部署使用）

```bash
# 停止所有容器
docker-compose down

# 删除旧镜像（可选，如果想完全重建）
docker rmi shumu-web shumu-api 2>/dev/null || true

# 禁用 BuildKit
export DOCKER_BUILDKIT=0

# 重新构建所有服务（不使用缓存）
docker-compose build --no-cache

# 启动所有服务
docker-compose up -d

# 等待服务启动
sleep 15
```

#### 方案 B：只重启 API 服务（如果只是后端代码更改）

```bash
# 停止 API 容器
docker-compose stop api

# 删除旧容器和镜像
docker rm -f shumu-api-1 2>/dev/null || true
docker rmi shumu-api 2>/dev/null || true

# 重新构建 API
export DOCKER_BUILDKIT=0
docker-compose build --no-cache api

# 启动 API
docker-compose up -d api

# 等待启动
sleep 10
```

### 第五步：验证部署

```bash
# 查看容器状态
docker-compose ps

# 查看 API 日志
docker-compose logs api --tail=50

# 查看 Web 日志
docker-compose logs web --tail=50

# 测试健康检查
curl http://127.0.0.1:5000/health

# 测试前端
curl -I http://127.0.0.1:3000/
```

### 第六步：测试功能

#### 1. 测试商品搜索打印 - 规格字段

```bash
# 测试规格字段是否正确返回
curl -s "http://127.0.0.1:5000/label-print/search?q=123" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'找到 {len(data)} 条商品')
for item in data[:3]:
    print(f\"  SKU: {item['skuCode']}, 规格: '{item.get('spec', '(空)')}'\")
"
```

#### 2. 测试标签补充信息保存

```bash
# 测试创建标签资料
curl -s -X POST "http://127.0.0.1:5000/label-data/create-or-update" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST-DEPLOY-001",
    "supplierName": "测试供应商",
    "headerInfo": "测试抬头",
    "productName": "测试产品",
    "manufacturerName": "测试厂家"
  }' | python3 -m json.tool
```

#### 3. 测试标签补充信息查询

```bash
# 查询刚才创建的数据
curl -s "http://127.0.0.1:5000/label-data/all?sku=TEST-DEPLOY-001" | python3 -m json.tool
```

#### 4. 测试删除功能

```bash
# 删除测试数据
curl -s -X DELETE "http://127.0.0.1:5000/label-data/delete/TEST-DEPLOY-001/%E6%B5%8B%E8%AF%95%E4%BE%9B%E5%BA%94%E5%95%86" | python3 -m json.tool
```

#### 5. 浏览器测试

1. 访问：`http://your-domain.com/home/print`

   - 搜索商品，验证规格列是否正确显示

2. 访问：`http://your-domain.com/home/product-supplement`

   - 测试新增标签资料
   - 测试删除标签资料

3. 访问：`http://your-domain.com/home/products`
   - 搜索一个商品，打开详情
   - 切换到"标签补充信息"标签页
   - 验证数据是否正确显示
   - 测试新增和删除功能

---

## 🔍 故障排查

### 问题 1：前端静态资源 404

```bash
# 检查 Web 容器内的文件结构
docker exec shumu-web-1 ls -la /app/web/.next/static/

# 如果文件不存在，重新构建 Web
docker-compose stop web
docker rm -f shumu-web-1
docker rmi shumu-web
docker-compose build --no-cache web
docker-compose up -d web
```

### 问题 2：API 连接失败

```bash
# 检查 API 容器日志
docker-compose logs api --tail=100

# 检查端口监听
netstat -tlnp | grep 5000

# 重启 API
docker-compose restart api
```

### 问题 3：数据库连接失败

```bash
# 进入 API 容器测试数据库连接
docker exec -it shumu-api-1 /bin/sh

# 测试连接（容器内）
nc -zv guishumu999666.rwlb.rds.aliyuncs.com 3306
```

### 问题 4：前端无法连接后端

检查 Nginx 配置是否正确反代到后端：

```bash
# 查看 Nginx 配置
cat /www/server/panel/vhost/nginx/your-domain.conf

# 确保有以下配置
location /api/ {
    proxy_pass http://127.0.0.1:5000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## 📝 回滚步骤

如果部署后发现问题，可以快速回滚：

```bash
# 查看提交历史
git log --oneline -20

# 回滚到上一个稳定版本（替换 COMMIT_HASH）
git reset --hard COMMIT_HASH

# 重新构建并启动
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## ✅ 部署检查清单

- [ ] 数据库列名已更新（`规格` → `规格名称`）
- [ ] 最新代码已拉取
- [ ] 容器已重新构建
- [ ] 所有容器运行正常
- [ ] 健康检查通过
- [ ] 商品搜索打印规格字段显示正确
- [ ] 标签补充信息新增功能正常
- [ ] 标签补充信息删除功能正常
- [ ] 商品资料页面标签信息显示正常
- [ ] 没有明显错误日志

---

## 📞 联系支持

如有问题，请查看：

- API 日志：`docker-compose logs api`
- Web 日志：`docker-compose logs web`
- Nginx 日志：`/www/wwwlogs/your-domain.log`
