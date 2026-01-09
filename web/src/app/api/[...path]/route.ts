import { NextRequest, NextResponse } from 'next/server';

// 后端服务地址配置
// Docker 环境：通过容器名称访问
// 本地开发：使用 localhost
function getBackendUrl(): string {
  // 优先使用环境变量
  if (process.env.API_URL) {
    return process.env.API_URL;
  }

  // 生产环境使用容器名称
  if (process.env.NODE_ENV === 'production') {
    return 'http://api:5000';
  }

  // 本地开发环境
  return 'http://127.0.0.1:5002';
}

const BACKEND_URL = getBackendUrl();

// 在启动时记录配置（仅生产环境）
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  console.log('[API Proxy] 后端地址配置:', BACKEND_URL);
  console.log('[API Proxy] NODE_ENV:', process.env.NODE_ENV);
  console.log('[API Proxy] API_URL:', process.env.API_URL || '未设置');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE');
}

// 带超时的 fetch 封装
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`请求超时 (${timeoutMs}ms)`);
    }
    throw error;
  }
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  const startTime = Date.now();
  const path = pathSegments.join('/');

  // 对于长时间运行的请求，设置更长的超时时间
  // generate-bill: 5分钟（存储过程）
  // supplier-names: 30秒（供应商名称查询，可能需要较长时间）
  // 其他请求保持10秒超时
  let REQUEST_TIMEOUT = 10000; // 默认10秒
  if (path.includes('generate-bill')) {
    REQUEST_TIMEOUT = 300000; // 5分钟
  } else if (path.includes('supplier-names')) {
    REQUEST_TIMEOUT = 30000; // 30秒
  }

  try {
    const url = `${BACKEND_URL}/${path}`;

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    // 记录请求信息（生产环境记录首次请求的配置）
    const isFirstRequest = !(global as any).__api_proxy_initialized;
    if (isFirstRequest) {
      (global as any).__api_proxy_initialized = true;
      console.log(`[API Proxy] ========== 初始化配置 ==========`);
      console.log(`[API Proxy] 后端地址: ${BACKEND_URL}`);
      console.log(`[API Proxy] NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`[API Proxy] API_URL: ${process.env.API_URL || '未设置'}`);
      console.log(`[API Proxy] ===============================`);
    }

    // 开发环境详细日志
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[API Proxy] ${method} ${fullUrl}`);
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // 转发用户ID头部
    const userId = request.headers.get('x-user-id');
    if (userId) {
      headers['x-user-id'] = userId;
    }

    // 转发 Authorization 头部
    const auth = request.headers.get('authorization');
    if (auth) {
      headers['Authorization'] = auth;
    }

    let body = undefined;
    if (method !== 'GET') {
      try {
        body = await request.text();
        // 记录 DELETE 请求的 body（所有环境）
        if (method === 'DELETE') {
          console.log(`[API Proxy] DELETE 请求 body:`, body);
          console.log(`[API Proxy] DELETE 请求 body 长度:`, body?.length || 0);
          console.log(`[API Proxy] DELETE 请求 path:`, path);
        }
      } catch (e) {
        // 记录 body 解析错误
        if (method === 'DELETE') {
          console.error(`[API Proxy] DELETE 请求 body 解析失败:`, e);
        }
      }
    }

    // 使用带超时的 fetch
    const response = await fetchWithTimeout(fullUrl, {
      method,
      headers,
      body,
    }, REQUEST_TIMEOUT);

    const data = await response.text();
    const duration = Date.now() - startTime;

    // 开发环境记录所有请求详情
    if (process.env.NODE_ENV !== 'production') {
      if (response.status >= 400) {
        console.error(`[API Proxy] 错误响应: ${method} ${fullUrl}`);
        console.error(`[API Proxy] 状态码: ${response.status}`);
        console.error(`[API Proxy] 响应内容: ${data.substring(0, 500)}`); // 限制输出长度
      } else if (duration > 3000) {
        console.warn(`[API Proxy] 慢请求: ${method} ${fullUrl} 耗时 ${duration}ms`);
      } else {
        console.log(`[API Proxy] ✓ 请求成功: ${method} ${fullUrl} (${response.status}) 耗时 ${duration}ms`);
      }
    } else if (duration > 3000) {
      // 生产环境只记录慢请求
      console.warn(`[API Proxy] 慢请求: ${method} ${fullUrl} 耗时 ${duration}ms`);
    }

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const path = pathSegments.join('/');
    const fullUrl = `${BACKEND_URL}/${path}`;

    // 详细的错误日志
    console.error(`[API Proxy] ========== 请求失败 ==========`);
    console.error(`[API Proxy] 方法: ${method}`);
    console.error(`[API Proxy] 路径: ${path}`);
    console.error(`[API Proxy] 完整URL: ${fullUrl}`);
    console.error(`[API Proxy] 后端地址: ${BACKEND_URL}`);
    console.error(`[API Proxy] 错误类型: ${error?.name || 'Unknown'}`);
    console.error(`[API Proxy] 错误消息: ${error?.message || '无消息'}`);
    console.error(`[API Proxy] 错误代码: ${error?.code || '无代码'}`);
    console.error(`[API Proxy] 错误堆栈: ${error?.stack || '无堆栈'}`);
    console.error(`[API Proxy] 耗时: ${duration}ms`);
    console.error(`[API Proxy] ===============================`);

    if (error.message && error.message.includes('超时')) {
      console.error(`[API Proxy] 请求超时: ${method} ${path} (耗时: ${duration}ms, 超时限制: ${REQUEST_TIMEOUT}ms)`);
      return NextResponse.json(
        {
          error: '请求超时',
          message: `后端服务响应超时 (${REQUEST_TIMEOUT}ms)，请稍后重试`,
          timeout: REQUEST_TIMEOUT,
          duration,
          path,
          backendUrl: BACKEND_URL
        },
        { status: 504 } // Gateway Timeout
      );
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      console.error(`[API Proxy] 连接被拒绝: ${method} ${path} - 后端服务可能未启动`);
      console.error(`[API Proxy] 请检查后端服务是否运行在: ${BACKEND_URL}`);
      return NextResponse.json(
        {
          error: '连接失败',
          message: '无法连接到后端服务，请检查服务是否正常运行',
          backendUrl: BACKEND_URL,
          path,
          suggestion: '请确认后端服务已启动并监听在正确端口'
        },
        { status: 503 } // Service Unavailable
      );
    } else {
      console.error(`[API Proxy] 请求错误: ${method} ${path} - ${error.message} (耗时: ${duration}ms)`);
      return NextResponse.json(
        {
          error: '代理请求失败',
          message: error.message || '未知错误',
          errorCode: error?.code,
          errorType: error?.name,
          duration,
          path,
          backendUrl: BACKEND_URL
        },
        { status: 500 }
      );
    }
  }
}




