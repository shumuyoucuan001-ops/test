# 安装 Playwright 系统依赖

从您的截图可以看到，Playwright 已经安装，但缺少运行 Chromium 所需的系统库。

## 步骤 1：安装系统依赖

请在宝塔终端执行以下命令（**复制全部内容一起执行**）：

```bash
cd /www/wwwroot/sm-api-v2

# 使用npx安装Playwright的系统依赖
npx playwright install-deps chromium
```

这个命令会自动安装所有需要的系统库，包括：

- libatk1.0-0
- libatk-bridge2.0-0
- libatspi2.0-0
- libxcomposite1
- libxdamage1
- libxfixes3
- libxrandr2
- libgbm1
- libasound2
- 等等...

## 步骤 2：验证安装

安装完成后，执行以下命令验证：

```bash
node -e "const {chromium} = require('playwright'); chromium.launch().then(() => console.log('✅ Playwright OK')).catch(e => console.log('❌ Error:', e.message))"
```

如果看到 `✅ Playwright OK`，说明安装成功！

## 步骤 3：重启服务

```bash
pm2 restart sm-api-v2
```

## 步骤 4：测试打印

在移动设备上测试打印功能，应该可以看到正确的标签内容了。

---

## 常见问题

### Q: 如果 `npx playwright install-deps` 失败怎么办？

A: 可以尝试手动安装依赖：

```bash
apt-get update

apt-get install -y \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libatspi2.0-0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxkbcommon0 \
  libxshmfence1 \
  libcairo2 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 \
  libgtk-3-0 \
  libxcursor1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libx11-6 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xvfb
```

### Q: 安装后还是报错？

A: 请提供完整的错误信息，我会帮您诊断。

---

**请现在在宝塔终端执行步骤 1 的命令，然后告诉我结果！** 🚀

