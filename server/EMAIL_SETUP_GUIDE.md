# 邮件服务配置指南

## 📝 配置步骤

### 1. 打开配置文件

在 `server` 目录下找到 `.env` 文件（如果不存在，请创建它）

### 2. 添加邮件配置

在 `.env` 文件末尾添加以下配置：

```env
# ============================================
# 邮件服务配置
# ============================================

# SMTP 服务器地址
SMTP_HOST=smtp.qq.com

# SMTP 端口（587 或 465）
SMTP_PORT=587

# SMTP 用户名（你的邮箱地址）
SMTP_USER=your-email@qq.com

# SMTP 密码（QQ邮箱需要使用授权码，不是登录密码）
SMTP_PASS=your-auth-code

# 发件人邮箱（可选，默认使用 SMTP_USER）
SMTP_FROM=your-email@qq.com

# 驳回差异单默认收件人邮箱（必填）
STORE_REJECTION_EMAIL=recipient@example.com
```

## 📧 常见邮箱配置示例

### QQ 邮箱配置

1. **获取授权码**：
   - 登录 QQ 邮箱
   - 点击"设置" → "账户"
   - 找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
   - 开启"POP3/SMTP服务"或"IMAP/SMTP服务"
   - 点击"生成授权码"，按提示发送短信后获得授权码

2. **配置示例**：
```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=123456789@qq.com
SMTP_PASS=abcdefghijklmnop  # 这里填写授权码，不是QQ密码
SMTP_FROM=123456789@qq.com
STORE_REJECTION_EMAIL=recipient@example.com  # 收件人邮箱
```

### 163 邮箱配置

1. **获取授权码**：
   - 登录 163 邮箱
   - 点击"设置" → "POP3/SMTP/IMAP"
   - 开启"POP3/SMTP服务"或"IMAP/SMTP服务"
   - 点击"生成授权码"，按提示操作

2. **配置示例**：
```env
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=your-email@163.com
SMTP_PASS=your-auth-code  # 授权码
SMTP_FROM=your-email@163.com
STORE_REJECTION_EMAIL=recipient@example.com
```

### Gmail 配置

1. **获取应用专用密码**：
   - 登录 Google 账户
   - 进入"安全性" → "两步验证"
   - 找到"应用专用密码"
   - 生成新的应用专用密码

2. **配置示例**：
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # 应用专用密码
SMTP_FROM=your-email@gmail.com
STORE_REJECTION_EMAIL=recipient@example.com
```

### 企业邮箱配置（以腾讯企业邮箱为例）

```env
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
SMTP_FROM=your-email@company.com
STORE_REJECTION_EMAIL=recipient@example.com
```

## ✅ 配置完成后

1. **保存 `.env` 文件**

2. **重启后端服务**：
   ```bash
   # 如果使用 npm run start:dev，按 Ctrl+C 停止后重新启动
   # 或者重启你的开发服务器
   ```

3. **测试功能**：
   - 访问 `home/store-rejection` 页面
   - 点击任意一行的"驳回差异单"按钮
   - 检查收件邮箱是否收到邮件

## ⚠️ 重要提示

1. **不要使用登录密码**：QQ邮箱、163邮箱等必须使用授权码，不能使用登录密码
2. **保护隐私**：`.env` 文件包含敏感信息，不要提交到 Git 仓库
3. **测试建议**：先用测试邮箱验证配置是否正确

## 🔍 故障排查

如果邮件发送失败，请检查：

1. ✅ 环境变量是否正确配置
2. ✅ SMTP 服务器地址和端口是否正确
3. ✅ 授权码/密码是否正确（注意：不是登录密码）
4. ✅ 网络连接是否正常
5. ✅ 查看后端控制台的错误日志

## 📞 需要帮助？

如果遇到问题，请查看后端控制台的错误信息，通常会有详细的错误提示。


