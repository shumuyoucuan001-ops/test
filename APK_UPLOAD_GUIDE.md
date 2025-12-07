# APK上传和配置指南

## 📦 新版本信息

- **版本号**: 25.10.02.03
- **版本代码**: 25100203
- **APK大小**: 81MB
- **APK位置**: `SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk`

---

## 🚀 步骤1: 上传APK到阿里云OSS

### 方法1: 通过OSS控制台上传（推荐）

1. **登录阿里云OSS控制台**
   - 访问: https://oss.console.aliyun.com/

2. **进入Bucket**
   - 点击 `shumuyx` Bucket
   - 区域: 西南1（成都）

3. **导航到目录**
   - 点击 `app/android/` 目录
   - 如果目录不存在，先创建

4. **上传文件**
   - 点击"上传文件"按钮
   - 选择文件: `SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk`
   - **重要**: 保持文件名为 `app-release.apk`（不要带版本号）
   - 等待上传完成（81MB，预计1-2分钟）

5. **设置文件权限**
   - 找到上传的文件
   - 点击文件名右侧的"更多" → "设置读写权限"
   - 选择"公共读"
   - 点击"确定"

6. **验证上传**
   - 复制文件URL
   - 应该是: `https://shumuyx.oss-cn-chengdu.aliyuncs.com/app/android/app-release.apk`
   - 在浏览器中访问此URL，应该能下载APK

### 方法2: 通过命令行上传（可选）

如果安装了 `ossutil`：

```bash
# 上传APK
ossutil cp \
  /Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk \
  oss://shumuyx/app/android/app-release.apk

# 设置文件为公共读
ossutil set-acl oss://shumuyx/app/android/app-release.apk public-read
```

---

## 🔗 步骤2: 验证下载链接

### 通过自定义域名访问（推荐）

**固定下载地址**:
```
http://download.shuzhishanmu.com/app/android/app-release.apk
```

**验证方法**:
1. 在浏览器中打开上述链接
2. 应该开始下载APK文件
3. 检查下载的文件大小是否为81MB

### 通过OSS默认域名访问（备用）

```
https://shumuyx.oss-cn-chengdu.aliyuncs.com/app/android/app-release.apk
```

---

## ✅ 步骤3: 确认后端配置

后端配置已更新（无需手动操作）:

**文件**: `server/src/version/version.service.ts`

```typescript
version: '25.10.02.03'
versionCode: 25100203
downloadUrl: 'http://download.shuzhishanmu.com/app/android/app-release.apk'
forceUpdate: true
```

---

## 📱 步骤4: 测试版本更新

### 测试准备

1. **确认测试设备上的当前版本**
   - 打开应用
   - 进入主页
   - 查看底部版本号: 应该是 `25.10.02.02`

2. **确认后端服务运行中**
   ```bash
   # 测试版本接口
   curl http://192.168.0.109:4000/version/check?current=25.10.02.02
   
   # 应该返回:
   # {
   #   "hasUpdate": true,
   #   "version": "25.10.02.03",
   #   ...
   # }
   ```

### 测试步骤

#### 测试1: 启动时强制更新

1. **完全关闭应用**（从后台清除）
2. **重新打开应用**
3. **预期结果**:
   - 显示加载界面
   - 弹出强制更新对话框
   - 标题: "⚠️ 强制更新"
   - 内容: 显示版本 25.10.02.03 和更新说明
   - 只有一个按钮: "立即更新（必须）"
   - 无法点击其他区域关闭对话框

4. **点击"立即更新（必须）"**
   - 浏览器打开下载链接
   - APK开始下载
   - 下载完成后点击安装

5. **安装完成后重新打开应用**
   - 应该正常进入登录/主页
   - 不再显示更新提示
   - 查看版本号应该是 `25.10.02.03`

#### 测试2: 手动检查更新

