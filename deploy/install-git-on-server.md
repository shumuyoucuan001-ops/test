# 在阿里云服务器上安装 Git

## 方法 1：使用 yum 安装（推荐）

```bash
# 安装git
yum install -y git

# 验证安装
git --version
```

## 方法 2：如果 yum 不可用，使用 apt

```bash
# 更新包列表
apt update

# 安装git
apt install -y git

# 验证安装
git --version
```

## 安装成功后的预期输出

```
git version 2.x.x
```

## 然后继续部署

```bash
# 1. 进入www目录
cd /www/wwwroot

# 2. 删除旧目录
rm -rf sm-api-v2 sm-api-v2-temp

# 3. 克隆代码
git clone -b develop https://github.com/xuxiang6/shumu.git sm-api-v2-temp

# 4. 使用server目录
mv sm-api-v2-temp/server sm-api-v2
rm -rf sm-api-v2-temp

# 5. 进入项目
cd sm-api-v2

# 6. 安装依赖
/www/server/nodejs/v20.19.5/bin/npm install

# 7. 生成Prisma Client
/www/server/nodejs/v20.19.5/bin/npx prisma generate

# 8. 运行数据库迁移
/www/server/nodejs/v20.19.5/bin/npx prisma migrate deploy

# 9. 构建项目
/www/server/nodejs/v20.19.5/bin/npm run build

# 10. 检查结果
echo ""
echo "========================================="
echo "✅ 检查构建结果："
ls -lh dist/main.js && echo "✅ main.js 已生成！" || echo "❌ main.js 未找到"
echo "========================================="
```
