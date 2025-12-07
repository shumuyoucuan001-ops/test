# 安装中文字体

## 问题

Playwright 已经正常工作，但中文没有正确渲染，因为缺少中文字体。

## 解决方案

请在宝塔终端执行以下命令安装中文字体：

```bash
# 方案1：安装文泉驿中文字体（推荐）
yum install -y \
  wqy-microhei-fonts \
  wqy-zenhei-fonts \
  wqy-unibit-fonts

# 方案2：如果上面的包找不到，安装思源字体
yum install -y \
  google-noto-sans-cjk-ttc-fonts \
  google-noto-serif-cjk-ttc-fonts

# 方案3：如果还是找不到，手动下载安装
mkdir -p /usr/share/fonts/chinese
cd /usr/share/fonts/chinese
wget https://github.com/adobe-fonts/source-han-sans/raw/release/OTF/SimplifiedChinese/SourceHanSansSC-Regular.otf
wget https://github.com/adobe-fonts/source-han-serif/raw/release/OTF/SimplifiedChinese/SourceHanSerifSC-Regular.otf

# 刷新字体缓存
fc-cache -fv

# 验证中文字体
fc-list :lang=zh | head -20
```

安装完成后，**无需重启服务**，直接在移动设备上再次打印测试！

如果中文还是显示不正常，请执行最后一个命令（`fc-list :lang=zh`）并将输出截图发给我。

