# 版本管理指南

## 📱 当前版本信息

- **版本号**: `25.10.02.01`
- **版本代码**: `25100201`
- **发布日期**: 2025-10-02

---

## 🔄 版本更新系统说明

本应用采用**基于 GitHub Release 的版本更新系统**，支持自动检查更新和手动下载安装。

### 系统特性

1. ✅ **自动检查更新**: 应用启动 2 秒后自动检查新版本
2. ✅ **手动检查更新**: 主页"检查更新"按钮手动触发
3. ✅ **智能提示**: 非强制更新时，每天只提示一次
4. ✅ **强制更新**: 支持强制更新模式（用户必须更新才能使用）
5. ✅ **GitHub Release 集成**: 通过 GitHub Release 发布新版本
6. ✅ **版本历史**: 显示更新日志

---

## 📦 发布新版本流程

### 步骤 1: 更新版本号

#### 1.1 修改 `SmLabelAppRN/android/app/build.gradle`

```gradle
defaultConfig {
    applicationId "com.smlabelapprn"
    versionCode 25100202      // 新版本代码 (格式: YYMMDDNN)
    versionName "25.10.02.02" // 新版本号 (格式: YY.MM.DD.NN)
}
```

**版本号规则**:

- 格式: `YY.MM.DD.NN`
- YY: 年份后两位 (25 = 2025 年)
- MM: 月份 (10 = 10 月)
- DD: 日期 (02 = 2 号)
- NN: 当日版本序号 (01, 02, 03...)

#### 1.2 修改 `SmLabelAppRN/App.tsx`

```typescript
// 更新版本号常量
const APP_VERSION = "25.10.02.02";
```

#### 1.3 修改 `SmLabelAppRN/src/screens/HomeScreen.tsx`

```typescript
// 更新版本号常量
const APP_VERSION = "25.10.02.02";
```

---

### 步骤 2: 构建 Release APK

```bash
cd SmLabelAppRN
npx react-native run-android --mode=release
```

APK 生成路径:

```
SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
```

---

### 步骤 3: 提交代码到 GitHub

```bash
# 1. 添加所有修改
git add .

# 2. 提交修改
git commit -m "chore: 发布版本 v25.10.02.02"

# 3. 创建版本标签
git tag -a v25.10.02.02 -m "版本 25.10.02.02

更新内容:
- 功能A
- 功能B
- 修复C"

# 4. 推送代码和标签到GitHub
git push origin develop
git push origin v25.10.02.02
```

---

### 步骤 4: 创建 GitHub Release

#### 方法 A: 通过 GitHub 网页创建

1. 访问 GitHub 仓库: `https://github.com/your-username/shumu`
2. 点击右侧 **"Releases"**
3. 点击 **"Draft a new release"**
4. 填写信息:

   - **Tag**: 选择刚才创建的标签 `v25.10.02.02`
   - **Release title**: `版本 25.10.02.02`
   - **Description**:

     ```
     ## 更新内容
     - 功能A
     - 功能B
     - 修复C

     ## 安装方法
     下载 `app-release.apk` 并安装
     ```

5. 上传 APK 文件: 将 `app-release.apk` 拖入 **"Attach binaries"** 区域
6. 点击 **"Publish release"**

#### 方法 B: 通过 GitHub CLI 创建

```bash
# 安装GitHub CLI (如果未安装)
brew install gh

# 登录GitHub
gh auth login

# 创建Release并上传APK
gh release create v25.10.02.02 \
  SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk \
  --title "版本 25.10.02.02" \
  --notes "更新内容:
- 功能A
- 功能B
- 修复C"
```

---

### 步骤 5: 更新后端版本信息

修改 `server/src/version/version.service.ts`:

```typescript
private latestVersion: VersionInfo = {
  version: '25.10.02.02',                    // 新版本号
  versionCode: 25100202,                     // 新版本代码
  downloadUrl: 'https://github.com/your-username/shumu/releases/download/v25.10.02.02/app-release.apk',
  releaseNotes: '更新内容:\n- 功能A\n- 功能B\n- 修复C',
  forceUpdate: false,                        // 是否强制更新
  releaseDate: '2025-10-02',
};
```

**重要**: 将 `your-username` 替换为实际的 GitHub 用户名或组织名！

重启后端服务器:

```bash
cd server
npm run start:dev
```

---

### 步骤 6: 测试更新功能

1. 在手机上打开应用
2. 点击主页的 **"检查更新"** 按钮
3. 应该弹出更新提示对话框
4. 点击 **"立即更新"**
5. 浏览器打开 GitHub Release 下载页面
6. 下载并安装新版本 APK

---

## 🔧 配置选项

### 强制更新

如果需要强制用户更新（比如修复重大安全漏洞），修改后端:

```typescript
forceUpdate: true,  // 设置为true
```

强制更新时:

- 用户无法关闭更新对话框
- 用户必须更新才能使用应用

### 更新检查频率

- **自动检查**: 应用启动 2 秒后自动检查（`App.tsx` 第 42 行）
- **手动检查**: 用户随时可以点击"检查更新"按钮
- **静默检查**: 非强制更新时，每天最多提示一次

---

## 📝 版本历史

### v25.10.02.01 (2025-10-02)

**初始版本**

- ✅ 商品标签打印
- ✅ 收货单打印
- ✅ 蓝牙打印支持
- ✅ 自动登录
- ✅ 单点登录
- ✅ 版本更新系统

---

## 🚀 未来计划

### 可选增强功能

1. **应用内下载**: 直接在应用内下载 APK（需要配置本地服务器）
2. **下载进度条**: 显示 APK 下载进度
3. **增量更新**: 只下载差异部分（需要额外实现）
4. **热更新**: 使用 CodePush 实现 JavaScript 代码热更新

---

## ⚠️ 注意事项

1. **版本号同步**: 确保 `build.gradle`、`App.tsx`、`HomeScreen.tsx` 中的版本号一致
2. **GitHub 仓库**: 确保后端 `downloadUrl` 中的 GitHub 用户名正确
3. **Release 权限**: 需要有 GitHub 仓库的 Release 权限
4. **APK 签名**: 生产环境应使用正式的签名密钥（当前使用 debug 密钥）
5. **网络连接**: 版本检查需要网络连接

---

## 🛠️ 故障排查

### 问题 1: 检查更新时显示"检查更新失败"

**原因**: 无法连接到后端服务器

**解决**:

1. 检查后端服务器是否运行: `curl http://192.168.0.109:4000/version/latest`
2. 检查手机和电脑是否在同一局域网
3. 检查防火墙是否阻止连接

### 问题 2: 点击"立即更新"没反应

**原因**: GitHub Release URL 配置错误

**解决**:

1. 检查 `version.service.ts` 中的 `downloadUrl`
2. 确保 GitHub Release 已创建
3. 确保 APK 文件已上传到 Release

### 问题 3: 下载的 APK 无法安装

**原因**: 签名问题或权限问题

**解决**:

1. 检查手机是否允许安装未知来源应用
2. 重新构建 APK: `npx react-native run-android --mode=release`
3. 确保 APK 文件完整未损坏

---

## 📞 技术支持

如有问题，请联系技术团队或查看项目 Wiki。
