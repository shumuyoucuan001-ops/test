# 🔄 多设备安全同步指南

## 🎯 适用场景
- 多台设备同时开发
- 需要同步特定更新但保护本地开发成果
- 避免覆盖重要的开发进度

## 🛡️ 安全同步策略

### 方案A：完整分支合并（推荐）

#### 1. 保存当前工作
```bash
# 查看当前状态
git status

# 提交所有更改
git add .
git commit -m "保存开发进度 - $(date)"
```

#### 2. 创建安全备份
```bash
# 创建备份分支
git checkout -b backup/work-$(date +%Y%m%d-%H%M)

# 推送备份（推荐）
git push origin backup/work-$(date +%Y%m%d-%H%M)

# 返回开发分支
git checkout develop
```

#### 3. 安全合并远程更新
```bash
# 获取远程更新
git fetch origin

# 预览即将合并的内容
git log HEAD..origin/develop --oneline
git diff HEAD..origin/develop --name-only

# 合并更新
git merge origin/develop
```

#### 4. 处理冲突（如果有）
```bash
# 查看冲突文件
git status

# 使用编辑器解决冲突
# 保留你的更改，合并新功能

# 标记冲突已解决
git add <冲突文件>
git commit -m "解决合并冲突"
```

### 方案B：选择性文件同步（保守）

#### 1. 获取远程更新
```bash
git fetch origin
```

#### 2. 选择性检出文件
```bash
# 只同步特定文件
git checkout origin/develop -- DATABASE_SETUP.md
git checkout origin/develop -- .cursor-context.md
git checkout origin/develop -- server/.env.example

# 提交同步的文件
git add .
git commit -m "同步数据库配置文件"
```

#### 3. 手动配置
```bash
# 配置数据库
cd server
cp .env.example .env
npm install
npx prisma generate
```

## 🚨 紧急恢复方案

### 如果同步出现问题：

#### 恢复到备份分支
```bash
# 切换到备份分支
git checkout backup/work-YYYYMMDD-HHMM

# 创建新的工作分支
git checkout -b develop-recovered

# 重新开始同步过程
```

#### 重置到远程状态
```bash
# ⚠️ 警告：这会丢失本地更改
git fetch origin
git reset --hard origin/develop
git clean -fd
```

## 📋 同步检查清单

### 同步前检查
- [ ] 当前工作已提交
- [ ] 创建了备份分支
- [ ] 了解即将合并的内容

### 同步后验证
- [ ] 数据库配置文件存在
- [ ] 服务可以正常启动
- [ ] 之前的开发功能正常
- [ ] 新的数据库配置生效

### 数据库配置验证
```bash
# 检查配置文件
ls -la server/.env*

# 测试数据库连接
cd server
npm start

# 验证Prisma客户端
npx prisma studio
```

## 💡 最佳实践

### 日常开发
1. **频繁提交** - 小步快跑，避免大量未提交更改
2. **定期同步** - 每天开始工作前先同步
3. **分支命名** - 使用有意义的分支名称
4. **备份重要工作** - 重要功能开发完成后立即推送

### 团队协作
1. **沟通优先** - 重大更改前通知团队
2. **文档更新** - 及时更新项目文档
3. **测试验证** - 同步后验证功能完整性
4. **冲突解决** - 优先保留业务逻辑，合并配置更新

## 🔧 常用命令速查

```bash
# 查看状态
git status
git log --oneline -5

# 安全备份
git checkout -b backup/$(date +%Y%m%d-%H%M)

# 预览更新
git fetch origin
git log HEAD..origin/develop --oneline

# 安全合并
git merge origin/develop

# 选择性同步
git checkout origin/develop -- <文件路径>

# 紧急恢复
git reset --hard HEAD~1  # 撤销最后一次提交
git clean -fd            # 清理未跟踪文件
```

---

## 🆘 遇到问题？

1. **不确定如何操作** - 先创建备份分支
2. **合并冲突复杂** - 使用选择性文件同步
3. **数据库连接失败** - 检查 `DATABASE_SETUP.md`
4. **服务启动异常** - 重新生成 Prisma 客户端

记住：**安全第一，备份为王！** 🛡️
