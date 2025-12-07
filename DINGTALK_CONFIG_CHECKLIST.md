# 钉钉登录配置检查清单

## 📋 需要补充的配置信息总结

根据代码分析，以下信息需要您补充配置：

---

## 🔑 1. 钉钉开放平台配置信息

### 需要获取的信息（从钉钉开放平台获取）

| 配置项 | 说明 | 获取位置 | 当前代码中的位置 |
|--------|------|----------|-----------------|
| **AppKey** | 钉钉应用的唯一标识 | 钉钉开放平台 -> 应用详情 -> 基本信息 | `server/src/dingtalk/dingtalk.service.ts:17` |
| **AppSecret** | 钉钉应用的密钥（敏感信息） | 钉钉开放平台 -> 应用详情 -> 基本信息 | `server/src/dingtalk/dingtalk.service.ts:18` |
| **CorpId** | 企业ID | 钉钉开放平台 -> 企业信息 | `server/src/dingtalk/dingtalk.service.ts:19` |

### ⚠️ 重要提示
- 当前代码中已有**硬编码的默认值**（仅用于开发测试）
- **生产环境必须使用环境变量**，不要将敏感信息硬编码在代码中
- AppSecret 是敏感信息，**绝对不能提交到代码仓库**

---

## 🌐 2. 回调地址配置

### 需要配置的位置

#### 位置1：钉钉开放平台（必须配置）
- **位置**：钉钉开放平台 -> 应用详情 -> 开发管理 -> 回调地址
- **配置项**：OAuth2.0 回调地址
- **格式**：`http://your-domain.com/login` 或 `https://your-domain.com/login`

#### 位置2：后端环境变量（推荐）
- **文件位置**：`server/.env`（需要创建）
- **配置项**：`DINGTALK_REDIRECT_URI`
- **当前代码位置**：`server/src/dingtalk/dingtalk.service.ts:20`
- **当前默认值**：`http://shuzhishanmu.com/login/callback`

#### 位置3：前端登录页面（自动处理）
- **文件位置**：`web/src/app/login/page.tsx`
- **说明**：前端会自动从URL参数中获取 `code`，无需手动配置

### ⚠️ 回调地址匹配规则
- **钉钉开放平台配置的回调地址** 必须与 **后端环境变量中的 `DINGTALK_REDIRECT_URI`** 完全一致
- 回调地址格式：`http://域名/login` 或 `https://域名/login`
- 注意：钉钉回调时会自动添加 `?code=xxx&state=xxx` 参数

---

## 📝 3. 环境变量配置

### 需要创建/修改的文件

**文件路径**：`server/.env`

**需要添加的配置项**：

```env
# ============================================
# 钉钉登录配置
# ============================================

# 钉钉应用Key（从钉钉开放平台获取）
DINGTALK_APP_KEY=your_app_key_here

# 钉钉应用密钥（从钉钉开放平台获取，敏感信息！）
DINGTALK_APP_SECRET=your_app_secret_here

# 钉钉企业ID（从钉钉开放平台获取）
DINGTALK_CORP_ID=your_corp_id_here

# 钉钉回调地址（必须与钉钉开放平台配置的回调地址一致）
# 开发环境示例：http://localhost:3000/login
# 生产环境示例：https://shuzhishanmu.com/login
DINGTALK_REDIRECT_URI=http://shuzhishanmu.com/login

# 是否强制要求钉钉登录（true=必须钉钉登录，false=可选）
REQUIRE_DINGTALK_LOGIN=false
```

### ⚠️ 环境变量优先级
- 如果设置了环境变量，代码会优先使用环境变量的值
- 如果没有设置环境变量，代码会使用硬编码的默认值（仅用于开发测试）

---

## 🔍 4. 代码中需要检查的位置

### 后端代码位置

#### 文件1：`server/src/dingtalk/dingtalk.service.ts`
```typescript
// 第17-20行：钉钉配置读取
this.appKey = process.env.DINGTALK_APP_KEY || 'ding1u4heyzkoctmkvc5';
this.appSecret = process.env.DINGTALK_APP_SECRET || 'adl8aXj2TdUVScGCDriRcbJzV37vTZQOYLF-VuLAeBljoSrL3Z8R_NDbYSRCMPlX';
this.corpId = process.env.DINGTALK_CORP_ID || 'ding9718d9b7e961b1c7a1320dcb25e91351';
this.redirectUri = process.env.DINGTALK_REDIRECT_URI || 'http://shuzhishanmu.com/login/callback';
```

**需要做的**：
- ✅ 创建 `server/.env` 文件
- ✅ 在 `.env` 文件中配置上述环境变量
- ⚠️ **生产环境建议删除硬编码的默认值**，强制使用环境变量

