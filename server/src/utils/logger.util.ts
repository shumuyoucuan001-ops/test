/**
 * 统一日志工具
 * 自动为所有日志添加时间戳
 */

export class Logger {
    /**
     * 格式化时间戳
     */
    private static formatTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * 格式化日志消息
     */
    private static formatMessage(tag: string, ...args: any[]): any[] {
        const timestamp = this.formatTimestamp();
        return [`[${timestamp}] ${tag}`, ...args];
    }

    /**
     * 普通日志
     */
    static log(tag: string, ...args: any[]): void {
        console.log(...this.formatMessage(tag, ...args));
    }

    /**
     * 错误日志
     */
    static error(tag: string, ...args: any[]): void {
        console.error(...this.formatMessage(tag, ...args));
    }

    /**
     * 警告日志
     */
    static warn(tag: string, ...args: any[]): void {
        console.warn(...this.formatMessage(tag, ...args));
    }

    /**
     * 信息日志
     */
    static info(tag: string, ...args: any[]): void {
        console.info(...this.formatMessage(tag, ...args));
    }
}

