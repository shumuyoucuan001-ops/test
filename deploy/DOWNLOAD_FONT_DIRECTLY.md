# 直接下载中文字体文件

解压 deb 包失败，让我们直接下载 ttc 字体文件：

```bash
# 创建字体目录
mkdir -p /usr/share/fonts/truetype/chinese
cd /usr/share/fonts/truetype/chinese

# 方案1：从GitHub直接下载
wget -O wqy-microhei.ttc "https://github.com/anthonyfok/fonts-wqy-microhei/raw/master/wqy-microhei.ttc"

# 如果GitHub下载失败，使用方案2：从Gitee下载
# wget -O wqy-microhei.ttc "https://gitee.com/mirrors/wqy-microhei/raw/master/wqy-microhei.ttc"

# 方案3：下载思源黑体（如果上面都失败）
# wget "https://github.com/adobe-fonts/source-han-sans/releases/download/2.004R/SourceHanSansSC.zip"
# unzip SourceHanSansSC.zip
# mv SourceHanSansSC/OTF/*.otf .
# rm -rf SourceHanSansSC SourceHanSansSC.zip

# 验证文件下载成功
ls -lh wqy-microhei.ttc

# 设置权限
chmod 644 *.ttc *.otf 2>/dev/null

# 刷新字体缓存
fc-cache -fv

# 验证中文字体
fc-list :lang=zh

# 如果还是没有输出，手动验证字体文件
fc-list | grep -i "wqy\|source"
```

执行完成后请告诉我是否看到中文字体！

