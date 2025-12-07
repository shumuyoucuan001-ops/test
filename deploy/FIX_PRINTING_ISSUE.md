# 🔧 修复打印内容不对的问题

## 📝 **问题诊断**

打印出现 `"FALLBACK"` 和 `"320x240"` 文字，说明后端正在使用降级渲染模式，而不是正常的 HTML 模板渲染。

**原因**: Playwright 没有正确安装或浏览器依赖缺失

---

## 🚀 **解决方案：在服务器上安装 Playwright**

### **步骤 1：SSH 登录到服务器**

```bash
ssh root@121.43.139.147
```

### **步骤 2：进入项目目录并安装 Playwright**

```bash
cd /www/wwwroot/sm-api-v2

# 安装Playwright和chromium浏览器
/www/server/nodejs/v20.19.5/bin/npm install playwright
/www/server/nodejs/v20.19.5/bin/npx playwright install chromium

# 安装系统依赖
/www/server/nodejs/v20.19.5/bin/npx playwright install-deps chromium
```

### **步骤 3：测试 Playwright 是否正常**

```bash
cd /www/wwwroot/sm-api-v2

# 测试Playwright
/www/server/nodejs/v20.19.5/bin/node -e "const {chromium} = require('playwright'); chromium.launch().then(() => console.log('Playwright works!')).catch(e => console.error('Error:', e))"
```

### **步骤 4：重启服务**

在宝塔面板：

1. 找到 **sm-api-v2** 项目
2. 点击 **"重启"** 按钮

---

## 🧪 **验证修复**

### **方法 1：查看日志**

```bash
# 在宝塔终端执行
pm2 logs sm-api-v2 --lines 100 | grep -E "(Playwright|htmlToTspl|FALLBACK)"
```

如果看到：

- ✅ `Using Playwright for HTML rendering` - 说明 Playwright 正常工作
- ❌ `Playwright rendering failed, using fallback` - 说明还有问题

### **方法 2：测试打印**

在移动应用中：

1. 进入产品标签打印
2. 搜索一个 SKU
3. 打印测试
4. 检查打印内容是否正确（应该显示产品信息，而不是 FALLBACK）

---

## 🔍 **如果 Playwright 安装失败**

### **可能的原因和解决方案**

#### **问题 1：系统依赖缺失**

Playwright 需要很多系统库。如果 `playwright install-deps` 失败，手动安装：

```bash
# Alibaba Cloud Linux / CentOS
yum install -y \
  libX11 libX11-xcb libxcb libxkbcommon \
  libXcomposite libXcursor libXdamage libXext \
  libXfixes libXi libXrender libXrandr libXScrnSaver \
  libXtst cups-libs libxshmfence nss nss-tools \
  alsa-lib at-spi2-atk at-spi2-core atk \
  cairo dbus-glib dbus-libs gtk3 \
  liberation-fonts libdrm libgbm pango
```

#### **问题 2：服务器内存不足**

Chromium 需要较多内存。如果服务器内存小于 2GB，考虑：

- 升级服务器配置
- 或使用更轻量的渲染方案

#### **问题 3：权限问题**

确保项目目录有正确的权限：

```bash
cd /www/wwwroot
chown -R www:www sm-api-v2
chmod -R 755 sm-api-v2
```

---

## 🎯 **临时解决方案：使用 Jimp 渲染（降级方案）**

如果 Playwright 无法安装，可以修改代码使用 Jimp 渲染（质量较差，但可用）：

在服务器上编辑文件：

```bash
cd /www/wwwroot/sm-api-v2
nano src/template/template.controller.ts
```

找到 `htmlToTsplBitmap` 函数，修改为直接使用 Jimp：

```typescript
// 注释掉Playwright尝试
// const bitmap = await this.htmlToTsplBitmapViaHeadless(html, widthMm, heightMm, dpi);

// 直接使用Jimp
const bitmap = await this.htmlToTsplBitmapViaJimp(html, widthMm, heightMm, dpi);
```

然后重新构建并重启：

```bash
cd /www/wwwroot/sm-api-v2
/www/server/nodejs/v20.19.5/bin/npm run build
# 在宝塔面板重启 sm-api-v2
```

---

## 📊 **检查当前状态**

在宝塔终端执行：

```bash
cd /www/wwwroot/sm-api-v2

# 1. 检查Playwright是否已安装
ls -la node_modules | grep playwright

# 2. 检查chromium浏览器
ls -la /root/.cache/ms-playwright/

# 3. 查看项目日志
pm2 logs sm-api-v2 --lines 50
```

---

**请在服务器上执行步骤 1-4，然后告诉我结果！** 🚀

