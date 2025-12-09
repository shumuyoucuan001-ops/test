# 钉钉登录整体逻辑详解

## 📋 概述

本系统实现了钉钉企业内成员登录验证功能，采用 **OAuth2.0 授权码模式**，确保只有钉钉企业内的成员才能登录系统。

## 🔄 完整流程图

```
用户 → 前端登录页 → 点击"钉钉企业登录" 
  ↓
前端请求后端获取授权URL
  ↓
后端生成钉钉授权URL并返回
  ↓
前端跳转到钉钉授权页面
  ↓
用户在钉钉授权页面确认授权
  ↓
钉钉回调到前端登录页（带code参数）
  ↓
前端检测到code，调用后端验证
  ↓
后端通过code获取用户信息并验证
  ↓
验证成功，用户输入用户名密码
  ↓
前端提交登录（包含钉钉code）
  ↓
后端再次验证钉钉身份 + 验证用户名密码
  ↓
登录成功，返回token
```

## 📝 详细步骤说明

### 阶段 1：用户点击钉钉登录

**位置**：`web/src/app/login/page.tsx` - `handleDingTalkLogin()`

**流程**：
1. 用户点击"钉钉企业登录"按钮
2. 前端调用 `dingTalkApi.getAuthUrl('login')`
3. 发送 GET 请求到：`/api/dingtalk/auth-url?state=login`

**代码**：
```typescript
const handleDingTalkLogin = async () => {
  const result = await dingTalkApi.getAuthUrl('login');
  // 跳转到钉钉授权页面
  window.location.href = result.url;
};
```

---

### 阶段 2：后端生成授权URL

**位置**：`server/src/dingtalk/dingtalk.controller.ts` - `getAuthUrl()`
**服务**：`server/src/dingtalk/dingtalk.service.ts` - `generateAuthUrl()`

**流程**：
1. 后端接收请求，调用 `DingTalkService.generateAuthUrl()`
2. 从环境变量读取配置：
   - `DINGTALK_APP_KEY`（应用Key）
   - `DINGTALK_CORP_ID`（企业ID）
   - `DINGTALK_REDIRECT_URI`（回调地址）
3. 生成钉钉授权URL：
   ```
   https://oapi.dingtalk.com/connect/oauth2/sns_authorize?
     appid={APP_KEY}&
     response_type=code&
     scope=snsapi_base&
     redirect_uri={REDIRECT_URI}&
     state={STATE}
   ```
4. 返回授权URL给前端

**关键代码**：
```typescript
const params = new URLSearchParams();
params.append('appid', this.appKey.trim());
params.append('response_type', 'code');
params.append('scope', 'snsapi_base');
params.append('redirect_uri', cleanRedirectUri);
params.append('state', state || 'default');

const authUrl = `https://oapi.dingtalk.com/connect/oauth2/sns_authorize?${params.toString()}`;
```

**注意事项**：
- `redirect_uri` 必须与钉钉开放平台配置的回调地址**完全一致**
- `redirect_uri` 会被自动URL编码（`http://` → `http%3A%2F%2F`）

---

### 阶段 3：用户授权

**位置**：钉钉服务器

**流程**：
1. 前端跳转到钉钉授权URL
2. 用户在钉钉页面确认授权
3. 钉钉验证：
   - 回调地址是否在安全域名列表中
   - 应用是否已发布
   - 权限是否已授权
4. 验证通过后，钉钉重定向到回调地址，并带上 `code` 参数：
   ```
   http://47.106.87.166/login?code=xxx&state=login
   ```

**如果验证失败**：
- 钉钉会重定向到回调地址，并带上错误参数：
  ```
  http://47.106.87.166/login?error=xxx&error_description=xxx
  ```

---

### 阶段 4：前端处理回调

**位置**：`web/src/app/login/page.tsx` - `useEffect()`

**流程**：
1. 页面加载时，检查URL参数
2. 如果发现 `error` 参数：
   - 显示错误提示
   - 清除URL中的错误参数
3. 如果发现 `code` 参数：
   - 调用 `handleDingTalkCallback(code)`
   - 发送 POST 请求到：`/api/dingtalk/callback`
   - 请求体：`{ code: "xxx" }`

**代码**：
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  
  if (error) {
    // 处理错误
    msgApi.error('钉钉登录失败...');
    return;
  }
  
  if (code) {
    // 处理回调
    handleDingTalkCallback(code);
  }
}, []);
```

---

### 阶段 5：后端验证钉钉用户

**位置**：`server/src/dingtalk/dingtalk.controller.ts` - `handleCallback()`
**服务**：`server/src/dingtalk/dingtalk.service.ts` - `getUserInfoByCode()`

**流程**（四步验证）：

#### 步骤 1：获取 access_token
```typescript
// 使用 AppKey 和 AppSecret 获取企业应用的 access_token
GET https://oapi.dingtalk.com/gettoken?
  appkey={APP_KEY}&
  appsecret={APP_SECRET}
