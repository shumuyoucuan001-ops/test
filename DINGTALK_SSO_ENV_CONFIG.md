# 钉钉SSO免登环境变量配置说明

## 📋 配置要求

对于**SSO免登方式**，环境变量配置要求如下：

### ✅ 必需的配置

以下配置项**必须**在 `server/.env` 文件中配置：

```env
# 钉钉应用Key（必需）
DINGTALK_APP_KEY=ding1u4heyzkoctmkvc5

# 钉钉应用密钥（必需）
DINGTALK_APP_SECRET=your_app_secret_here

# 钉钉企业ID（必需）
DINGTALK_CORP_ID=ding9718d9b7e961b1c7a1320dcb25e91351
```

### ❌ 不需要的配置

以下配置项**不需要**配置（免登方式不需要回调地址）：

```env
# DINGTALK_REDIRECT_URI - 不需要配置！
# 免登方式不需要回调地址，因为授权码是在钉钉客户端内直接获取的
```

## 🔍 配置用途说明

### 1. DINGTALK_APP_KEY（必需）

**用途**：
- 用于获取钉钉 access_token
- 用于验证应用身份

**获取位置**：
- 钉钉开放平台 → 应用详情 → 基本信息 → AppKey

### 2. DINGTALK_APP_SECRET（必需）

**用途**：
- 用于获取钉钉 access_token
- 用于验证应用身份（敏感信息，不要泄露）

**获取位置**：
- 钉钉开放平台 → 应用详情 → 基本信息 → AppSecret（点击"查看"显示）

### 3. DINGTALK_CORP_ID（必需）

**用途**：
- 前端调用 `dd.runtime.permission.requestAuthCode` 时需要
- 用于标识企业

**获取位置**：
- 钉钉开放平台 → 企业信息 → 企业ID

### 4. DINGTALK_REDIRECT_URI（不需要）

**为什么不需要**：
- 免登方式在钉钉客户端内直接获取授权码
- 不需要跳转到外部页面
- 不需要回调地址

**注意**：
- 如果代码中还有检查这个配置，可以忽略警告
- 或者配置一个占位值（不会实际使用）

## 📝 完整配置示例

### server/.env 文件

```env
# ============================================
# 钉钉SSO免登配置（必需）
# ============================================
DINGTALK_APP_KEY=ding1u4heyzkoctmkvc5
DINGTALK_APP_SECRET=your_app_secret_here
DINGTALK_CORP_ID=ding9718d9b7e961b1c7a1320dcb25e91351

# ============================================
# 钉钉回调地址（免登方式不需要，可省略）
# ============================================
# DINGTALK_REDIRECT_URI=http://47.106.87.166
# 注意：免登方式不需要配置回调地址
```

## ✅ 配置验证

### 方法1: 检查后端日志

启动后端服务后，查看日志：

```
[DingTalkService] 钉钉配置不完整，钉钉登录功能可能不可用
```

如果看到这个警告，说明配置不完整。

### 方法2: 调用配置检查接口

```bash
curl http://47.106.87.166:5000/dingtalk/check-config
```

应该返回：
```json
{
  "isValid": true,
  "config": {
    "appKey": { "configured": true, "value": "ding1u4hey..." },
    "appSecret": { "configured": true, "value": "已配置（已隐藏）" },
    "corpId": { "configured": true, "value": "ding9718d9..." },
    "redirectUri": { "configured": false, "value": "未配置" }
  },
  "issues": [],
  "recommendations": []
}
```

**注意**：`redirectUri` 显示"未配置"是正常的，免登方式不需要。

### 方法3: 测试获取CorpId接口

```bash
curl http://47.106.87.166:5000/dingtalk/corp-id
```

应该返回：
```json
{
  "corpId": "ding9718d9b7e961b1c7a1320dcb25e91351"
}
```

## 🔧 如果代码中还有redirectUri检查

如果后端代码中还有对 `DINGTALK_REDIRECT_URI` 的检查，可以：

### 方案1: 配置占位值（推荐）

```env
# 配置一个占位值，避免警告
DINGTALK_REDIRECT_URI=http://47.106.87.166
```

虽然不会实际使用，但可以避免代码中的警告。

### 方案2: 修改代码（可选）

如果不想配置，可以修改后端代码，让 `redirectUri` 变为可选（仅用于扫码登录，免登不需要）。

## 📋 配置检查清单

- [ ] `DINGTALK_APP_KEY` 已配置
- [ ] `DINGTALK_APP_SECRET` 已配置
- [ ] `DINGTALK_CORP_ID` 已配置
- [ ] `DINGTALK_REDIRECT_URI` 可配置可不配置（免登不需要）

## ❓ 常见问题

### Q1: 为什么免登不需要回调地址？

**A**: 免登方式在钉钉客户端内直接调用JSAPI获取授权码，不需要跳转到外部页面，所以不需要回调地址。

### Q2: 如果配置了DINGTALK_REDIRECT_URI会怎样？

**A**: 配置了也没关系，只是不会被使用。可以配置一个占位值避免警告。

### Q3: 扫码登录和免登的配置有什么区别？

**A**: 
- **扫码登录**：需要 `DINGTALK_REDIRECT_URI`（回调地址）
- **免登（SSO）**：不需要 `DINGTALK_REDIRECT_URI`

其他配置（AppKey、AppSecret、CorpId）都是必需的。

## 🎯 总结

对于**SSO免登方式**：

**必需配置**：
- ✅ `DINGTALK_APP_KEY`
- ✅ `DINGTALK_APP_SECRET`
- ✅ `DINGTALK_CORP_ID`

**不需要配置**：
- ❌ `DINGTALK_REDIRECT_URI`（免登不需要回调地址）


