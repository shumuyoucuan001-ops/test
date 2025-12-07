# 调试 Playwright 问题

## 步骤 1：获取详细错误信息

请在宝塔终端执行：

```bash
cd /www/wwwroot/sm-api-v2
node -e "const {chromium} = require('playwright'); chromium.launch({headless:true}).then(async (browser) => { console.log('✅ OK'); await browser.close(); }).catch(e => { console.log('完整错误:'); console.log(e.stack); })"
```

## 步骤 2：检查 Chromium 文件

```bash
ls -lh /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome
```

## 步骤 3：尝试直接运行 Chromium

```bash
/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome --version 2>&1 | head -20
```

## 步骤 4：安装 CentOS/RHEL 专用依赖

如果上面的命令显示缺少特定的库，请尝试：

```bash
# 方案A：安装EPEL仓库（包含更多包）
yum install -y epel-release

# 方案B：安装所有可能需要的库
yum install -y \
  fontconfig \
  freetype \
  libX11 \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXrender \
  libXss \
  libXtst \
  libxcb \
  libnss3 \
  libnspr4 \
  libatk-1.0 \
  libatk-bridge-2.0 \
  libcups \
  libdrm \
  libxkbcommon \
  libXScrnSaver \
  mesa-libgbm \
  alsa-lib \
  pango \
  cairo \
  glib2
```

请执行步骤 1 和步骤 3，然后将完整输出截图发给我！

