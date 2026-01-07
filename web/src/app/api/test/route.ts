import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 测试访问后端API
    const response = await fetch('http://localhost:3000/acl/users');
    const data = await response.json();

    return NextResponse.json({
      success: true,
      backendStatus: response.status,
      userCount: data.length,
      firstUser: data[0]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}




