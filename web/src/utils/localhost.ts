/**
 * 检测是否为 localhost 环境
 */
export function isLocalhost(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const hostname = window.location.hostname;
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')
    );
}

/**
 * 为 localhost 环境设置默认用户信息
 */
export function setupLocalhostUser(): void {
    if (!isLocalhost()) {
        return;
    }

    // 如果已经有用户信息，不覆盖
    if (localStorage.getItem('userId')) {
        return;
    }

    // 设置默认用户信息（使用一个默认的 userId，比如 1）
    localStorage.setItem('userId', '1');
    localStorage.setItem('displayName', '本地开发用户');
    localStorage.setItem('sessionToken', 'localhost-dev-token');

    console.log('[Localhost] 已自动设置本地开发用户信息');
}

