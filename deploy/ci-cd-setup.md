# 🔄 CI/CD自动化部署

## 📋 GitHub Actions配置

### 1. 创建工作流文件
在项目根目录创建 `.github/workflows/deploy.yml`

### 2. 自动化部署配置

#### 开发环境部署 (develop分支)
```yaml
name: Deploy to Development

on:
  push:
    branches: [ develop ]
  pull_request:
    branches: [ develop ]

jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies (Server)
      run: |
        cd server
        npm ci
    
    - name: Install dependencies (Web)
      run: |
        cd web
        npm ci
    
    - name: Run tests
      run: |
        cd server
        npm test
    
    - name: Build application
      run: |
        cd web
        npm run build
    
    - name: Deploy to Development Server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.DEV_HOST }}
        username: ${{ secrets.DEV_USERNAME }}
        key: ${{ secrets.DEV_SSH_KEY }}
        script: |
          cd /var/www/shumu-dev
          git pull origin develop
          docker-compose down
          docker-compose up -d --build
```

#### 生产环境部署 (main分支)
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  release:
    types: [ published ]

jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install and test
      run: |
        cd server && npm ci && npm test
        cd ../web && npm ci && npm run build
    
    - name: Create Release Tag
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git tag -a v$(date +%Y%m%d-%H%M%S) -m "Auto release $(date)"
        git push origin --tags
    
    - name: Deploy to Production Server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.PROD_HOST }}
        username: ${{ secrets.PROD_USERNAME }}
        key: ${{ secrets.PROD_SSH_KEY }}
        script: |
          cd /var/www/shumu-prod
          git pull origin main
          docker-compose down
          docker-compose up -d --build
          
    - name: Health Check
      run: |
        sleep 30
        curl -f http://${{ secrets.PROD_HOST }}/api/health || exit 1
```

## 🔐 GitHub Secrets配置

在GitHub仓库设置中添加以下Secrets：

### 开发环境
- `DEV_HOST`: 开发服务器IP
- `DEV_USERNAME`: SSH用户名
- `DEV_SSH_KEY`: SSH私钥

### 生产环境
- `PROD_HOST`: 生产服务器IP
- `PROD_USERNAME`: SSH用户名
- `PROD_SSH_KEY`: SSH私钥

## 🚀 部署流程

### 日常开发流程
```bash
# 1. 创建功能分支
git checkout develop
git checkout -b feature/新功能

# 2. 开发代码
# ... 编写代码 ...

# 3. 提交代码
git add .
git commit -m "feat: 添加新功能"

# 4. 推送到GitHub
git push origin feature/新功能

# 5. 创建Pull Request到develop分支
# 6. 代码审查通过后合并
# 7. 自动部署到开发环境
```

### 发布流程
```bash
# 1. 从develop创建release分支
git checkout develop
git checkout -b release/v1.1.0

# 2. 最终测试和bug修复
# ... 修复bug ...

# 3. 合并到main分支
git checkout main
git merge release/v1.1.0

# 4. 推送到GitHub
git push origin main

# 5. 自动部署到生产环境
# 6. 创建GitHub Release
```

## 📊 监控和通知

### Slack通知配置
```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    channel: '#deployments'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
  if: always()
```

### 邮件通知
```yaml
- name: Send Email
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: "部署状态: ${{ job.status }}"
    to: admin@yourcompany.com
    from: noreply@yourcompany.com
    body: "部署到 ${{ github.ref }} 分支的状态: ${{ job.status }}"
  if: failure()
```
