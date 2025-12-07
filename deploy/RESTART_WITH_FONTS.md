# 重启服务并应用字体

## 步骤 1：停止占用 5000 端口的进程

```bash
# 查找占用5000端口的进程
netstat -tlnp | grep 5000

# 假设PID是48689（从日志中看到的）
kill 48689

# 或者直接杀掉所有sm-api-v2进程
pkill -f "node.*sm-api-v2"
pkill -f "node.*dist/main.js"

# 确认端口已释放
netstat -tlnp | grep 5000
```

## 步骤 2：刷新字体缓存

```bash
# 设置字体文件权限
chmod 644 /usr/share/fonts/truetype/chinese/*

# 刷新字体缓存
fc-cache -fv

# 验证中文字体
fc-list :lang=zh
fc-list | grep -i "wqy\|microhei\|source"
```

## 步骤 3：重启服务

```bash
cd /www/wwwroot/sm-api-v2
node dist/main.js > /tmp/sm-api-v2.log 2>&1 &

# 等待启动
sleep 3

# 测试API
curl http://127.0.0.1:5000/health

# 查看启动日志
tail -50 /tmp/sm-api-v2.log
```

## 步骤 4：测试打印

在移动设备上打印一次，中文应该能正常显示了！

如果还有问题，查看日志：

```bash
tail -f /tmp/sm-api-v2.log
```

然后在移动设备上打印，观察日志输出。

