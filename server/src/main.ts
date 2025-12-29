import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { Logger } from './utils/logger.util';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // 确保所有 HTTP 方法（包括 DELETE）都能正确解析 JSON body，并放宽请求体大小限制以支持图片等大字段
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 启用静态文件服务（用于托管APK下载）
    app.useStaticAssets(join(__dirname, '..', 'public'), {
      prefix: '/downloads/',
    });

    app.enableCors({
      origin: true, // 允许所有来源（生产环境建议配置具体域名）
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
    });

    // 添加 CORS 日志（开发环境）
    if (process.env.NODE_ENV !== 'production') {
      Logger.log('[Bootstrap] CORS 已启用，允许所有来源');
    }
    const port = process.env.PORT ? parseInt(process.env.PORT) : 5002; // 后端使用端口5002进行本地测试
    await app.listen(port, '0.0.0.0');
    Logger.log(`[Bootstrap] 后端服务已启动，端口: ${port}`);
    Logger.log(`[Bootstrap] APK下载地址: http://localhost:${port}/downloads/`);
  } catch (error: any) {
    // 只记录错误消息，不记录完整的错误对象和堆栈，避免暴露敏感信息
    Logger.error('[Bootstrap] 启动失败:', error?.message || '未知错误');
    if (error?.code) {
      Logger.error('[Bootstrap] 错误代码:', error.code);
    }
    process.exit(1);
  }
}

// 添加全局未捕获异常处理
process.on('uncaughtException', (error: Error) => {
  // 只记录错误消息，不记录完整的错误对象和堆栈，避免暴露敏感信息
  Logger.error('[UncaughtException] 未捕获的异常:', error.message || '未知错误');
  if (error.name) {
    Logger.error('[UncaughtException] 错误类型:', error.name);
  }
  // 不立即退出，让应用继续运行以便记录更多信息
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  Logger.error('[UnhandledRejection] 未处理的Promise拒绝:', reason);
  Logger.error('[UnhandledRejection] Promise:', promise);
});

bootstrap();
