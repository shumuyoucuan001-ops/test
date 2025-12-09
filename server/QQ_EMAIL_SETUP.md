# QQ邮箱SMTP配置详细步骤

## ⚠️ 当前错误

如果你看到以下错误：
```
Invalid login: 535 Login fail. Account is abnormal, service is not open, 
password is incorrect, login frequency limited, or system is busy.
```

这说明QQ邮箱SMTP登录失败，**99%的情况是因为使用了QQ密码而不是授权码**。

## ✅ 正确配置步骤

### 第一步：获取QQ邮箱授权码

1. **登录QQ邮箱**
   - 打开 https://mail.qq.com
   - 使用你的QQ账号登录

2. **进入设置页面**
   - 点击右上角的"设置"按钮
   - 选择"账户"选项卡

3. **开启SMTP服务**
   - 向下滚动找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
   - 找到"POP3/SMTP服务"或"IMAP/SMTP服务"
   - 点击"开启"按钮

4. **生成授权码**
   - 开启服务后，会提示你发送短信验证
   - 按照提示发送短信到指定号码
   - 发送成功后，会显示一个**16位的授权码**
   - **重要**：这个授权码只显示一次，请立即复制保存

### 第二步：配置 .env 文件

在 `server/.env` 文件中添加或修改以下配置：

```env
# QQ邮箱SMTP配置
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=你的QQ号@qq.com
SMTP_PASS=刚才复制的16位授权码
SMTP_FROM=你的QQ号@qq.com
STORE_REJECTION_EMAIL=收件人邮箱@example.com
```

**示例**：
```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=123456789@qq.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM=123456789@qq.com
STORE_REJECTION_EMAIL=recipient@example.com
```

### 第三步：重要注意事项

1. **⚠️ 必须使用授权码，不能使用QQ密码**
   - `SMTP_PASS` 必须是刚才生成的16位授权码
   - 不能使用你的QQ登录密码

2. **⚠️ 授权码不要包含空格**
   - 复制授权码时，确保前后没有空格
   - 如果授权码中间有空格，需要去掉

3. **⚠️ 邮箱地址要完整**
   - `SMTP_USER` 必须是完整的邮箱地址，例如：`123456789@qq.com`
   - 不能只写QQ号，必须包含 `@qq.com`

4. **⚠️ 端口配置**
   - QQ邮箱推荐使用 `587` 端口
   - 也可以使用 `465` 端口（需要设置 `secure: true`）

### 第四步：重启后端服务

配置完成后，**必须重启后端服务**才能生效：

```bash
# 停止当前运行的后端服务（按 Ctrl+C）
# 然后重新启动
npm run start:dev
```

### 第五步：测试

1. 访问 `home/store-rejection` 页面
2. 点击任意一行的"驳回差异单"按钮
3. 如果配置正确，应该会显示"邮件发送成功"
4. 检查收件邮箱是否收到邮件

## 🔍 常见问题

### Q1: 授权码在哪里找？
A: 授权码在QQ邮箱的"设置 → 账户 → POP3/SMTP服务"页面，开启服务后会显示。

### Q2: 授权码忘记了怎么办？
A: 可以重新生成授权码：
- 进入QQ邮箱设置
- 关闭SMTP服务
- 重新开启SMTP服务
- 会生成新的授权码

### Q3: 还是提示登录失败？
A: 请检查：
1. 授权码是否正确（16位，没有空格）
2. 邮箱地址是否完整（包含@qq.com）
3. SMTP服务是否已开启
4. 是否重启了后端服务

### Q4: 可以使用其他邮箱吗？
A: 可以，支持163邮箱、Gmail等，配置方式类似，只是SMTP服务器地址不同。

## 📝 配置检查清单

在配置完成后，请确认：

- [ ] 已开启QQ邮箱的SMTP服务
- [ ] 已生成并复制了16位授权码
- [ ] `.env` 文件中的 `SMTP_PASS` 填写的是授权码（不是QQ密码）
- [ ] `SMTP_USER` 填写的是完整邮箱地址（例如：123456789@qq.com）
- [ ] 授权码前后没有空格
- [ ] 已重启后端服务
- [ ] 已测试发送邮件功能

## 🆘 仍然无法解决？

如果按照以上步骤仍然无法解决问题，请：

1. 检查后端控制台的完整错误日志
2. 确认授权码是否过期（可以重新生成）
3. 尝试使用其他邮箱服务商（如163邮箱）进行测试
4. 检查网络连接是否正常


