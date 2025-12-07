# 📱 Android 应用图标更新指南

## 📍 图标文件位置

您需要替换以下目录中的图标文件：

### 基础路径
```
SmLabelAppRN/android/app/src/main/res/
```

### 需要替换的文件（按优先级）

#### 1. **主要图标文件**（必须替换）

```
mipmap-mdpi/ic_launcher.png          (48x48px)
mipmap-mdpi/ic_launcher_round.png    (48x48px)

mipmap-hdpi/ic_launcher.png          (72x72px)
mipmap-hdpi/ic_launcher_round.png    (72x72px)

mipmap-xhdpi/ic_launcher.png         (96x96px)
mipmap-xhdpi/ic_launcher_round.png   (96x96px)

mipmap-xxhdpi/ic_launcher.png        (144x144px)
mipmap-xxhdpi/ic_launcher_round.png  (144x144px)

mipmap-xxxhdpi/ic_launcher.png       (192x192px)
mipmap-xxxhdpi/ic_launcher_round.png (192x192px)
```

#### 2. **自适应图标文件**（可选，建议也替换）

```
mipmap-mdpi/ic_launcher_adaptive_fore.png    (前景层)
mipmap-mdpi/ic_launcher_adaptive_back.png    (背景层)

mipmap-hdpi/ic_launcher_adaptive_fore.png
mipmap-hdpi/ic_launcher_adaptive_back.png

mipmap-xhdpi/ic_launcher_adaptive_fore.png
mipmap-xhdpi/ic_launcher_adaptive_back.png

mipmap-xxhdpi/ic_launcher_adaptive_fore.png
mipmap-xxhdpi/ic_launcher_adaptive_back.png

mipmap-xxxhdpi/ic_launcher_adaptive_fore.png
mipmap-xxxhdpi/ic_launcher_adaptive_back.png
```

---

## 🎨 图标类型说明

### ic_launcher.png
- **用途**: 标准方形图标
- **显示**: 大多数设备的应用图标
- **建议**: 图标周围留适当边距

### ic_launcher_round.png
- **用途**: 圆形图标
- **显示**: 支持圆形图标的设备（如某些华为、小米设备）
- **建议**: 图标主体居中，适合圆形裁剪

### ic_launcher_adaptive_fore.png / back.png
- **用途**: Android 8.0+ 的自适应图标
- **fore（前景层）**: 图标主体，可以是透明背景
- **back（背景层）**: 纯色或简单图案背景
- **说明**: 系统会自动组合前景和背景层，并根据设备主题调整形状

---

## 🔧 推荐的替换方法

### 方法1: 使用在线工具生成（最简单）

1. **访问图标生成网站**
   - https://icon.kitchen/ （推荐）
   - https://romannurik.github.io/AndroidAssetStudio/

2. **上传原始图标**
   - 建议尺寸: **1024x1024px**
   - 格式: PNG（透明背景更佳）

3. **配置选项**
   - Icon Type: Launcher Icons
   - Shape: Square / Circle (都生成)
   - Background: 选择背景颜色或上传背景图

4. **下载生成的文件**
   - 网站会生成所有需要的尺寸
   - 解压后会有完整的 `mipmap-*` 文件夹结构

5. **替换文件**
   ```bash
   # 解压后，复制到项目中
   cp -r 下载的文件夹/mipmap-* SmLabelAppRN/android/app/src/main/res/
   ```

### 方法2: 手动替换（如果您有准备好的图标）

如果您已经有了不同尺寸的图标文件，直接覆盖对应的文件即可。

**注意事项**:
- 保持文件名不变
- 确保尺寸正确
- 建议使用 PNG 格式，保留透明度

### 方法3: 使用命令行批量生成（需要 ImageMagick）

如果您有一张高清原图（如 1024x1024px），可以使用命令行批量生成：

```bash
# 安装 ImageMagick（如果未安装）
# macOS: brew install imagemagick

cd /Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/src/main/res

# 从原图生成各个尺寸（假设原图为 icon-1024.png）
convert /path/to/icon-1024.png -resize 48x48 mipmap-mdpi/ic_launcher.png
convert /path/to/icon-1024.png -resize 72x72 mipmap-hdpi/ic_launcher.png
convert /path/to/icon-1024.png -resize 96x96 mipmap-xhdpi/ic_launcher.png
convert /path/to/icon-1024.png -resize 144x144 mipmap-xxhdpi/ic_launcher.png
convert /path/to/icon-1024.png -resize 192x192 mipmap-xxxhdpi/ic_launcher.png

# 同样生成 round 版本
convert /path/to/icon-1024.png -resize 48x48 mipmap-mdpi/ic_launcher_round.png
convert /path/to/icon-1024.png -resize 72x72 mipmap-hdpi/ic_launcher_round.png
convert /path/to/icon-1024.png -resize 96x96 mipmap-xhdpi/ic_launcher_round.png
convert /path/to/icon-1024.png -resize 144x144 mipmap-xxhdpi/ic_launcher_round.png
convert /path/to/icon-1024.png -resize 192x192 mipmap-xxxhdpi/ic_launcher_round.png
```

---

## 📋 更新图标后的流程

完成图标替换后，请按以下步骤操作：

### 1. 验证图标文件
```bash
# 检查所有图标是否存在
ls -lh SmLabelAppRN/android/app/src/main/res/mipmap-*/ic_launcher*.png
```

### 2. 通知我
告诉我："**图标已更新完成**"

### 3. 我会执行以下操作
- ✅ 清理旧的构建文件
- ✅ 重新构建 Release APK
- ✅ 验证新 APK 的大小和完整性
- ✅ 提供上传到 OSS 的说明

### 4. 您需要做的
- 上传新 APK 到阿里云 OSS
- 在测试设备上验证新图标显示正常

---

## ✅ 图标设计建议

### 尺寸要求
- **最小**: 48x48px (mdpi)
- **最大**: 192x192px (xxxhdpi)
- **建议原图**: 1024x1024px

### 设计规范
- **简洁明了**: 避免过多细节，小尺寸时难以识别
- **留边距**: 图标周围留 10-20% 的边距
- **统一风格**: 与品牌形象保持一致
- **测试**: 在不同背景色下测试可见度

### 文件格式
- **推荐**: PNG 格式
- **透明度**: 支持透明背景
- **压缩**: 适度压缩减小文件大小

---

## 🔍 常见问题

### Q: ic_launcher 和 ic_launcher_round 有什么区别？
A: 
- `ic_launcher.png`: 方形图标，大多数设备使用
- `ic_launcher_round.png`: 圆形图标，部分设备（华为、小米等）支持圆形桌面图标时使用

### Q: adaptive icon 是必须的吗？
A: 不是必须的，但建议提供。Android 8.0+ 会优先使用 adaptive icon，可以让图标在不同设备上有更好的适配效果。

### Q: 我只有一张图，可以用于所有尺寸吗？
A: 可以，使用在线工具（如 icon.kitchen）会自动生成所有尺寸。或者使用 ImageMagick 批量缩放。

### Q: 更新图标后需要卸载重装应用吗？
A: 不需要，直接安装新版本即可覆盖，图标会自动更新。

---

## 📞 下一步

**请按以下顺序操作：**

1. ✅ 准备或生成新的图标文件
2. ✅ 替换到对应目录
3. ✅ 告诉我 "图标已更新完成"
4. ✅ 我会重新构建 APK

**准备好后请告诉我！** 🎉
