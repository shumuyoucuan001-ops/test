# iOS 备案必填信息获取指南

本文档说明如何获取 iOS 应用备案所需的三个必填信息。

## 一、iOS平台Bundle ID

### 当前项目的 Bundle ID
**`com.sm.labelapp`**

### 获取方式

#### 方法1：查看 Xcode 项目配置（推荐）
1. 打开 Xcode
2. 打开项目：`SmLabelApp/ios/SmLabelApp.xcodeproj`
3. 在左侧项目导航器中，选择项目根节点（蓝色图标）
4. 选择 `SmLabelApp` target
5. 切换到 `General` 标签页
6. 在 `Identity` 部分查看 `Bundle Identifier` 字段

#### 方法2：查看项目配置文件
查看文件：`SmLabelApp/ios/SmLabelApp.xcodeproj/project.pbxproj`

搜索 `PRODUCT_BUNDLE_IDENTIFIER`，找到：
```
PRODUCT_BUNDLE_IDENTIFIER = "com.sm.labelapp";
```

#### 方法3：查看 Info.plist
查看文件：`SmLabelApp/ios/SmLabelApp/Info.plist`

虽然这里显示的是 `$(PRODUCT_BUNDLE_IDENTIFIER)`，但实际值在 `project.pbxproj` 中定义。

---

## 二、公钥（Public Key）

### 获取方式

#### 方法1：从描述文件（Provisioning Profile）中提取（推荐）

