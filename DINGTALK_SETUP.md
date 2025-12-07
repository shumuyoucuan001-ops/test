# 钉钉登录配置指南

## 📋 概述

本项目已集成钉钉企业内成员登录验证功能。只有钉钉企业内的成员才能通过钉钉登录系统。

## 🔧 配置步骤

### 1. 注册钉钉开放平台应用

1. 访问 [钉钉开放平台](https://open.dingtalk.com/)
2. 登录后进入"应用开发" -> "企业内部开发" -> "H5微应用"
3. 创建应用，获取以下信息：
   - **AppKey** (应用Key)
   - **AppSecret** (应用密钥)
   - **CorpId** (企业ID)

### 2. 配置应用回调地址

在钉钉开放平台的应用设置中，配置**回调地址**（Redirect URI）：
- 开发环境：`http://localhost:3000/login`
- 生产环境：`https://your-domain.com/login`

### 3. 配置环境变量

在 `server` 目录下创建或修改 `.env` 文件，添加以下配置：

```env
# 钉钉配置
DINGTALK_APP_KEY=your_app_key_here
DINGTALK_APP_SECRET=your_app_secret_here
DINGTALK_CORP_ID=your_corp_id_here
DINGTALK_REDIRECT_URI=http://localhost:3000/login

# 是否强制要求钉钉登录（true/false）
# 如果设置为true，则必须使用钉钉登录，不能使用普通用户名密码登录
REQUIRE_DINGTALK_LOGIN=false
```

### 4. 重启服务

配置完成后，重启后端服务：

```bash
cd server
npm start
```

## 🚀 使用流程

### 用户登录流程

1. 用户访问登录页面
2. 点击"钉钉企业登录"按钮
3. 跳转到钉钉授权页面
4. 用户扫码或确认授权
5. 钉钉回调到系统，返回授权码（code）
6. 系统验证用户是否为钉钉企业内成员
7. 验证通过后，用户输入用户名和密码完成登录

### 开发测试

如果 `REQUIRE_DINGTALK_LOGIN=false`，用户可以选择：
- 使用钉钉登录（推荐，会验证企业内成员身份）
- 使用普通用户名密码登录（不验证钉钉身份）

如果 `REQUIRE_DINGTALK_LOGIN=true`，则必须使用钉钉登录。

## 📝 技术说明

### 后端实现

- **DingTalkService** (`server/src/dingtalk/dingtalk.service.ts`)
  - 类似Java的 `@Service` 注解的服务类
  - 负责钉钉OAuth2.0认证流程
  - 验证用户是否为企业内成员

- **DingTalkController** (`server/src/dingtalk/dingtalk.controller.ts`)
  - 类似Java的 `@RestController` 注解的控制器
  - 提供钉钉相关API接口

- **AclService** (`server/src/acl/acl.service.ts`)
  - 登录方法已集成钉钉验证
  - 如果提供了钉钉授权码，会先验证钉钉身份

### 前端实现

- **登录页面** (`web/src/app/login/page.tsx`)
  - 添加了"钉钉企业登录"按钮
  - 自动处理钉钉回调
  - 将钉钉授权码传递给后端验证

## 🔍 验证逻辑

系统会验证以下内容：
1. ✅ 用户是否为钉钉企业内成员（通过userid判断）
2. ✅ 用户账号是否激活（active状态）
3. ✅ 用户是否具有有效的用户名和密码

只有同时满足以上条件，用户才能成功登录。

## ⚠️ 注意事项

1. **回调地址必须与钉钉开放平台配置一致**
2. **AppKey和AppSecret需要妥善保管，不要泄露**
3. **生产环境请使用HTTPS**
4. **建议设置 `REQUIRE_DINGTALK_LOGIN=true` 强制使用钉钉登录**

## 🐛 常见问题

### Q: 提示"钉钉配置不完整"
A: 检查环境变量是否正确配置，确保 `DINGTALK_APP_KEY`、`DINGTALK_APP_SECRET`、`DINGTALK_CORP_ID` 都已设置。

### Q: 提示"该用户不是企业内成员"
A: 确保用户在钉钉企业通讯录中，且账号状态为激活状态。

### Q: 回调地址不匹配
A: 检查钉钉开放平台中配置的回调地址是否与 `DINGTALK_REDIRECT_URI` 一致。

## 📚 相关文档

- [钉钉开放平台文档](https://open.dingtalk.com/document/)
- [钉钉OAuth2.0认证](https://open.dingtalk.com/document/orgapp-server/obtain-identity-credentials)

