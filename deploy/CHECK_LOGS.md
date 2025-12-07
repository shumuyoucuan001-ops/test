# 检查后端日志

请在宝塔终端执行以下命令，查看后端日志：

```bash
# 方法1：如果使用宝塔的日志文件
tail -100 /www/wwwlogs/sm-api-v2.log | grep -E "(Template|Playwright|FALLBACK|htmlToTspl|rendering|Browser)"

# 方法2：如果使用PM2
pm2 logs sm-api-v2 --lines 100 | grep -E "(Template|Playwright|FALLBACK|htmlToTspl|rendering|Browser)"

# 方法3：查找Node进程并查看输出
ps aux | grep "node.*sm-api-v2"

# 方法4：实时查看日志
tail -f /www/wwwlogs/sm-api-v2.log
```

然后在移动设备上**打印一次**，再查看日志输出。

请将日志截图发给我！

