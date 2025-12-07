# 安装所有缺失的 Playwright 依赖

## 当前问题

```
error while loading shared libraries: libatk-bridge-2.0.so.0: cannot open shared object file
```

## 一次性安装所有可能缺失的库

请在宝塔终端执行以下命令（**复制全部一起执行**）：

```bash
# 安装所有Playwright/Chromium需要的库
yum install -y \
  at-spi2-atk \
  at-spi2-core \
  cups-libs \
  gtk3 \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  liberation-fonts \
  nss \
  nspr \
  mesa-libgbm \
  alsa-lib \
  libdrm \
  libxcb \
  libxkbcommon \
  cairo \
  glib2 \
  dbus-libs \
  libwayland-client \
  libwayland-cursor \
  libwayland-egl \
  libwayland-server

# 测试Chromium
echo "========== 测试Chromium =========="
/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome --version

# 如果成功，测试Playwright
if [ $? -eq 0 ]; then
  echo "========== 测试Playwright =========="
  cd /www/wwwroot/sm-api-v2
  node -e "const {chromium} = require('playwright'); chromium.launch().then(() => console.log('✅ Playwright 完全正常！')).catch(e => console.log('❌ 错误:', e.message))"
fi
```

这个命令会安装所有必需的库。执行完成后请告诉我结果！

