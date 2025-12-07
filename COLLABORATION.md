# 多设备协作指南

## 🎯 协作机制

### **自动同步流程**
```
设备A开发 → 更新文档 → 提交GitHub → 设备B拉取 → Cursor自动理解
```

### **智能理解机制**
1. **项目结构变化** - 通过目录和文件变化自动识别
2. **代码功能变更** - 通过类型定义和注释理解
3. **文档更新同步** - 通过.cursor-context.md获取最新上下文
4. **配置环境统一** - 通过.vscode配置保持一致体验

## 📝 文档维护规范

### **何时更新.cursor-context.md**
- ✅ 新增功能模块
- ✅ 修改数据库结构
- ✅ 改变API接口
- ✅ 更新技术栈
- ✅ 修改开发流程

### **更新格式模板**
```markdown
## [功能名称] - [更新日期]
- **路径**: `相对路径`
- **功能**: 功能描述
- **技术栈**: 使用的技术
- **依赖**: 相关模块
- **注意事项**: 特殊说明

### 最后更新
- **时间**: YYYY-MM-DD
- **更新者**: 开发者名称
- **主要变更**: 变更摘要
```

## 🔄 协作工作流

### **开发新功能时**
1. **创建feature分支**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/新功能名
   ```

2. **开发过程中**
   - 及时更新相关文档
   - 添加必要的注释
   - 更新类型定义

3. **完成开发后**
   - 更新.cursor-context.md
   - 更新DEVELOPMENT.md (如有必要)
   - 提交完整的变更

4. **合并到develop**
   ```bash
   git checkout develop
   git merge feature/新功能名
   git push origin develop
   ```

### **其他设备同步**
```bash
# 拉取最新代码
git pull origin develop

# Cursor会自动读取更新后的配置和文档
# 无需额外操作
```

## 🤖 Cursor理解机制

### **自动理解的内容**
1. **项目架构** - 通过.cursor-context.md
2. **开发环境** - 通过.vscode配置
3. **代码结构** - 通过TypeScript类型和注释
4. **API接口** - 通过NestJS装饰器和Swagger
5. **数据库模型** - 通过Prisma schema

### **协作增强功能**
- **智能代码建议** - 基于项目上下文
- **自动导入路径** - 基于项目结构
- **调试配置同步** - 统一的调试体验
- **代码片段共享** - 团队通用模板

## 📋 实际协作场景

### **场景1：设备A添加新API**
```typescript
// server/src/user/user.controller.ts
@Post('batch-update')
async batchUpdateUsers(@Body() data: BatchUpdateDto) {
  return this.userService.batchUpdate(data);
}
```

**设备A需要做的**：
1. 开发新API
2. 更新.cursor-context.md：
   ```markdown
   ### 用户管理 - 2024-09-25
   - **新增**: 批量更新用户API
   - **路径**: `POST /users/batch-update`
   - **功能**: 支持批量更新用户信息
   ```
3. 提交代码

**设备B拉取后**：
- Cursor自动理解新API结构
- 代码提示包含新的接口
- 可以直接使用相关功能

### **场景2：设备B修改数据库模型**
```prisma
// server/prisma/schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  email     String   @unique
  avatar    String?  // 新增字段
  createdAt DateTime @default(now())
}
```

**设备B需要做的**：
1. 修改Prisma模型
2. 更新.cursor-context.md数据库部分
3. 运行数据库迁移
4. 提交变更

**设备A拉取后**：
- Cursor理解新的数据库结构
- TypeScript类型自动更新
- API提示包含新字段

## 🛠️ 维护工具

### **自动化检查脚本**
```bash
#!/bin/bash
# check-docs.sh - 检查文档是否需要更新

echo "🔍 检查项目变更..."

# 检查是否有新文件
NEW_FILES=$(git diff --name-status HEAD~1 | grep "^A" | wc -l)
if [ $NEW_FILES -gt 0 ]; then
    echo "⚠️  发现新文件，请考虑更新.cursor-context.md"
fi

# 检查是否有数据库变更
if git diff --name-only HEAD~1 | grep -q "prisma/schema.prisma"; then
    echo "⚠️  数据库模型有变更，请更新文档"
fi

echo "✅ 检查完成"
```

### **文档模板生成器**
```bash
#!/bin/bash
# generate-doc-template.sh

FEATURE_NAME=$1
DATE=$(date +%Y-%m-%d)

cat << EOF
## ${FEATURE_NAME} - ${DATE}
- **路径**: \`请填写路径\`
- **功能**: 请描述功能
- **技术栈**: 请列出使用的技术
- **依赖**: 请列出相关模块
- **注意事项**: 请添加特殊说明

### API接口 (如适用)
- **GET** /api/endpoint - 描述
- **POST** /api/endpoint - 描述

### 数据库变更 (如适用)
- 新增表: table_name
- 修改字段: field_name

### 最后更新
- **时间**: ${DATE}
- **更新者**: 请填写姓名
- **主要变更**: 请描述主要变更
EOF
```

## 🎯 协作效果

### **预期效果**
1. **快速上手** - 新设备打开项目即可理解全貌
2. **智能提示** - 基于最新项目状态的代码建议
3. **统一体验** - 所有设备保持一致的开发环境
4. **知识共享** - 通过文档传递开发经验和注意事项

### **协作指标**
- 📈 **理解速度** - 新设备5分钟内理解项目结构
- 🎯 **开发效率** - 减少50%的环境配置时间
- 🔄 **同步准确性** - 99%的变更能被正确理解
- 📚 **知识传递** - 重要决策和经验都有文档记录

---

**通过这套协作机制，每台设备的Cursor都能快速理解项目的最新状态，实现真正的多设备无缝协作！** 🚀
