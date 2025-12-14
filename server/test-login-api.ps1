# 登录API测试脚本
# 用于诊断登录500错误

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "登录API诊断测试" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 测试后端健康检查
Write-Host "1. 测试后端健康检查..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:5002/health" -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✓ 健康检查成功: $($healthResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   响应内容: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ 健康检查失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   请确保后端服务正在运行在端口5002" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 测试登录接口（使用测试账号）
Write-Host "2. 测试登录接口..." -ForegroundColor Yellow
$loginData = @{
    username = "test"
    password = "test123"
} | ConvertTo-Json

try {
    Write-Host "   发送登录请求: POST http://localhost:5002/acl/login" -ForegroundColor Gray
    Write-Host "   请求体: $loginData" -ForegroundColor Gray
    
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:5002/acl/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginData `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "   ✓ 登录请求成功: $($loginResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   响应内容: $($loginResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ 登录请求失败" -ForegroundColor Red
    Write-Host "   状态码: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    
    # 尝试读取错误响应
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   错误响应: $responseBody" -ForegroundColor Red
    } catch {
        Write-Host "   错误信息: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "   请检查:" -ForegroundColor Yellow
    Write-Host "   1. 后端控制台是否有错误日志" -ForegroundColor Yellow
    Write-Host "   2. 数据库连接是否正常" -ForegroundColor Yellow
    Write-Host "   3. sys_users表是否存在以及字段是否完整" -ForegroundColor Yellow
    Write-Host "   4. 用户名和密码是否正确" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "测试完成" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

