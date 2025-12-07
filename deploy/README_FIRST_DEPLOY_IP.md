IP直连版首发上线（无域名/无HTTPS）

前提
- 服务器已安装 Docker 与 Docker Compose（或 Compose v2 内置 docker compose）。

1. 上传代码并进入目录
```bash
ssh root@<ECS_IP>
mkdir -p /opt/chesi1 && cd /opt/chesi1
# 把本项目上传或 git clone 到此目录
```

2. 准备环境变量
```bash
cd /opt/chesi1
cp .env.example .env
# 编辑 .env，至少填好：
#   DATABASE_URL=mysql://<USERNAME>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>
#   PORT=3000
#   API_PORT=4000
```

3. 一键构建并启动（80 映射到容器 3000）
```bash
docker compose build --no-cache
docker compose up -d
```

4. 访问
- 浏览器打开: http://<ECS_IP>

常见问题
- 首次构建较久：耐心等待。可用 `docker compose logs -f app` 查看日志。
- 端口被占用：确认服务器 80 未被其它服务占用。

升级/重启
```bash
docker compose pull || true
docker compose build
docker compose up -d
```

停止/卸载
```bash
docker compose down
```


