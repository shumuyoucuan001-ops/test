# 修复 libatk 缺失问题

## 问题

```
error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file: No such file or directory
```

## 解决方案

请在宝塔终端执行：

```bash
# 安装ATK库
yum install -y atk

# 验证库文件
ls -l /usr/lib64/libatk-1.0.so*

# 如果库文件存在但名称不匹配，创建软链接
if [ ! -f /usr/lib64/libatk-1.0.so.0 ]; then
  ln -s /usr/lib64/libatk-1.0.so.* /usr/lib64/libatk-1.0.so.0
fi

# 重新测试Chromium
/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome --version

# 测试Playwright
cd /www/wwwroot/sm-api-v2
node -e "const {chromium} = require('playwright'); chromium.launch().then(() => console.log('✅ Playwright OK')).catch(e => console.log('❌ Error:', e.message))"
```

如果还有其他缺失的库，会继续显示错误信息。我们会逐个解决。

