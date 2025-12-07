# APK 构建完成 - v25.10.03.04

## ✅ 构建成功！

**APK 文件位置：**

```
/Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
```

**版本信息：**

- **版本号**: 25.10.03.04
- **版本代码**: 25100304
- **构建时间**: 2025-10-03

## 主要更新内容

1. ✅ 服务器端安装 Playwright 及系统依赖
2. ✅ 安装中文字体（wqy-microhei.ttc）
3. ✅ 修复 HTML 模板打印功能
4. ✅ 中文内容可以正常渲染和打印

## 下一步操作

### 1. 上传 APK 到阿里云 OSS

使用之前的方法：

1. 将 APK 文件重命名为 `app-release.apk`（如果还没重命名）
2. 使用阿里云 OSS 控制台上传到：`shuzhi-shanmu/app/android/app-release.apk`
3. 确保文件 ACL 设置为"公共读"

### 2. 更新后端版本配置

编辑服务器文件 `/www/wwwroot/sm-api-v2/dist/main.js` 或源码 `server/src/version/version.service.ts`：

```typescript
private latestVersion: VersionInfo = {
  version: '25.10.03.04',
  versionCode: 25100304,
  downloadUrl: 'http://download.shuzhishanmu.com/app/android/app-release.apk',
  releaseNotes: '新版本更新',
  forceUpdate: true,
  releaseDate: '2025-10-03',
};
```

然后重启服务：

```bash
cd /www/wwwroot/sm-api-v2
pkill -f "node.*dist/main.js"
node dist/main.js > /tmp/sm-api-v2.log 2>&1 &
```

### 3. 测试更新功能

在测试设备上打开 App，应该会提示更新到 `25.10.03.04` 版本。

### 4. 下载链接（供其他设备使用）

更新后的固定下载链接：

```
http://download.shuzhishanmu.com/app/android/app-release.apk
```

---

**注意事项：**

- 请确保服务器上的 `sm-api-v2` 服务正常运行
- 请确保中文字体已正确安装在服务器上
- 测试打印功能时，中文应该能正常显示

如有问题，请查看服务器日志：

```bash
tail -f /tmp/sm-api-v2.log
```

