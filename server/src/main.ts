import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // 启用静态文件服务（用于托管APK下载）
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/downloads/',
  });
  
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','x-user-id','X-Requested-With'],
    exposedHeaders: ['Content-Length','Content-Type'],
  });
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5002; // 后端使用端口5002进行本地测试
  await app.listen(port, '0.0.0.0');
  console.log(`[Bootstrap] 后端服务已启动，端口: ${port}`);
  console.log(`[Bootstrap] APK下载地址: http://localhost:${port}/downloads/`);
}
bootstrap();
