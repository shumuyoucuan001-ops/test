# 规格字段名称修改说明

## 修改概述

**修改日期**: 2025-10-15  
**修改内容**: 将数据库表 `sm_shangping.商品主档销售规格` 的列名从 `规格` 修改为 `规格名称`

## 影响范围

### 1. 数据库修改

- **表名**: `sm_shangping.商品主档销售规格`
- **列名修改**: `规格` → `规格名称`

### 2. 后端代码修改

#### 修改的文件列表：

1. `server/src/product/master.controller.ts` - 商品主档查询接口
2. `server/src/product/product.service.ts` - 商品服务（3 处 SQL 查询）
3. `server/src/label-data/label-data.service.ts` - 标签数据服务
4. `server/src/receipt/receipt.service.ts` - 收货单服务

#### 详细修改：

**1. server/src/product/master.controller.ts**

```typescript
// 修改前：
SELECT `规格` AS spec

// 修改后：
SELECT `规格名称` AS spec
```

**2. server/src/product/product.service.ts**

- `findByBarcode()` 方法 - 根据条码查询
- `findBySkuCode()` 方法 - 根据 SKU 查询
- `search()` 方法 - 模糊搜索

所有方法中的 SQL 查询都从 `` `规格` `` 改为 `` `规格名称` ``

**3. server/src/label-data/label-data.service.ts**

- `getProductSpecBySku()` 方法 - 获取规格信息

**4. server/src/receipt/receipt.service.ts**

- 收货单明细查询中的商品信息获取

### 3. 前端代码

前端代码不需要修改，因为后端 API 返回的字段名 `spec` 保持不变，只是数据库列名改变。

### 4. 移动端 App

App 代码不需要修改，理由同上。

## 部署步骤

### 准备工作

1. 确保有数据库的修改权限
2. 确保服务器 SSH 访问权限
3. 备份数据库（可选但推荐）

### 执行步骤

#### 步骤 1: 修改数据库列名

登录数据库服务器，执行以下 SQL：

```sql
ALTER TABLE `sm_shangping`.`商品主档销售规格`
CHANGE COLUMN `规格` `规格名称` VARCHAR(255);
```

验证修改：

```sql
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'sm_shangping'
  AND TABLE_NAME = '商品主档销售规格'
  AND COLUMN_NAME = '规格名称';
```

#### 步骤 2: 提交代码到 Git

```bash
# 在本地开发机器上
cd /Users/xiangwork/Documents/GitHub/shumu

# 添加修改的文件
git add server/src/product/master.controller.ts
git add server/src/product/product.service.ts
git add server/src/label-data/label-data.service.ts
git add server/src/receipt/receipt.service.ts
git add deploy/

# 提交
git commit -m "feat: 修改数据库列名 '规格' 为 '规格名称'"

# 推送到远程仓库
git push origin develop
```

#### 步骤 3: 在服务器上更新代码

```bash
# SSH 登录服务器
ssh root@121.43.139.147

# 进入项目目录
cd /www/wwwroot/shumu

# 拉取最新代码
git pull origin develop
```

#### 步骤 4: 重新部署后端 API

```bash
# 停止当前 API 容器
docker-compose stop api
docker rm -f shumu-api-1

# 重新构建 API 镜像（不使用缓存）
docker rmi shumu-api
export DOCKER_BUILDKIT=0
docker-compose build --no-cache api

# 启动 API 容器
docker-compose up -d api

# 查看启动日志
docker-compose logs api --tail=50

# 检查容器状态
docker-compose ps
```

#### 步骤 5: 测试验证

```bash
# 1. 测试 API 健康检查
curl http://127.0.0.1:5000/health

# 2. 测试商品查询接口（通过域名）
curl http://shuzhishanmu.com/api/health

# 3. 登录系统测试
# 访问 http://shuzhishanmu.com
# 登录后测试以下功能：
# - 商品查询
# - 商品主档查看
# - 标签打印
# - 收货单明细
```

## 快速部署脚本

我们提供了自动化部署脚本 `deploy/update-spec-deploy.sh`：

```bash
# 在服务器上执行
cd /www/wwwroot/shumu
chmod +x deploy/update-spec-deploy.sh
./deploy/update-spec-deploy.sh
```

## 回滚方案

如果部署后发现问题，可以按以下步骤回滚：

### 1. 回滚数据库

```sql
ALTER TABLE `sm_shangping`.`商品主档销售规格`
CHANGE COLUMN `规格名称` `规格` VARCHAR(255);
```

### 2. 回滚代码

```bash
cd /www/wwwroot/shumu
git reset --hard HEAD~1
```

### 3. 重新部署旧版本

```bash
docker-compose stop api
docker rm -f shumu-api-1
docker rmi shumu-api
docker-compose build --no-cache api
docker-compose up -d api
```

## 测试清单

部署完成后，请按以下清单逐项测试：

- [ ] API 健康检查接口正常 (`/health`)
- [ ] 用户登录功能正常
- [ ] 商品主档查询正常
- [ ] 商品搜索功能正常（按商品名称、条码、SKU）
- [ ] 商品详情显示规格字段正常
- [ ] 标签数据查询正常
- [ ] 标签打印功能正常
- [ ] 收货单明细查询正常
- [ ] App 端商品查询正常
- [ ] App 端标签打印正常

## 注意事项

1. **数据库备份**: 修改数据库结构前，建议先备份数据库
2. **停机时间**: 重新构建 API 镜像需要约 2-3 分钟，期间 API 服务不可用
3. **缓存清理**: 部署后建议清除浏览器缓存，确保加载最新资源
4. **监控日志**: 部署后密切关注容器日志，及时发现异常
5. **灰度发布**: 如果是生产环境，建议先在测试环境验证

## 联系方式

如有问题，请联系开发团队。

---

**文档版本**: 1.0  
**最后更新**: 2025-10-15
