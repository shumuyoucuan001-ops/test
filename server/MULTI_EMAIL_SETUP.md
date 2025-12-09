# 多邮箱账号交替发送配置指南

## 功能说明

现在支持配置多个邮箱账号，系统会自动轮询使用这些账号发送邮件。这样可以：
- ✅ 避免单个账号的频率限制
- ✅ 提高邮件发送成功率
- ✅ 分散发送压力

## 配置方式

### 方式1：单个账号（向后兼容）

如果你只有一个邮箱账号，继续使用原来的配置方式：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-email@qq.com
SMTP_PASS=your-auth-code
SMTP_FROM=your-email@qq.com
STORE_REJECTION_EMAIL=recipient@example.com
```

### 方式2：多个账号（推荐）

如果你有多个邮箱账号，可以使用 `SMTP_ACCOUNTS` 配置：

```env
# SMTP服务器配置（所有账号共用）
SMTP_HOST=smtp.qq.com
SMTP_PORT=587

# 多个账号配置（JSON格式）
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth-code-1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth-code-2","from":"email2@qq.com"}]'

# 收件人邮箱
STORE_REJECTION_EMAIL=recipient@example.com
```

## 配置示例

### 两个QQ邮箱账号交替发送

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_ACCOUNTS='[{"user":"1487462362@qq.com","pass":"abcdefghijklmnop","from":"1487462362@qq.com"},{"user":"1053668210@qq.com","pass":"qwertyuiopasdfgh","from":"1053668210@qq.com"}]'
STORE_REJECTION_EMAIL=recipient@example.com
```

### 三个邮箱账号交替发送

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"},{"user":"email3@163.com","pass":"auth3","from":"email3@163.com"}]'
STORE_REJECTION_EMAIL=recipient@example.com
```

## 工作原理

1. **轮询机制**：系统会按顺序使用每个账号发送邮件
2. **自动切换**：如果当前账号发送失败，会自动尝试下一个账号
3. **负载均衡**：每次发送都会切换到下一个账号，实现负载均衡

## 配置步骤

### 步骤1：准备多个邮箱账号

确保每个邮箱账号都：
- ✅ 已开启SMTP服务
- ✅ 已生成授权码
- ✅ 授权码是16位（QQ邮箱）

### 步骤2：配置 .env 文件

在 `server/.env` 文件中添加配置：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_ACCOUNTS='[{"user":"账号1@qq.com","pass":"授权码1","from":"账号1@qq.com"},{"user":"账号2@qq.com","pass":"授权码2","from":"账号2@qq.com"}]'
STORE_REJECTION_EMAIL=收件人@example.com
```

**重要提示**：
- JSON 字符串必须用单引号包裹
- 每个账号的 `user`、`pass`、`from` 都要正确填写
- `from` 可以省略，默认使用 `user` 的值

### 步骤3：重启后端服务

配置完成后，必须重启后端服务：

```bash
# 停止当前服务（Ctrl+C）
# 重新启动
npm run start:dev
```

### 步骤4：验证配置

启动服务时，应该能看到类似这样的日志：

```
[EmailService] 检测到 2 个邮件账号配置
[EmailService] 账号 1 初始化：email1@qq.com
[EmailService] 账号 2 初始化：email2@qq.com
[EmailService] 邮件服务初始化完成，共 2 个账号
```

## 使用效果

配置多个账号后，每次发送邮件时：

1. **第一次发送**：使用账号1
2. **第二次发送**：使用账号2
3. **第三次发送**：使用账号1（循环）
4. **如果账号1失败**：自动切换到账号2重试

这样可以有效避免单个账号的频率限制。

## 注意事项

1. **授权码安全**：`.env` 文件包含敏感信息，不要提交到Git仓库
2. **授权码格式**：确保每个授权码都是16位，不包含空格
3. **账号数量**：建议配置2-3个账号，太多可能影响性能
4. **账号类型**：可以混合使用不同邮箱服务商（QQ、163、Gmail等），只要SMTP配置相同

## 故障排查

### 问题1：JSON解析失败

如果看到 `SMTP_ACCOUNTS 解析失败`，请检查：
- JSON格式是否正确
- 是否使用了单引号包裹JSON字符串
- 是否有语法错误（缺少逗号、引号等）

### 问题2：某个账号一直失败

如果某个账号一直失败，系统会自动尝试下一个账号。建议：
- 检查该账号的授权码是否正确
- 确认该账号的SMTP服务是否开启
- 可以暂时从配置中移除该账号

### 问题3：所有账号都失败

如果所有账号都失败，请检查：
- SMTP_HOST 和 SMTP_PORT 是否正确
- 网络连接是否正常
- 所有账号的授权码是否都正确

## 配置优先级

1. **如果配置了 SMTP_ACCOUNTS**：使用多账号模式
2. **如果只配置了 SMTP_USER 和 SMTP_PASS**：使用单账号模式（向后兼容）
3. **如果都没有配置**：邮件功能不可用

## 示例：完整配置

```env
# ============================================
# 邮件服务配置 - 多账号模式
# ============================================

# SMTP服务器配置（所有账号共用）
SMTP_HOST=smtp.qq.com
SMTP_PORT=587

# 多个账号配置（JSON格式，用单引号包裹）
SMTP_ACCOUNTS='[{"user":"1487462362@qq.com","pass":"abcdefghijklmnop","from":"1487462362@qq.com"},{"user":"1053668210@qq.com","pass":"qwertyuiopasdfgh","from":"1053668210@qq.com"}]'

# 收件人邮箱
STORE_REJECTION_EMAIL=recipient@example.com
```

配置完成后，重启服务即可使用多账号交替发送功能！

