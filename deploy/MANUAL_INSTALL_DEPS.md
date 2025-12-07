# 手动安装 Playwright 依赖（Alibaba Cloud Linux）

由于您的系统是 Alibaba Cloud Linux，需要手动安装依赖。

## 步骤 1：使用 yum 安装系统依赖

请在宝塔终端执行以下命令（**复制全部内容一起执行**）：

```bash
yum install -y \
  alsa-lib \
  atk \
  at-spi2-atk \
  cups-libs \
  gtk3 \
  ipa-gothic-fonts \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi \
  xorg-x11-fonts-cyrillic \
  xorg-x11-fonts-misc \
  xorg-x11-fonts-Type1 \
  xorg-x11-utils \
  liberation-fonts \
  nss \
  nspr \
  mesa-libgbm
```

## 步骤 2：验证 Playwright

```bash
cd /www/wwwroot/sm-api-v2
node -e "const {chromium} = require('playwright'); chromium.launch().then(() => console.log('✅ Playwright OK')).catch(e => console.log('❌ Error:', e.message))"
```

## 步骤 3：在宝塔面板重启服务

1. 打开宝塔面板
2. 找到 "网站" 或 "Node 项目"
3. 找到 `sm-api-v2` 项目
4. 点击 "重启" 按钮

## 步骤 4：测试打印

在移动设备上测试打印功能。

---

## 如果还是失败

请执行以下命令获取详细错误日志：

```bash
cd /www/wwwroot/sm-api-v2
node -e "const {chromium} = require('playwright'); chromium.launch({headless:true}).then(async (browser) => { console.log('Browser launched'); const page = await browser.newPage(); console.log('Page created'); await page.setContent('<h1>Test</h1>'); console.log('Content set'); const screenshot = await page.screenshot(); console.log('Screenshot taken:', screenshot.length, 'bytes'); await browser.close(); console.log('✅ All OK'); }).catch(e => { console.log('❌ Error:', e); })"
```

将完整的错误信息截图发给我。

