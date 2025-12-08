import { NextRequest, NextResponse } from 'next/server';

// 后端服务地址配置
// Docker 环境：通过容器名称访问
// 本地开发：使用 localhost
const BACKEND_URL = process.env.API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'http://api:5000'  // Docker 环境
    : 'http://127.0.0.1:5002');  // 本地开发

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
  const REQUEST_TIMEOUT = 10000; // 10秒超时

  try {
    const path = pathSegments.join('/');
    const url = `${BACKEND_URL}/${path}`;

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    console.log(`[API Proxy] ${method} ${fullUrl}`);

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
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        body = await request.text();
      } catch (e) {
        // 忽略body解析错误
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

    // 记录慢请求
    if (duration > 5000) {
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

    if (error.message && error.message.includes('超时')) {
      console.error(`[API Proxy] 请求超时: ${method} ${pathSegments.join('/')} (耗时: ${duration}ms, 超时限制: ${REQUEST_TIMEOUT}ms)`);
      return NextResponse.json(
        {
          error: '请求超时',
          message: `后端服务响应超时 (${REQUEST_TIMEOUT}ms)，请稍后重试`,
          timeout: REQUEST_TIMEOUT,
          duration
        },
        { status: 504 } // Gateway Timeout
      );
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      console.error(`[API Proxy] 连接被拒绝: ${method} ${pathSegments.join('/')} - 后端服务可能未启动`);
      return NextResponse.json(
        {
          error: '连接失败',
          message: '无法连接到后端服务，请检查服务是否正常运行',
          backendUrl: BACKEND_URL
        },
        { status: 503 } // Service Unavailable
      );
    } else {
      console.error(`[API Proxy] 请求错误: ${method} ${pathSegments.join('/')} - ${error.message} (耗时: ${duration}ms)`);
      return NextResponse.json(
        {
          error: '代理请求失败',
          message: error.message || '未知错误',
          duration
        },
        { status: 500 }
      );
    }
  }
}




