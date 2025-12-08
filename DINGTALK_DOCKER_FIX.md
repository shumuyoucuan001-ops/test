# 钉钉登录 Docker 部署问题修复指南

## ❌ 错误现象

当使用 Docker 容器部署后，钉钉登录失败，网页返回：
```
对不起
你无权限查看该页面
url参数不合法
```

## 🔍 问题诊断

### 步骤 1：检查后端配置

访问配置检查接口（需要替换为实际的后端地址）：
```bash
curl http://your-server:5000/dingtalk/check-config
```

或者直接在浏览器中访问：
```
http://your-server:5000/dingtalk/check-config
```

该接口会返回详细的配置检查结果，包括：
- 配置项是否已设置
- 发现的问题
- 修复建议

### 步骤 2：检查 Docker 环境变量

确认 `docker-compose.yml` 中的环境变量配置：

```yaml
services:
  api:
    env_file: ./server/.env  # 确保路径正确
```

### 步骤 3：检查 server/.env 文件

确保 `server/.env` 文件存在且包含以下配置：

```env
# 钉钉配置
DINGTALK_APP_KEY=your_app_key_here
DINGTALK_APP_SECRET=your_app_secret_here
DINGTALK_CORP_ID=your_corp_id_here
DINGTALK_REDIRECT_URI=http://your-domain.com/login

# 注意：回调地址必须与钉钉开放平台配置的完全一致
```

**重要提示**：
- 如果使用 IP 地址，格式：`http://47.106.87.166/login`
- 如果使用域名，格式：`http://your-domain.com/login` 或 `https://your-domain.com/login`
- 协议（http/https）必须与钉钉开放平台配置一致

## 🔧 修复步骤

### 1. 检查并修复环境变量配置

#### 1.1 确认 .env 文件位置

确保 `server/.env` 文件存在于项目根目录的 `server` 文件夹下：
```
shumu-main/
  ├── server/
  │   ├── .env          ← 确保此文件存在
  │   ├── src/
  │   └── ...
  └── docker-compose.yml
```

#### 1.2 检查 .env 文件内容

使用以下命令检查环境变量是否已加载（在 Docker 容器内）：
```bash
# 进入容器
docker exec -it shumuu-api-1 sh

# 在容器内检查环境变量
echo $DINGTALK_APP_KEY
echo $DINGTALK_APP_SECRET
echo $DINGTALK_CORP_ID
echo $DINGTALK_REDIRECT_URI
```

如果环境变量为空，说明 `.env` 文件未正确加载。

#### 1.3 修复环境变量加载问题

**方法 1：确保 docker-compose.yml 配置正确**

检查 `docker-compose.yml` 中的 `env_file` 路径：
```yaml
services:
  api:
    env_file: ./server/.env  # 相对路径，相对于 docker-compose.yml 所在目录
```

**方法 2：使用绝对路径**

如果相对路径有问题，可以使用绝对路径：
```yaml
services:
  api:
    env_file: /path/to/your/project/server/.env
```

**方法 3：直接在 docker-compose.yml 中配置（不推荐，但可以临时使用）**

```yaml
services:
  api:
    environment:
      - DINGTALK_APP_KEY=your_app_key_here
      - DINGTALK_APP_SECRET=your_app_secret_here
      - DINGTALK_CORP_ID=your_corp_id_here
      - DINGTALK_REDIRECT_URI=http://your-domain.com/login
```

### 2. 检查钉钉开放平台配置

#### 2.1 登录钉钉开放平台

访问：https://open.dingtalk.com/

#### 2.2 检查回调地址配置

1. 进入 **应用开发** → **企业内部开发** → 选择您的应用
2. 进入 **应用详情** → **开发管理** → **OAuth2.0回调地址**
3. 确保回调地址与 `DINGTALK_REDIRECT_URI` **完全一致**

**示例**：
- 如果 `DINGTALK_REDIRECT_URI=http://47.106.87.166/login`
- 那么钉钉开放平台的回调地址也必须是：`http://47.106.87.166/login`

#### 2.3 添加安全域名（⚠️ 最重要！）

这是导致 "url参数不合法" 错误的最常见原因！

1. 进入 **应用详情** → **开发管理** → **安全域名**
2. 点击 **添加安全域名**
3. 输入域名（**仅域名，不要包含协议和路径**）：
   - 如果使用 IP：`47.106.87.166`
   - 如果使用域名：`your-domain.com`
4. 保存配置

**重要提示**：
- ✅ 只需要域名：`47.106.87.166` 或 `your-domain.com`
- ❌ 不要包含：`http://` 或 `https://`
- ❌ 不要包含：路径 `/login`
- ❌ 不要包含：端口号

#### 2.4 检查应用状态

1. 确保应用已 **发布上线**
2. 确保应用状态为 **正常**
3. 检查权限管理：
   - 进入 **权限管理**
   - 确保已申请以下权限：
     - ✅ 获取用户基本信息
     - ✅ 获取用户手机号（如果需要）
   - 确保权限已被 **企业管理员授权**