1. **在主页点击"检查更新"按钮**
2. **预期结果**:
   - 显示提示: "当前已是最新版本"
   - 版本号显示: `25.10.02.03`

---

## 📥 其他设备下载方式

### 方式1: 扫描二维码（推荐）

可以使用以下工具生成下载二维码:
- https://cli.im/
- 输入链接: `http://download.shuzhishanmu.com/app/android/app-release.apk`
- 生成二维码后，其他设备扫码即可下载

### 方式2: 直接分享链接

**固定下载地址** (可以保存到书签/分享给其他人):
```
http://download.shuzhishanmu.com/app/android/app-release.apk
```

**特点**:
- ✅ 链接固定，不会变化
- ✅ 每次上传新版本APK时，只需覆盖同名文件即可
- ✅ 所有已分享的链接自动指向最新版本

### 方式3: 创建下载页面（可选）

可以创建一个简单的HTML下载页面，放在OSS上:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>术木 - 应用下载</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="text-align:center; padding:50px; font-family:Arial;">
    <h1>🌳 术木</h1>
    <p>标签打印系统</p>
    <p>当前版本: 25.10.02.03</p>
    <a href="http://download.shuzhishanmu.com/app/android/app-release.apk" 
       style="display:inline-block; padding:15px 30px; background:#007AFF; 
              color:white; text-decoration:none; border-radius:8px;">
        📥 下载 Android APK (81MB)
    </a>
    <p style="color:#666; margin-top:30px;">
        支持 Android 6.0 及以上系统
    </p>
</body>
</html>
```

---

## 🔧 故障排查

### 问题1: 浏览器访问下载链接显示404

**原因**: 文件未上传或路径错误

**解决**:
1. 检查OSS中文件路径是否为 `app/android/app-release.apk`
2. 检查文件权限是否为"公共读"
3. 尝试使用OSS默认域名访问

### 问题2: 下载链接可以访问但应用内更新失败

**原因**: DNS未生效或自定义域名配置问题

**解决**:
1. 在设备浏览器中打开下载链接测试
2. 如果浏览器可以下载，检查应用网络权限
3. 临时使用OSS默认域名替代自定义域名

### 问题3: APK下载后无法安装

**原因**: 签名问题或设备不允许安装未知来源应用

**解决**:
1. 检查设备是否允许"安装未知来源的应用"
2. 确认APK文件完整（大小约81MB）
3. 如果是签名问题，重新构建APK

### 问题4: 应用启动时不显示更新提示

**原因**: 
- 后端服务未启动
- 设备无法连接到后端服务器
- 版本号配置错误

**解决**:
1. 确认后端服务运行中: `curl http://192.168.0.109:4000/health`
2. 确认设备可以访问服务器
3. 检查后端版本配置是否为 25.10.02.03

---

## 📋 上传完成检查清单

完成上传后，请确认以下所有项:

- [ ] APK已上传到OSS: `app/android/app-release.apk`
- [ ] 文件权限设置为"公共读"
- [ ] 浏览器可以访问: `http://download.shuzhishanmu.com/app/android/app-release.apk`
- [ ] 文件大小约为81MB
- [ ] 后端服务运行中
- [ ] 版本接口返回正确: `curl http://192.168.0.109:4000/version/latest`
- [ ] 测试设备当前版本为 25.10.02.02

全部确认后，即可进行版本更新测试！

---

## 🎉 发布完成后

1. **记录发布信息**
   - 版本: 25.10.02.03
   - 发布日期: 2025-10-02
   - 下载链接: http://download.shuzhishanmu.com/app/android/app-release.apk

2. **通知用户**
   - 发送下载链接给其他设备用户
   - 或生成二维码供扫描下载

3. **下次更新时**
   - 更新版本号（如 25.10.02.04）
   - 重新构建APK
   - 覆盖上传同名文件到OSS
   - 所有下载链接自动指向新版本

---

**需要帮助？**
如有问题，请检查后端日志和设备网络连接。