1. **下载描述文件**
   - 登录 [Apple Developer Portal](https://developer.apple.com/account/)
   - 进入 `Certificates, Identifiers & Profiles`
   - 下载对应的 Provisioning Profile（.mobileprovision 文件）

2. **提取公钥**
   ```bash
   # 方法A：使用 security 命令（macOS）
   security cms -D -i your_profile.mobileprovision > profile.plist
   # 然后查看 profile.plist 中的 DeveloperCertificates 字段
   
   # 方法B：使用 openssl 命令
   openssl pkcs7 -inform DER -in your_profile.mobileprovision -print_certs -out certs.pem
   openssl x509 -in certs.pem -pubkey -noout > public_key.pem
   ```

3. **查看公钥内容**
   ```bash
   cat public_key.pem
   ```

#### 方法2：从证书（.cer 或 .p12）中提取

1. **如果有 .p12 证书文件**
   ```bash
   # 导出证书
   openssl pkcs12 -in certificate.p12 -clcerts -nokeys -out cert.pem
   
   # 提取公钥
   openssl x509 -in cert.pem -pubkey -noout > public_key.pem
   ```

2. **如果有 .cer 证书文件**
   ```bash
   # 直接提取公钥
   openssl x509 -inform DER -in certificate.cer -pubkey -noout > public_key.pem
   ```

3. **从 Keychain 中导出（macOS）**
   - 打开 `钥匙串访问`（Keychain Access）
   - 找到对应的开发证书或分发证书
   - 右键选择 `导出`
   - 选择格式为 `.cer`
   - 然后使用上述 openssl 命令提取公钥

#### 方法3：使用 Xcode 查看
1. 打开 Xcode
2. 进入 `Preferences` > `Accounts`
3. 选择你的 Apple ID
4. 点击 `Manage Certificates`
5. 选择证书，右键 `Export Certificate`
6. 导出后使用 openssl 提取公钥

### 公钥格式示例
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```

---

## 三、证书SHA-1指纹

### 获取方式

#### 方法1：从描述文件中提取（推荐）

```bash
# 提取证书
openssl pkcs7 -inform DER -in your_profile.mobileprovision -print_certs -out certs.pem

# 获取 SHA-1 指纹
openssl x509 -in certs.pem -fingerprint -sha1 -noout
```

输出格式：
```
SHA1 Fingerprint=XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

去掉 `SHA1 Fingerprint=` 前缀，只保留冒号分隔的十六进制字符串。

#### 方法2：从证书文件中提取

```bash
# 从 .p12 文件
openssl pkcs12 -in certificate.p12 -clcerts -nokeys -out cert.pem
openssl x509 -in cert.pem -fingerprint -sha1 -noout

# 从 .cer 文件
openssl x509 -inform DER -in certificate.cer -fingerprint -sha1 -noout
```

#### 方法3：从 Keychain 中查看（macOS）

1. 打开 `钥匙串访问`（Keychain Access）
2. 选择 `登录` 或 `系统` 钥匙串
3. 找到对应的证书（通常名称包含 "Apple Development" 或 "Apple Distribution"）
4. 双击打开证书详情
5. 展开 `详细信息`
6. 查看 `SHA-1` 字段

#### 方法4：使用命令行查看 Keychain 中的证书

```bash
# 列出所有证书
security find-identity -v -p codesigning

# 查看特定证书的 SHA-1（需要证书的 Common Name）
security find-certificate -c "证书名称" -p | openssl x509 -fingerprint -sha1 -noout
```

### SHA-1 指纹格式示例
```
A1:B2:C3:D4:E5:F6:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB
```

**注意**：备案时通常需要去掉冒号，格式为：
```
A1B2C3D4E5F61234567890ABCDEF1234567890AB
```

---

## 快速获取脚本（macOS）

创建一个脚本文件 `get_ios_filing_info.sh`：

```bash
#!/bin/bash

echo "=== iOS 备案信息获取工具 ==="
echo ""

# 1. Bundle ID
echo "1. Bundle ID:"
grep -A 1 "PRODUCT_BUNDLE_IDENTIFIER" ios/SmLabelApp.xcodeproj/project.pbxproj | grep -v "//" | head -1 | sed 's/.*= "\(.*\)";/\1/'
echo ""

# 2. 从描述文件获取证书信息
if [ -f "$1" ]; then
    echo "2. 从描述文件提取信息:"
    echo "   描述文件: $1"
    echo ""
    
    # 提取证书
    openssl pkcs7 -inform DER -in "$1" -print_certs -out /tmp/certs.pem 2>/dev/null
    
    if [ -f /tmp/certs.pem ]; then
        # SHA-1 指纹
        echo "   SHA-1 指纹:"
        openssl x509 -in /tmp/certs.pem -fingerprint -sha1 -noout | sed 's/SHA1 Fingerprint=//'
        echo ""
        
        # 公钥
        echo "   公钥:"
        openssl x509 -in /tmp/certs.pem -pubkey -noout
        echo ""
    fi
else
    echo "2. 请提供描述文件路径作为参数"
    echo "   用法: ./get_ios_filing_info.sh path/to/profile.mobileprovision"
    echo ""
fi

echo "3. 如果要从 Keychain 获取，请使用以下命令:"
echo "   security find-identity -v -p codesigning"
```

使用方法：
```bash
chmod +x get_ios_filing_info.sh
./get_ios_filing_info.sh path/to/your_profile.mobileprovision
```

---

## 注意事项

1. **Bundle ID** 必须与 Apple Developer Portal 中注册的 App ID 一致
2. **公钥** 和 **SHA-1 指纹** 必须来自用于签名的证书
3. 如果是企业账号，需要使用企业分发证书
4. 如果是个人/公司账号，需要使用 App Store 分发证书
5. 开发证书和分发证书的 SHA-1 不同，请确保使用正确的证书

---

## 当前项目信息汇总

- **Bundle ID**: `com.sm.labelapp`
- **公钥**: 需要从实际使用的证书中提取
- **SHA-1 指纹**: 需要从实际使用的证书中提取

---

## 相关文件位置

- Bundle ID 配置: `ios/SmLabelApp.xcodeproj/project.pbxproj`
- Info.plist: `ios/SmLabelApp/Info.plist`
- 证书文件: 通常在 Keychain 或从 Apple Developer Portal 下载

---

## 参考链接

- [Apple Developer Portal](https://developer.apple.com/account/)
- [iOS 应用备案指南](https://beian.miit.gov.cn/)（工信部备案系统）