### 3. 重启 Docker 容器

修改配置后，必须重启容器使配置生效：

```bash
# 停止容器
docker-compose down

# 重新启动容器
docker-compose up -d

# 查看日志，确认配置已加载
docker-compose logs -f api
```

在日志中应该看到：
```
[DingTalkService] 生成的授权URL: https://oapi.dingtalk.com/connect/oauth2/sns_authorize?...
[DingTalkService] 配置信息: { appKey: '...', corpId: '...', redirectUri: '...' }
[DingTalkService] 请确保钉钉开放平台已配置：
[DingTalkService] 1. 回调地址: http://your-domain.com/login
[DingTalkService] 2. 安全域名: your-domain.com
```

### 4. 验证配置

#### 4.1 测试授权 URL 生成

访问：
```
http://your-server:5000/dingtalk/auth-url
```

应该返回：
```json
{
  "url": "https://oapi.dingtalk.com/connect/oauth2/sns_authorize?appid=...&redirect_uri=http%3A%2F%2Fyour-domain.com%2Flogin&..."
}
```

检查返回的 URL 中的 `redirect_uri` 参数是否正确编码。

#### 4.2 测试登录流程

1. 访问前端登录页面
2. 点击"钉钉企业登录"按钮
3. 应该跳转到钉钉授权页面（而不是错误页面）
4. 授权后应该回调到：`http://your-domain.com/login?code=xxx&state=xxx`

## 📋 配置检查清单

在开始测试前，请逐一确认：

### Docker 配置
- [ ] `server/.env` 文件存在
- [ ] `docker-compose.yml` 中 `env_file` 路径正确
- [ ] 环境变量已正确加载到容器中
- [ ] 容器已重启使配置生效

### 后端环境变量
- [ ] `DINGTALK_APP_KEY` 已配置
- [ ] `DINGTALK_APP_SECRET` 已配置
- [ ] `DINGTALK_CORP_ID` 已配置
- [ ] `DINGTALK_REDIRECT_URI` 已配置
- [ ] `DINGTALK_REDIRECT_URI` 格式正确（完整URL）

### 钉钉开放平台配置
- [ ] 应用已创建并选择正确的应用类型（企业内应用）
- [ ] OAuth2.0回调地址已配置
- [ ] **安全域名已添加**（最重要！）
- [ ] 回调地址与 `DINGTALK_REDIRECT_URI` 完全一致
- [ ] 应用已发布上线
- [ ] 权限已申请并被企业管理员授权

## 🐛 常见问题

### Q1: 环境变量在容器中为空

**A**: 检查以下几点：
1. `server/.env` 文件是否存在
2. `docker-compose.yml` 中 `env_file` 路径是否正确
3. 文件路径是相对路径还是绝对路径
4. 容器是否已重启

**解决方法**：
```bash
# 检查 .env 文件是否存在
ls -la server/.env

# 检查 docker-compose.yml 配置
cat docker-compose.yml | grep env_file

# 重启容器
docker-compose restart api
```

### Q2: 仍然提示 "url参数不合法"

**A**: 这通常是因为安全域名未配置。请确保：
1. 已在钉钉开放平台添加安全域名
2. 安全域名格式正确（仅域名，不含协议和路径）
3. 等待几分钟让配置生效

### Q3: 回调地址不匹配

**A**: 确保以下两个位置的配置完全一致：
1. 钉钉开放平台：OAuth2.0回调地址
2. `server/.env`：`DINGTALK_REDIRECT_URI`

包括：
- 协议（http/https）
- 域名
- 路径
- 末尾不要有多余的 `/`

### Q4: 如何查看容器内的环境变量？

**A**: 
```bash
# 进入容器
docker exec -it shumuu-api-1 sh

# 查看所有环境变量
env | grep DINGTALK

# 或者查看特定变量
echo $DINGTALK_REDIRECT_URI
```

### Q5: 配置修改后多久生效？

**A**:
- Docker 容器：需要重启容器
- 钉钉开放平台：通常立即生效，但可能需要等待几分钟

## 📞 获取帮助

如果以上步骤都无法解决问题：

1. **查看详细日志**：
   ```bash
   docker-compose logs -f api
   ```

2. **使用配置检查接口**：
   ```bash
   curl http://your-server:5000/dingtalk/check-config
   ```

3. **查看钉钉开放平台文档**：
   - https://open.dingtalk.com/document/
   - https://open.dingtalk.com/document/orgapp-server/obtain-identity-credentials

4. **联系钉钉技术支持**

## 🔗 相关文档

- [钉钉登录配置指南](./DINGTALK_SETUP.md)
- [钉钉登录问题排查指南](./DINGTALK_TROUBLESHOOTING.md)
- [钉钉配置检查清单](./DINGTALK_CONFIG_CHECKLIST.md)

