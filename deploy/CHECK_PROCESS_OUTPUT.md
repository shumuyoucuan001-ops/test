# 检查进程输出

服务正在运行，但没有日志文件。让我们查看进程详情：

```bash
# 1. 查看进程详细信息
ps -ef | grep "47669"

# 2. 查看进程的文件描述符（stdout/stderr重定向到哪里）
ls -l /proc/47669/fd/

# 3. 查看启动脚本
cat /www/wwwroot/sm-api-v2/sm-api-v2_start.sh 2>/dev/null || echo "启动脚本不存在"

# 4. 直接测试打印API并查看console输出
# 先获取一个收货单ID
curl http://127.0.0.1:5000/api/receipt | head -20

# 5. 停止当前进程，手动启动以查看输出
kill 47669
cd /www/wwwroot/sm-api-v2
node dist/main.js 2>&1 | tee /tmp/sm-api-v2-manual.log &

# 6. 等待3秒后测试
sleep 3
curl http://127.0.0.1:5000/health

# 7. 在移动设备上打印一次，然后查看日志
tail -f /tmp/sm-api-v2-manual.log
```

请先执行命令 1、2、3，然后告诉我输出！

