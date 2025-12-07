# 测试打印 API

让我们直接测试打印 API，看看输出：

```bash
# 1. 停止当前服务
kill 47669

# 2. 手动启动服务，输出到文件
cd /www/wwwroot/sm-api-v2
node dist/main.js > /tmp/sm-api-v2.log 2>&1 &

# 3. 等待启动
sleep 3

# 4. 测试健康检查
curl http://127.0.0.1:5000/health

# 5. 在移动设备上打印一次

# 6. 查看日志
cat /tmp/sm-api-v2.log | grep -E "(Template|Playwright|FALLBACK|Browser|rendering)" | tail -50

# 如果上面没有输出，查看完整日志
cat /tmp/sm-api-v2.log | tail -100
```

请执行这些命令，然后**在移动设备上打印一次**，再执行命令 6 查看日志！