```

**返回**：
```json
{
  "errcode": 0,
  "access_token": "xxx",
  "expires_in": 7200
}
```

#### 步骤 2：通过 code 获取 userid
```typescript
// 使用 access_token 和 code 获取用户 userid
POST https://oapi.dingtalk.com/topapi/v2/user/getuserinfo
Body: { "code": "xxx" }
Params: { access_token: "xxx" }
```

**返回**：
```json
{
  "errcode": 0,
  "result": {
    "userid": "xxx"
  }
}
```

**验证**：
- 如果 `userid` 不存在，说明用户不是企业内成员

#### 步骤 3：通过 userid 获取用户详细信息
```typescript
// 使用 access_token 和 userid 获取用户详细信息
POST https://oapi.dingtalk.com/topapi/v2/user/get
Body: { "userid": "xxx" }
Params: { access_token: "xxx" }
```

**返回**：
```json
{
  "errcode": 0,
  "result": {
    "userid": "xxx",
    "name": "张三",
    "mobile": "13800138000",
    "active": true,  // 是否激活
    "is_admin": false,
    "is_boss": false
  }
}
```

#### 步骤 4：验证用户状态
```typescript
// 验证用户是否激活
if (!userDetail.active) {
  throw new BadRequestException('该用户账号未激活，不是有效的企业内成员');
}
```

**最终返回**：
```json
{
  "success": true,
  "userInfo": {
    "userId": "xxx",
    "name": "张三",
    "mobile": "13800138000",
    "active": true
  },
  "message": "钉钉验证成功，该用户是企业内成员"
}
```

---

### 阶段 6：用户输入用户名密码

**位置**：`web/src/app/login/page.tsx` - `handleDingTalkCallback()`

**流程**：
1. 后端验证成功后，前端显示提示："钉钉验证成功，请继续输入用户名和密码"
2. 将钉钉 `code` 存储到隐藏表单字段中
3. 用户输入用户名和密码

**代码**：
```typescript
if (result.success) {
  msgApi.success('钉钉验证成功，请继续输入用户名和密码');
  // 将钉钉code存储到表单中
  form.setFieldsValue({ dingTalkCode: code });
}
```

---

### 阶段 7：提交登录

**位置**：`web/src/app/login/page.tsx` - `onSubmit()`
**后端**：`server/src/acl/acl.service.ts` - `login()`

**流程**：
1. 用户点击"登录"按钮
2. 前端收集表单数据：
   - `username`（用户名）
   - `password`（密码）
   - `dingTalkCode`（钉钉授权码，如果有）
3. 发送 POST 请求到：`/api/acl/login`
4. 请求体：
   ```json
   {
     "username": "xxx",
     "password": "xxx",
     "dingTalkCode": "xxx"  // 可选
   }
   ```

---

### 阶段 8：后端验证登录

**位置**：`server/src/acl/acl.service.ts` - `login()`

**流程**（双重验证）：

#### 验证 1：钉钉身份验证（如果提供了 code）
```typescript
if (dingTalkCode) {
  // 再次验证钉钉身份（确保 code 未被篡改）
  const dingTalkUserInfo = await this.dingTalkService.getUserInfoByCode(dingTalkCode);
  console.log(`钉钉验证成功，用户: ${dingTalkUserInfo.name}`);
}
```

**注意**：这里会再次调用钉钉API验证code，确保：
- Code 是有效的
- 用户确实是企业内成员
- 用户账号是激活状态

#### 验证 2：用户名密码验证
```typescript
// 查询用户
const rows = await this.prisma.$queryRawUnsafe(
  `SELECT id, username, display_name, status, password, session_token 
   FROM sm_xitongkaifa.sys_users 
   WHERE username=? LIMIT 1`, 
  username
);

// 验证用户是否存在
if (!rows.length) throw new BadRequestException('用户不存在');

// 验证密码
if (String(u.password) !== String(password)) {
  throw new BadRequestException('密码错误');
}

// 验证账号状态
if (Number(u.status) !== 1) {
  throw new BadRequestException('账号已禁用');
}
```

#### 生成会话Token
```typescript
// 生成新的 session_token（单点登录：覆盖旧token）
const token = randomBytes(24).toString('hex');

