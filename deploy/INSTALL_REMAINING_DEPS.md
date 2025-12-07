# 安装剩余依赖

请在宝塔终端执行以下命令：

```bash
# 安装额外的字体和库
yum install -y \
  dejavu-sans-fonts \
  dejavu-serif-fonts \
  dejavu-sans-mono-fonts \
  liberation-sans-fonts \
  liberation-serif-fonts \
  liberation-mono-fonts \
  gnu-free-fonts-common \
  google-noto-fonts-common \
  wqy-zenhei-fonts \
  libasound2 \
  libgbm1 \
  libdrm2

# 验证Playwright
cd /www/wwwroot/sm-api-v2
node -e "const {chromium} = require('playwright'); chromium.launch().then(() => console.log('✅ Playwright OK')).catch(e => console.log('❌ Error:', e.message))"
```

如果还是报错，请尝试：

```bash
# 获取更详细的错误信息
cd /www/wwwroot/sm-api-v2
node -e "const {chromium} = require('playwright'); chromium.launch({headless:true}).then(async (browser) => { console.log('✅ Browser launched successfully'); await browser.close(); }).catch(e => { console.log('❌ Full error:'); console.log(e); })"
```

请将结果截图发给我！

