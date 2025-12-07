# 重启服务并测试打印

## ✅ Playwright 已成功安装！

Chromium 版本：140.0.7339.186

## 下一步：重启服务

### 方法 1：使用宝塔面板（推荐）

1. 打开宝塔面板
2. 找到 "网站" 或 "Node 项目" 菜单
3. 找到 `sm-api-v2` 项目
4. 点击 **"重启"** 按钮

### 方法 2：使用命令行

如果宝塔面板没有 PM2 管理，在终端执行：

```bash
# 查找并重启Node进程
cd /www/wwwroot/sm-api-v2
pkill -f "node.*sm-api-v2"
nohup node dist/main.js > /www/wwwlogs/sm-api-v2.log 2>&1 &
```

或者如果有 PM2：

```bash
pm2 restart sm-api-v2
pm2 logs sm-api-v2 --lines 20
```

## 验证服务

```bash
# 检查服务是否运行
curl http://127.0.0.1:5000/health

# 查看日志（如果使用nohup）
tail -f /www/wwwlogs/sm-api-v2.log
```

## 测试打印

1. 在移动设备上打开 App
2. 进入收货单打印界面
3. 选择一个收货单
4. 点击打印
5. 查看打印结果

**预期结果：**

- 打印内容应该显示正确的 HTML 模板渲染结果
- 不再显示 "FALLBACK" 和 "320x240" 文字
- 标签内容完整、清晰

如果打印内容正确，说明问题已完全解决！🎊

