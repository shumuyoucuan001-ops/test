/**
 * 统一日志工具
 * 自动为所有日志添加时间戳
 */

export class Logger {
    /**
     * 格式化时间戳（东八区 UTC+8）
     */
    private static formatTimestamp(): string {
        const now = new Date();
        // getTime() 返回的是UTC时间戳（毫秒），直接加上8小时（8 * 60 * 60 * 1000）
        const beijingTimestamp = now.getTime() + (8 * 60 * 60 * 1000);
        const beijingTime = new Date(beijingTimestamp);

        // 使用UTC方法获取东八区时间（因为时间戳已经是UTC+8了）
        const year = beijingTime.getUTCFullYear();
        const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(beijingTime.getUTCDate()).padStart(2, '0');
        const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
        const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(beijingTime.getUTCMilliseconds()).padStart(3, '0');
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

