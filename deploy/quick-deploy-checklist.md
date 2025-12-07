# ⚡ 快速部署清单 - 新后端服务

## 🎯 **目标**

创建新的后端服务 `sm-api-v2`，使用 Git 自动部署，端口 5000

---

## 📝 **第 1 步: 宝塔面板创建项目（5 分钟）**

1. 访问: http://121.43.139.147:8888
2. 左侧菜单 → **Node 项目**
3. 点击 **"添加项目"**
4. 填写配置：
   ```
   项目名称: sm-api-v2
   运行目录: /www/wwwroot/sm-api-v2
   端口: 5000
   ✅ 开机自启动
   ✅ 自动重启
   ```
5. 点击"提交"（**暂时不启动**）

---

## 📝 **第 2 步: 在宝塔终端执行部署（10 分钟）**

在宝塔面板点击右上角 **"终端"** 图标，执行：

```bash
# ============================================
# 🚀 一键部署脚本
# ============================================

# 1. 克隆代码
cd /www/wwwroot
git clone -b develop https://github.com/xuxiang6/shumu.git sm-api-v2-temp

# 2. 移动server目录内容
mkdir -p sm-api-v2
cp -r sm-api-v2-temp/server/* sm-api-v2/
rm -rf sm-api-v2-temp

# 3. 进入项目目录
cd sm-api-v2

# 4. 安装依赖（使用国内镜像）
npm config set registry https://registry.npmmirror.com
npm install

# 5. 生成Prisma Client
npx prisma generate

# 6. 运行数据库迁移
npx prisma migrate deploy

# 7. 构建项目
npm run build

# 8. 检查构建结果
echo "✅ 部署完成！检查dist目录："
ls -la dist/

echo ""
echo "🎉 现在可以在宝塔面板启动项目了！"
echo "项目路径: /www/wwwroot/sm-api-v2"
echo "启动文件: dist/main.js"
```

**预期结果**: 显示 `dist/` 目录包含 `main.js` 等文件

---

## 📝 **第 3 步: 配置并启动项目（2 分钟）**

1. 回到宝塔面板 → **Node 项目** → 找到 **sm-api-v2**
2. 点击 **"设置"**
3. 确认配置：
   ```
   项目路径: /www/wwwroot/sm-api-v2
   启动文件: dist/main.js
   端口: 5000
   启动方式: node
   ```
4. 点击 **"保存"**
5. 点击 **"启动"** 按钮

**预期结果**: 项目状态显示 "运行中"（绿色）

---

## 📝 **第 4 步: 开放防火墙端口（3 分钟）**

### 4.1 宝塔防火墙

在宝塔面板：

1. 左侧 → **"安全"** → **"系统防火墙"**
2. 点击 **"添加端口规则"**
3. 填写：
   ```
   端口: 5000
   说明: sm-api-v2新后端服务
   ```
4. 点击 **"放行"**

### 4.2 阿里云安全组

1. 访问: https://ecs.console.aliyun.com/
2. 找到 ECS 实例 → **"安全组"** → **"配置规则"**
3. 点击 **"添加安全组规则"**
4. 填写：
   ```
   协议类型: 自定义TCP
   端口范围: 5000/5000
   授权对象: 0.0.0.0/0
   描述: sm-api-v2新后端
   ```
5. 点击 **"确定"**

---

## 📝 **第 5 步: 验证 API（1 分钟）**

**我会在 Mac 本地执行这些测试，您无需操作**

```bash
# 测试1: 健康检查
curl http://121.43.139.147:5000/health

# 测试2: 版本检查
curl "http://121.43.139.147:5000/version/check?current=25.10.03.04"

# 测试3: 使用域名访问
curl http://api.shuzhishanmu.com:5000/health
```

---

## ✅ **完成标志**

您完成上述 4 步后，告诉我，我会：

1. ✅ 验证所有 API 接口正常
2. ✅ 修改移动应用 API 地址为新后端
3. ✅ 重新构建 APK（版本号保持 25.10.03.04）
4. ✅ 安装到您的测试设备
5. ✅ 测试所有功能（版本检查、打印功能）

---

## 🔧 **常见问题**

### Q1: npm install 很慢？

A: 已在脚本中配置了国内镜像，应该很快

### Q2: 构建失败？

A: 在终端查看错误信息，通常是依赖问题：

```bash
cd /www/wwwroot/sm-api-v2
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Q3: 启动失败？

A: 查看日志：

```bash
pm2 logs sm-api-v2 --lines 50
```

### Q4: 端口被占用？

A: 检查并修改端口：

```bash
netstat -tulpn | grep 5000
# 如果被占用，在宝塔面板改用其他端口（如5001）
```

---

## 📞 **需要帮助？**

遇到任何问题，请：

1. 截图错误信息
2. 告诉我在哪一步遇到问题
3. 我会立即帮您解决

---

**准备好了吗？开始第 1 步！** 🚀
