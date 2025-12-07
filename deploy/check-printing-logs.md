# 检查打印日志

请在宝塔终端执行以下命令，然后将输出发给我：

```bash
# 1. 查看最近的打印相关日志
cd /www/wwwroot/sm-api-v2
pm2 logs sm-api-v2 --lines 100 | grep -E "(Template|Playwright|FALLBACK|htmlToTspl|rendering)"

# 2. 清空日志，然后重新测试打印
pm2 flush sm-api-v2

# 3. 在移动设备上打印一次，然后立即查看日志
pm2 logs sm-api-v2 --lines 50
```

请执行这些命令并将输出发给我。

