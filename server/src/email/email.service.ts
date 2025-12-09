import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface SmtpAccount {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    transporter: nodemailer.Transporter;
}

@Injectable()
export class EmailService {
    private accounts: SmtpAccount[] = [];
    private currentIndex: number = 0;

    constructor() {
        this.initializeAccounts();
    }

    /**
     * 初始化邮件账号（支持多个账号）
     */
    private initializeAccounts() {
        const smtpHost = process.env.SMTP_HOST || 'smtp.qq.com';
        const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

        // 支持多个账号配置
        // 方式1：使用 SMTP_USER 和 SMTP_PASS（单个账号，向后兼容）
        const smtpUser = process.env.SMTP_USER || '';
        const smtpPass = process.env.SMTP_PASS || '';

        // 方式2：使用 SMTP_ACCOUNTS（多个账号，JSON格式）
        // 格式：SMTP_ACCOUNTS='[{"user":"email1@qq.com","pass":"auth1","from":"email1@qq.com"},{"user":"email2@qq.com","pass":"auth2","from":"email2@qq.com"}]'
        let smtpAccounts: Array<{ user: string; pass: string; from?: string }> = [];

        try {
            if (process.env.SMTP_ACCOUNTS) {
                smtpAccounts = JSON.parse(process.env.SMTP_ACCOUNTS);
            }
        } catch (e) {
            console.warn('[EmailService] SMTP_ACCOUNTS 解析失败，使用单个账号配置');
        }

        // 如果配置了多个账号，使用多个账号
        if (smtpAccounts.length > 0) {
            console.log(`[EmailService] 检测到 ${smtpAccounts.length} 个邮件账号配置`);
            smtpAccounts.forEach((account, index) => {
                if (account.user && account.pass) {
                    const transporter = nodemailer.createTransport({
                        host: smtpHost,
                        port: smtpPort,
                        secure: smtpPort === 465,
                        auth: {
                            user: account.user,
                            pass: account.pass,
                        },
                    });
                    this.accounts.push({
                        host: smtpHost,
                        port: smtpPort,
                        user: account.user,
                        pass: account.pass,
                        from: account.from || account.user,
                        transporter,
                    });
                    console.log(`[EmailService] 账号 ${index + 1} 初始化：${account.user}`);
                }
            });
        } else if (smtpUser && smtpPass) {
            // 单个账号配置（向后兼容）
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            });
            this.accounts.push({
                host: smtpHost,
                port: smtpPort,
                user: smtpUser,
                pass: smtpPass,
                from: process.env.SMTP_FROM || smtpUser,
                transporter,
            });
            console.log(`[EmailService] 单个账号初始化：${smtpUser}`);
        }

        if (this.accounts.length === 0) {
            console.warn('[EmailService] 未配置任何邮件账号，邮件发送功能将不可用');
        } else {
            console.log(`[EmailService] 邮件服务初始化完成，共 ${this.accounts.length} 个账号`);
        }
    }

    /**
     * 获取下一个可用的邮件账号（轮询方式）
     */
    private getNextAccount(): SmtpAccount {
        if (this.accounts.length === 0) {
            throw new Error('未配置邮件账号');
        }
        const account = this.accounts[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.accounts.length;
        return account;
    }

    /**
     * 发送邮件
     * @param to 收件人邮箱
     * @param subject 邮件主题
     * @param text 邮件正文（纯文本）
     * @param html 邮件正文（HTML格式，可选）
     */
    async sendEmail(
        to: string,
        subject: string,
        text: string,
        html?: string,
    ): Promise<void> {
        if (this.accounts.length === 0) {
            throw new Error('邮件服务未配置：请检查 .env 文件中的邮件配置');
        }

        // 尝试使用所有账号发送，直到成功
        let lastError: any = null;
        const maxAttempts = this.accounts.length;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const account = this.getNextAccount();

            try {
                console.log(`[EmailService] 准备发送邮件（尝试 ${attempt + 1}/${maxAttempts}）：从 ${account.from} 发送到 ${to}`);
                console.log(`[EmailService] 邮件主题: ${subject}`);
                console.log(`[EmailService] 使用账号: ${account.user}`);

                // 配置检查
                const smtpPass = account.pass || '';
                console.log(`[EmailService] SMTP配置检查:`, {
                    host: account.host,
                    port: account.port,
                    user: account.user,
                    hasPass: !!smtpPass,
                    passLength: smtpPass.length,
                    passFirstChar: smtpPass ? smtpPass[0] : '无',
                    passLastChar: smtpPass ? smtpPass[smtpPass.length - 1] : '无',
                    hasSpaces: smtpPass.includes(' '),
                });

                // 如果授权码长度不是16位，给出警告
                if (smtpPass && smtpPass.length !== 16) {
                    console.warn(`[EmailService] ⚠️ 警告：账号 ${account.user} 授权码长度异常（${smtpPass.length}位），QQ邮箱授权码通常是16位`);
                }

                // 如果授权码包含空格，给出警告
                if (smtpPass && smtpPass.includes(' ')) {
                    console.warn(`[EmailService] ⚠️ 警告：账号 ${account.user} 授权码包含空格，这可能导致登录失败`);
                }

                await account.transporter.sendMail({
                    from: account.from,
                    to,
                    subject,
                    text,
                    html: html || text,
                });

                console.log(`[EmailService] 邮件发送成功：${to} (使用账号: ${account.user}, ${new Date().toISOString()})`);
                return; // 发送成功，退出循环
            } catch (error: any) {
                lastError = error;
                console.warn(`[EmailService] 账号 ${account.user} 发送失败，尝试下一个账号:`, {
                    message: error?.message,
                    code: error?.code,
                    responseCode: error?.responseCode,
                });

                // 如果是最后一个账号也失败了，抛出错误
                if (attempt === maxAttempts - 1) {
                    break;
                }

                // 等待一小段时间再尝试下一个账号
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // 所有账号都失败了
        const error: any = lastError;
        console.error('[EmailService] 所有账号发送失败:', {
            message: error?.message,
            code: error?.code,
            responseCode: error?.responseCode,
            response: error?.response,
            command: error?.command,
            timestamp: new Date().toISOString(),
        });

        // 提供更友好的错误信息
        let errorMessage = '发送邮件失败';
        if (error?.code === 'EAUTH' || error?.responseCode === 535) {
            const possibleReasons = [
                '1. 使用了QQ密码而不是授权码（最常见）',
                '2. 授权码已过期或失效（需要重新生成）',
                '3. QQ邮箱登录频率限制（短时间内发送过多邮件）',
                '4. SMTP服务被关闭（需要在QQ邮箱设置中重新开启）',
                '5. 授权码配置错误（包含空格或复制不完整）',
            ];

            errorMessage = 'SMTP登录失败（535错误）\n\n' +
                '可能的原因：\n' + possibleReasons.join('\n') +
                '\n\n解决方案：\n' +
                '1. 如果之前能发送，可能是登录频率限制，请等待5-10分钟后重试\n' +
                '2. 如果持续失败，请重新生成授权码：\n' +
                '   - 登录QQ邮箱 → 设置 → 账户\n' +
                '   - 关闭SMTP服务，然后重新开启\n' +
                '   - 生成新的授权码并更新 .env 文件中的 SMTP_PASS 或 SMTP_ACCOUNTS\n' +
                '3. 检查授权码是否包含空格（复制时可能带空格）\n' +
                '4. 确认使用的是授权码，不是QQ登录密码\n' +
                '5. 检查QQ邮箱设置中SMTP服务是否仍然开启';
        } else if (error?.code === 'ECONNECTION') {
            errorMessage = '无法连接到SMTP服务器：请检查网络连接和SMTP_HOST配置';
        } else if (error?.code === 'ETIMEDOUT') {
            errorMessage = '连接SMTP服务器超时：请检查网络连接或SMTP服务器地址';
        } else if (error?.message) {
            errorMessage = `发送邮件失败: ${error.message}`;
        }

        throw new Error(errorMessage);
    }

    /**
     * 发送JSON格式的数据邮件
     * @param to 收件人邮箱
     * @param subject 邮件主题
     * @param data 要发送的数据对象
     */
    async sendJsonEmail(
        to: string,
        subject: string,
        data: any,
    ): Promise<void> {
        const jsonString = JSON.stringify(data, null, 2);
        const text = `数据内容（JSON格式）：\n\n${jsonString}`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #333;">${subject}</h2>
                <p>数据内容（JSON格式）：</p>
                <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px;">${jsonString}</pre>
            </div>
        `;

        await this.sendEmail(to, subject, text, html);
    }
}
