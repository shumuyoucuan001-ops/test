# 安装中文字体 - 替代方案

`fc-list :lang=zh` 显示没有中文字体。让我们手动下载安装：

```bash
# 创建字体目录
mkdir -p /usr/share/fonts/truetype/chinese

# 下载文泉驿微米黑字体
cd /usr/share/fonts/truetype/chinese
wget https://github.com/anthonyfok/fonts-wqy-microhei/raw/master/wqy-microhei.ttc

# 如果wget下载失败，使用备用源
# curl -L -o wqy-microhei.ttc "https://mirrors.tuna.tsinghua.edu.cn/debian/pool/main/f/fonts-wqy-microhei/fonts-wqy-microhei_0.2.0-beta-3_all.deb"
# ar x fonts-wqy-microhei_0.2.0-beta-3_all.deb
# tar xf data.tar.xz
# cp ./usr/share/fonts/truetype/wqy/wqy-microhei.ttc .

# 或者直接从阿里云镜像下载
wget https://mirrors.aliyun.com/debian/pool/main/f/fonts-wqy-microhei/fonts-wqy-microhei_0.2.0-beta-3_all.deb
ar x fonts-wqy-microhei_0.2.0-beta-3_all.deb
tar xf data.tar.xz
mv ./usr/share/fonts/truetype/wqy/wqy-microhei.ttc .
rm -rf usr fonts-wqy-microhei_0.2.0-beta-3_all.deb control.tar.xz data.tar.xz debian-binary

# 设置权限
chmod 644 /usr/share/fonts/truetype/chinese/*.ttc

# 刷新字体缓存
fc-cache -fv

# 验证中文字体
fc-list :lang=zh

# 查看具体的字体文件
ls -lh /usr/share/fonts/truetype/chinese/
```

执行完成后，再次测试打印！

