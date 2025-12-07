# 检查服务状态

日志文件不存在，说明服务可能没有正确启动或输出位置不对。

## 请在宝塔终端执行以下命令：

```bash
# 1. 检查服务是否在运行
ps aux | grep "node.*sm-api-v2"

# 2. 检查5000端口是否被监听
netstat -tlnp | grep 5000

# 3. 测试API是否响应
curl http://127.0.0.1:5000/health

# 4. 检查宝塔Node项目配置
ls -la /www/wwwroot/sm-api-v2/

# 5. 查看是否有其他日志文件
find /www/wwwroot/sm-api-v2 -name "*.log" -type f

# 6. 尝试手动启动并查看错误
cd /www/wwwroot/sm-api-v2
node dist/main.js
```

请将命令 1、2、3、4 的输出截图发给我！

如果命令 6（手动启动）有输出，也请截图。