#### 文件2：`server/src/acl/acl.service.ts`
```typescript
// 第261行：登录方法，已支持钉钉验证
async login(username: string, password: string, deviceInfo?: string, dingTalkCode?: string)
```

**说明**：此文件无需修改，已集成钉钉验证逻辑

---

## ✅ 5. 配置检查步骤

### 步骤1：获取钉钉配置信息
1. 访问 [钉钉开放平台](https://open.dingtalk.com/)
2. 登录后进入"应用开发" -> "企业内部开发" -> "H5微应用"
3. 创建或选择应用
4. 记录以下信息：
   - AppKey
   - AppSecret（点击"查看"按钮显示）
   - CorpId（在企业信息中查看）

### 步骤2：配置钉钉开放平台回调地址
1. 在钉钉开放平台的应用设置中
2. 找到"开发管理" -> "OAuth2.0回调地址"
3. 添加回调地址：
   - 开发环境：`http://localhost:3000/login`
   - 生产环境：`https://shuzhishanmu.com/login`（根据实际域名修改）

### 步骤3：创建后端环境变量文件
1. 在 `server` 目录下创建 `.env` 文件
2. 复制上面的环境变量模板
3. 填入从钉钉开放平台获取的实际值

### 步骤4：验证配置
1. 检查环境变量是否正确加载
2. 检查回调地址是否匹配
3. 测试钉钉登录流程

---

## 🚨 6. 安全注意事项

### ⚠️ 必须注意的事项

1. **不要将敏感信息提交到代码仓库**
   - AppSecret 是敏感信息
   - 确保 `.env` 文件在 `.gitignore` 中
   - 生产环境使用环境变量，不要硬编码

2. **回调地址必须匹配**
   - 钉钉开放平台配置的回调地址
   - 后端环境变量中的 `DINGTALK_REDIRECT_URI`
   - 两者必须完全一致（包括协议 http/https）

3. **生产环境建议**
   - 删除代码中的硬编码默认值
   - 使用环境变量或配置中心管理敏感信息
   - 启用 HTTPS

---

## 📍 7. 配置位置总结表

| 配置项 | 配置位置 | 文件/位置 | 优先级 |
|--------|----------|-----------|--------|
| AppKey | 环境变量 | `server/.env` → `DINGTALK_APP_KEY` | 高 |
| AppKey | 代码默认值 | `server/src/dingtalk/dingtalk.service.ts:17` | 低（仅开发） |
| AppSecret | 环境变量 | `server/.env` → `DINGTALK_APP_SECRET` | 高 |
| AppSecret | 代码默认值 | `server/src/dingtalk/dingtalk.service.ts:18` | 低（仅开发） |
| CorpId | 环境变量 | `server/.env` → `DINGTALK_CORP_ID` | 高 |
| CorpId | 代码默认值 | `server/src/dingtalk/dingtalk.service.ts:19` | 低（仅开发） |
| 回调地址 | 钉钉开放平台 | 应用设置 → OAuth2.0回调地址 | **必须配置** |
| 回调地址 | 环境变量 | `server/.env` → `DINGTALK_REDIRECT_URI` | 高 |
| 回调地址 | 代码默认值 | `server/src/dingtalk/dingtalk.service.ts:20` | 低（仅开发） |

---

## 🔧 8. 快速配置模板

### 创建 `server/.env` 文件

```bash
# 在 server 目录下执行
touch .env
```

### 复制以下内容到 `server/.env`

```env
# 钉钉配置（请替换为实际值）
DINGTALK_APP_KEY=你的AppKey
DINGTALK_APP_SECRET=你的AppSecret
DINGTALK_CORP_ID=你的CorpId
DINGTALK_REDIRECT_URI=http://shuzhishanmu.com/login
REQUIRE_DINGTALK_LOGIN=false
```

---

## 📞 9. 验证配置是否生效

### 检查方法

1. **查看后端启动日志**
   - 如果配置不完整，会看到警告：`[DingTalkService] 钉钉配置不完整，钉钉登录功能可能不可用`

2. **测试钉钉登录**
   - 访问登录页面
   - 点击"钉钉企业登录"按钮
   - 检查是否能正常跳转到钉钉授权页面

3. **检查回调**
   - 授权后检查是否能正常回调到登录页面
   - 检查URL中是否包含 `code` 参数

---

## 📚 相关文档

- [钉钉开放平台文档](https://open.dingtalk.com/document/)
- [钉钉OAuth2.0认证文档](https://open.dingtalk.com/document/orgapp-server/obtain-identity-credentials)
- 项目配置文档：`DINGTALK_SETUP.md`

