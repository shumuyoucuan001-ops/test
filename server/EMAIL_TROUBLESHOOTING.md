# 邮件发送故障排查指南

## 🔍 当前问题

从测试结果看，后端路由已经正常工作，但邮件发送失败，错误信息：
```
Invalid login: 535 Login fail. Account is abnormal, service is not open, 
password is incorrect, login frequency limited, or system is busy.
```

这说明 SMTP 登录失败，可能的原因：

## ✅ 检查清单

### 1. 检查 .env 文件配置

确保 `server/.env` 文件中包含以下配置，并且**值都是正确的**：

```env
# SMTP 服务器地址
SMTP_HOST=smtp.qq.com

# SMTP 端口（QQ邮箱使用 587，163邮箱使用 465）
SMTP_PORT=587

# SMTP 用户名（完整的邮箱地址）
SMTP_USER=your-email@qq.com

# SMTP 密码（⚠️ 重要：QQ邮箱必须使用授权码，不是登录密码！）
SMTP_PASS=your-auth-code

# 发件人邮箱（可选，默认使用 SMTP_USER）
SMTP_FROM=your-email@qq.com

# 收件人邮箱（必填）
STORE_REJECTION_EMAIL=recipient@example.com
```

### 2. 常见问题

#### ❌ 问题1：使用了登录密码而不是授权码
- **QQ邮箱**：必须使用授权码，不能使用QQ密码
- **163邮箱**：必须使用授权码，不能使用登录密码
- **Gmail**：必须使用应用专用密码

**解决方法**：
- QQ邮箱：登录QQ邮箱 → 设置 → 账户 → 开启SMTP服务 → 生成授权码
- 163邮箱：登录163邮箱 → 设置 → POP3/SMTP/IMAP → 开启服务 → 生成授权码

#### ❌ 问题2：授权码包含空格或特殊字符
- 复制授权码时可能包含前后空格
- 确保授权码前后没有空格

**解决方法**：重新复制授权码，确保没有多余空格

#### ❌ 问题3：SMTP服务未开启
- QQ邮箱需要手动开启SMTP服务
- 163邮箱需要手动开启SMTP服务

**解决方法**：
- QQ邮箱：设置 → 账户 → 开启"POP3/SMTP服务"
- 163邮箱：设置 → POP3/SMTP/IMAP → 开启"POP3/SMTP服务"

#### ❌ 问题4：端口配置错误
- QQ邮箱：使用 587（推荐）或 465
- 163邮箱：使用 465（推荐）或 587
- Gmail：使用 587

**解决方法**：根据你的邮箱类型选择正确的端口

#### ❌ 问题5：邮箱地址格式错误
- 确保邮箱地址完整，包含 @ 符号
- 确保没有多余的空格

**解决方法**：检查邮箱地址格式，例如：`123456789@qq.com`

### 3. 验证配置

#### 方法1：检查环境变量是否加载

在后端服务启动时，查看控制台日志，应该能看到邮件服务初始化的信息。

#### 方法2：测试邮件发送

配置完成后，重启后端服务，然后：
1. 访问 `home/store-rejection` 页面
2. 点击"驳回差异单"按钮
3. 查看后端控制台的错误信息

#### 方法3：使用测试邮箱

建议先用一个测试邮箱（如自己的另一个邮箱）作为收件人，验证配置是否正确。

## 🔧 快速修复步骤

1. **确认授权码**：
   - 登录你的邮箱
   - 按照上述步骤生成新的授权码
   - 复制授权码（注意不要包含空格）

2. **更新 .env 文件**：
   ```env
   SMTP_HOST=smtp.qq.com
   SMTP_PORT=587
   SMTP_USER=你的完整邮箱地址
   SMTP_PASS=新生成的授权码（没有空格）
   SMTP_FROM=你的完整邮箱地址
   STORE_REJECTION_EMAIL=收件人邮箱地址
   ```

3. **重启后端服务**：
   - 停止当前运行的后端服务
   - 重新启动后端服务
   - 确保环境变量被正确加载

4. **测试**：
   - 访问页面，点击"驳回差异单"按钮
   - 检查是否收到邮件

## 📝 配置示例（QQ邮箱）

```env
# QQ邮箱配置示例
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=123456789@qq.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM=123456789@qq.com
STORE_REJECTION_EMAIL=recipient@example.com
```

**重要提示**：
- `SMTP_PASS` 必须是授权码，不是QQ密码
- 授权码通常是16位字母数字组合
- 如果授权码包含空格，需要去掉空格

## 🆘 仍然无法解决？

如果按照上述步骤仍然无法解决问题，请：

1. 检查后端控制台的完整错误信息
2. 确认邮箱服务商是否支持SMTP（某些企业邮箱可能需要特殊配置）
3. 尝试使用其他邮箱服务商（如163邮箱）进行测试
4. 检查网络连接是否正常