// 更新用户信息
await this.prisma.$executeRawUnsafe(
  `UPDATE sm_xitongkaifa.sys_users 
   SET session_token=?, last_login_time=?, last_login_device=? 
   WHERE id=?`,
  token, loginTime, device, userId
);
```

**返回**：
```json
{
  "id": 1,
  "username": "xxx",
  "display_name": "xxx",
  "token": "xxx"
}
```

---

### 阶段 9：前端保存登录状态

**位置**：`web/src/app/login/page.tsx` - `onSubmit()`

**流程**：
1. 收到登录成功响应
2. 保存用户信息到 localStorage：
   ```typescript
   localStorage.setItem('userId', String(u.id));
   localStorage.setItem('displayName', u.display_name || '');
   localStorage.setItem('sessionToken', u.token || '');
   ```
3. 跳转到首页：`location.href = '/home'`

---

## 🔐 安全机制

### 1. 双重验证
- **第一次验证**：钉钉回调时验证用户身份
- **第二次验证**：提交登录时再次验证钉钉身份 + 用户名密码

### 2. Code 一次性使用
- 钉钉的 `code` 只能使用一次
- 如果 code 已被使用，再次使用会失败

### 3. 单点登录（SSO）
- 每次登录生成新的 `session_token`
- 旧设备的 token 会失效

### 4. 企业内成员验证
- 验证用户是否有 `userid`（企业内成员才有）
- 验证用户账号是否激活（`active: true`）

### 5. 强制钉钉登录（可选）
- 如果 `REQUIRE_DINGTALK_LOGIN=true`，则必须使用钉钉登录
- 否则，用户可以选择普通登录或钉钉登录

---

## 📊 数据流图

```
┌─────────┐         ┌──────────┐         ┌──────────┐
│  用户    │         │   前端    │         │   后端    │
└────┬────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │ 1. 点击钉钉登录     │                    │
     ├───────────────────>│                    │
     │                    │ 2. GET /auth-url   │
     │                    ├───────────────────>│
     │                    │                    │ 3. 生成授权URL
     │                    │                    │
     │                    │ 4. 返回授权URL     │
     │                    │<───────────────────┤
     │                    │                    │
     │ 5. 跳转到钉钉       │                    │
     │<───────────────────┤                    │
     │                    │                    │
     │ 6. 在钉钉授权       │                    │
     │    (钉钉服务器)     │                    │
     │                    │                    │
     │ 7. 回调带code       │                    │
     ├───────────────────>│                    │
     │                    │ 8. POST /callback  │
     │                    │    {code: "xxx"}   │
     │                    ├───────────────────>│
     │                    │                    │ 9. 验证钉钉用户
     │                    │                    │    (调用钉钉API)
     │                    │                    │
     │                    │ 10. 返回验证结果    │
     │                    │<───────────────────┤
     │                    │                    │
     │ 11. 输入用户名密码  │                    │
     ├───────────────────>│                    │
     │                    │ 12. POST /login    │
     │                    │    {username,     │
     │                    │     password,     │
     │                    │     dingTalkCode} │
     │                    ├───────────────────>│
     │                    │                    │ 13. 再次验证钉钉
     │                    │                    │     + 验证用户名密码
     │                    │                    │
     │                    │ 14. 返回token      │
     │                    │<───────────────────┤
     │                    │                    │
     │ 15. 跳转到首页      │                    │
     │<───────────────────┤                    │
```

---

## 🛠️ 关键配置

### 后端环境变量（`server/.env`）
```env
DINGTALK_APP_KEY=ding1u4heyzkoctmkvc5
DINGTALK_APP_SECRET=xxx
DINGTALK_CORP_ID=ding9718d9b7e961b1c7a1320dcb25e91351
DINGTALK_REDIRECT_URI=http://47.106.87.166/login
REQUIRE_DINGTALK_LOGIN=false
```

### 钉钉开放平台配置
- **OAuth2.0回调地址**：`http://47.106.87.166/login`
- **服务器出口IP**：`47.106.87.166`
- **应用状态**：已发布上线
- **权限**：已申请并授权

---

## ⚠️ 常见问题

### 1. "url参数不合法"
- **原因**：回调地址或安全域名配置不匹配
- **解决**：确保钉钉开放平台的回调地址与 `DINGTALK_REDIRECT_URI` 完全一致

### 2. "该用户不是企业内成员"
- **原因**：用户不在钉钉企业通讯录中，或账号未激活
- **解决**：确保用户在钉钉企业通讯录中，且账号状态为激活

### 3. "获取用户信息失败"
- **原因**：AppKey/AppSecret 配置错误，或权限未授权
- **解决**：检查环境变量配置，确保权限已授权

### 4. Code 已过期
- **原因**：钉钉的 code 有时效性（通常几分钟）
- **解决**：用户需要重新点击"钉钉企业登录"按钮

---

## 📚 相关文件

- **前端登录页**：`web/src/app/login/page.tsx`
- **后端控制器**：`server/src/dingtalk/dingtalk.controller.ts`
- **后端服务**：`server/src/dingtalk/dingtalk.service.ts`
- **登录服务**：`server/src/acl/acl.service.ts`
- **API客户端**：`web/src/lib/api.ts`

---

## 🔗 参考文档

- [钉钉开放平台文档](https://open.dingtalk.com/document/)
- [钉钉OAuth2.0认证](https://open.dingtalk.com/document/orgapp-server/obtain-identity-credentials)
- [钉钉企业内应用开发指南](https://open.dingtalk.com/document/orgapp/enterprise-internal-application-development-guide)

