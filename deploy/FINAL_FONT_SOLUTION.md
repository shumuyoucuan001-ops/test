# 最终字体解决方案

所有下载都失败了。让我们用最可靠的方法：

## 方案 1：使用系统自带字体（最简单）

```bash
# 检查系统是否已有中文字体
fc-list | grep -i "sans\|serif" | head -20

# 使用DejaVu字体（通常已安装）作为备用
fc-list | grep -i dejavu
```

## 方案 2：手动下载到本地后上传

由于所有在线下载都失败，请：

1. **在您的本地电脑**下载字体：

   - 文泉驿微米黑：https://github.com/anthonyfok/fonts-wqy-microhei/raw/master/wqy-microhei.ttc
   - 或思源黑体：https://github.com/adobe-fonts/source-han-sans/releases/download/2.004R/SourceHanSansSC.zip

2. **使用宝塔面板上传**：

   - 打开宝塔面板
   - 文件管理
   - 进入 `/usr/share/fonts/truetype/chinese/`
   - 上传字体文件（.ttc 或 .otf）

3. **刷新字体缓存**：

```bash
cd /usr/share/fonts/truetype/chinese
chmod 644 *.ttc *.otf
fc-cache -fv
fc-list :lang=zh
```

## 方案 3：临时测试（不需要字体）

如果上传字体也很麻烦，我们可以先让 Playwright 使用无字体模式渲染，虽然中文会显示为方框，但至少可以验证布局是否正确。

但是，**您说"打印又回到之前完全没有内容了"**，这说明服务可能崩溃了。

**请先执行以下命令检查服务状态：**

```bash
# 检查服务是否还在运行
ps aux | grep "node.*sm-api-v2"

# 检查5000端口
netstat -tlnp | grep 5000

# 测试API
curl http://127.0.0.1:5000/health

# 如果服务停止了，重新启动
cd /www/wwwroot/sm-api-v2
node dist/main.js > /tmp/sm-api-v2.log 2>&1 &

# 查看启动日志
tail -50 /tmp/sm-api-v2.log
```

请先检查服务状态！

