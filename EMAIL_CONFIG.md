# 邮件服务配置说明

## 功能说明

在 `home/store-rejection` 路径下的每行数据都添加了"驳回差异单"按钮。点击该按钮后，系统会将当前行的数据以 JSON 格式发送邮件到指定邮箱。

## 环境变量配置

在 `server/.env` 文件中添加以下配置：

```env
# ============================================
# 邮件服务配置
# ============================================

# SMTP 服务器地址（例如：smtp.qq.com, smtp.gmail.com, smtp.163.com）
SMTP_HOST=smtp.qq.com

# SMTP 端口（通常为 587 或 465）
SMTP_PORT=587

# SMTP 用户名（通常是邮箱地址）
SMTP_USER=your-email@example.com

# SMTP 密码（QQ邮箱需要使用授权码，不是登录密码）
SMTP_PASS=your-email-password-or-auth-code

# 发件人邮箱地址（可选，默认使用 SMTP_USER）
SMTP_FROM=your-email@example.com

# 驳回差异单默认收件人邮箱（可选，如果未在请求中提供邮箱，则使用此配置）
STORE_REJECTION_EMAIL=recipient@example.com
```

## 常见邮箱配置示例

### QQ 邮箱
```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-qq@qq.com
SMTP_PASS=your-auth-code  # 需要在QQ邮箱设置中生成授权码
SMTP_FROM=your-qq@qq.com
```

### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # 需要使用应用专用密码
SMTP_FROM=your-email@gmail.com
```

### 163 邮箱
```env
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=your-email@163.com
SMTP_PASS=your-auth-code  # 需要在163邮箱设置中开启SMTP并生成授权码
SMTP_FROM=your-email@163.com
```

## 使用说明

1. **配置环境变量**：按照上述说明配置邮件服务环境变量

2. **重启服务**：配置完成后需要重启后端服务使配置生效

3. **使用功能**：
   - 访问 `home/store-rejection` 页面
   - 在每行数据的"操作"列中点击"驳回差异单"按钮
   - 系统会将该行数据以 JSON 格式发送到配置的邮箱

4. **邮件内容**：
   - 邮件主题：`驳回差异单 - {采购单号} - {商品名称}`
   - 邮件正文：包含该行数据的完整 JSON 格式内容

## 注意事项

1. **QQ邮箱**：必须使用授权码，不能使用登录密码。授权码获取方式：
   - 登录QQ邮箱 → 设置 → 账户 → 开启SMTP服务 → 生成授权码

2. **Gmail**：需要使用应用专用密码，不能使用普通密码。获取方式：
   - Google账户 → 安全性 → 两步验证 → 应用专用密码

3. **安全性**：`.env` 文件包含敏感信息，不要提交到代码仓库

4. **测试**：建议先使用测试邮箱验证配置是否正确

## 故障排查

如果邮件发送失败，请检查：

1. 环境变量是否正确配置
2. SMTP 服务器地址和端口是否正确
3. 用户名和密码（授权码）是否正确
4. 网络连接是否正常
5. 查看后端日志中的错误信息

