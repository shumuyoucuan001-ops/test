# 多邮箱账号快速配置指南

## ✅ 是的，直接在 SMTP_ACCOUNTS 里添加更多账号即可！

## 配置格式

在 `server/.env` 文件中的 `SMTP_ACCOUNTS` 是一个 JSON 数组，你可以添加任意数量的账号。

## 示例

### 2个账号
```env
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"}]'
```

### 3个账号
```env
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"},{"user":"email3@qq.com","pass":"auth3","from":"email3@qq.com"}]'
```

### 5个账号
```env
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"},{"user":"email3@qq.com","pass":"auth3","from":"email3@qq.com"},{"user":"email4@qq.com","pass":"auth4","from":"email4@qq.com"},{"user":"email5@qq.com","pass":"auth5","from":"email5@qq.com"}]'
```

## 添加账号的步骤

1. **打开 `server/.env` 文件**

2. **找到 `SMTP_ACCOUNTS` 配置**

3. **在 JSON 数组中添加新账号**：
   - 在最后一个账号后面添加逗号 `,`
   - 添加新的账号对象：`{"user":"新邮箱@qq.com","pass":"新授权码","from":"新邮箱@qq.com"}`

4. **保存文件**

5. **重启后端服务**

## 完整示例

假设你已经有2个账号，想添加第3个：

**之前（2个账号）**：
```env
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"}]'
```

**之后（3个账号）**：
```env
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"},{"user":"email3@qq.com","pass":"auth3","from":"email3@qq.com"}]'
```

## 注意事项

1. **JSON 格式要正确**：
   - 每个账号对象用 `{}` 包裹
   - 账号之间用逗号 `,` 分隔
   - 整个数组用 `[]` 包裹
   - 整个 JSON 字符串用单引号 `'` 包裹

2. **字段说明**：
   - `user`：邮箱地址（必填）
   - `pass`：授权码（必填，16位，不含空格）
   - `from`：发件人（可选，默认使用 `user` 的值）

3. **授权码要求**：
   - 每个账号的授权码必须是16位
   - 不能包含空格
   - 必须是授权码，不是登录密码

4. **重启服务**：
   - 修改配置后必须重启后端服务
   - 重启后查看日志确认所有账号都初始化成功

## 验证配置

重启服务后，查看后端控制台日志，应该能看到：

```
[EmailService] 检测到 3 个邮件账号配置
[EmailService] 账号 1 初始化：email1@qq.com
[EmailService] 账号 2 初始化：email2@qq.com
[EmailService] 账号 3 初始化：email3@qq.com
[EmailService] 邮件服务初始化完成，共 3 个账号
```

## 工作原理

系统会按顺序轮询使用所有账号：
- 第1次发送：账号1
- 第2次发送：账号2
- 第3次发送：账号3
- 第4次发送：账号1（循环）
- 如果某个账号失败，自动尝试下一个

## 建议

- **2-3个账号**：适合一般使用
- **4-5个账号**：适合发送频率较高的场景
- **不建议太多**：超过10个可能影响性能

## 常见错误

### ❌ 错误1：缺少逗号
```env
# 错误：账号之间缺少逗号
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1"},{"user":"email2@qq.com","pass":"auth2"}]'
```

### ✅ 正确：账号之间有逗号
```env
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"}]'
```

### ❌ 错误2：JSON格式错误
```env
# 错误：使用了双引号包裹整个JSON
SMTP_ACCOUNTS="[{\"user\":\"email1@qq.com\",\"pass\":\"auth1\"}]"
```

### ✅ 正确：使用单引号包裹
```env
SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"}]'
```

## 快速复制模板

如果你有多个账号，可以复制这个模板，然后替换邮箱和授权码：

```env
SMTP_ACCOUNTS='[
  {"user":"账号1@qq.com","pass":"授权码1","from":"账号1@qq.com"},
  {"user":"账号2@qq.com","pass":"授权码2","from":"账号2@qq.com"},
  {"user":"账号3@qq.com","pass":"授权码3","from":"账号3@qq.com"}
]'
```

**注意**：实际使用时，JSON 可以写在一行，也可以换行（更易读）。

