import { Injectable, Logger } from '@nestjs/common';
import * as OSS from 'ali-oss';
import axios from 'axios';
import * as crypto from 'crypto';

export enum ImageCategory {
    REFUND_1688_FOLLOW_UP = 'refund-1688-follow-up',
    FINANCE_MANAGEMENT = 'finance-management',
    NON_PURCHASE_BILL_RECORD = 'non-purchase-bill-record',
    PURCHASE_AMOUNT_ADJUSTMENT = 'purchase-amount-adjustment',
}

interface StsCredentials {
    AccessKeyId: string;
    AccessKeySecret: string;
    SecurityToken: string;
    Expiration: string;
}

@Injectable()
export class OssService {
    private client: OSS | null = null;
    private readonly logger = new Logger(OssService.name);
    private readonly bucket: string;
    private readonly region: string;
    private readonly endpoint?: string;
    private stsCredentials: StsCredentials | null = null;
    private stsCredentialsExpiry: number = 0;

    constructor() {
        this.bucket = process.env.OSS_BUCKET || 'shumuyx';
        this.region = process.env.OSS_REGION || 'cn-chengdu';
        this.endpoint = process.env.OSS_ENDPOINT;
    }

    /**
     * 获取OSS客户端（支持ECS实例角色和AccessKey两种方式）
     */
    private async getClient(): Promise<OSS> {
        // 优先使用ECS实例角色（STS Token）
        const roleName = process.env.OSS_ECS_ROLE_NAME;
        if (roleName) {
            // 如果已有有效的STS客户端，直接返回
            if (this.client && this.stsCredentialsExpiry > Date.now()) {
                return this.client;
            }

            try {
                await this.refreshStsCredentials(roleName);
                if (this.stsCredentials) {
                    this.client = new OSS({
                        accessKeyId: this.stsCredentials.AccessKeyId,
                        accessKeySecret: this.stsCredentials.AccessKeySecret,
                        stsToken: this.stsCredentials.SecurityToken,
                        bucket: this.bucket,
                        region: this.region,
                        endpoint: this.endpoint,
                    });
                    this.logger.log('OSS client initialized with ECS instance role (STS Token)');
                    return this.client;
                }
            } catch (error: any) {
                this.logger.warn(`Failed to get STS credentials from ECS instance role: ${error.message}`);
                this.logger.warn('Falling back to AccessKey authentication');
            }
        }

        // 回退到AccessKey方式
        // 如果已有AccessKey客户端，直接返回（AccessKey不会过期）
        if (this.client && !roleName) {
            return this.client;
        }

        const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
        const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;

        if (!accessKeyId || !accessKeySecret) {
            throw new Error('OSS credentials not configured. Please set either OSS_ECS_ROLE_NAME or OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET');
        }

        this.client = new OSS({
            accessKeyId,
            accessKeySecret,
            bucket: this.bucket,
            region: this.region,
            endpoint: this.endpoint,
        });

        // AccessKey方式不需要过期时间，设置为最大值
        this.stsCredentialsExpiry = Number.MAX_SAFE_INTEGER;

        this.logger.log('OSS client initialized with AccessKey');
        return this.client;
    }

    /**
     * 从ECS实例元数据服务获取STS临时凭证
     * @param roleName RAM角色名称
     */
    private async refreshStsCredentials(roleName: string): Promise<void> {
        try {
            // ECS实例元数据服务地址
            const metadataUrl = `http://100.100.100.200/latest/meta-data/ram/security-credentials/${roleName}`;

            const response = await axios.get<StsCredentials>(metadataUrl, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'aliyun-oss-sdk',
                },
            });

            this.stsCredentials = response.data;

            // 计算过期时间（提前5分钟刷新）
            const expirationDate = new Date(this.stsCredentials.Expiration);
            this.stsCredentialsExpiry = expirationDate.getTime() - 5 * 60 * 1000;

            this.logger.log(`STS credentials refreshed, expires at: ${this.stsCredentials.Expiration}`);
        } catch (error: any) {
            this.logger.error(`Failed to refresh STS credentials: ${error.message}`);
            throw error;
        }
    }

    /**
     * 上传base64图片到OSS
     * @param base64Data base64编码的图片数据（包含或不包含data:image前缀）
     * @param category 图片分类
     * @param originalFileName 原始文件名（可选，用于确定文件扩展名）
     * @returns OSS URL
     */
    async uploadBase64Image(
        base64Data: string,
        category: ImageCategory,
        originalFileName?: string,
    ): Promise<string> {
        try {
            // 获取OSS客户端（自动处理STS Token刷新）
            const client = await this.getClient();

            // 移除data:image前缀（如果存在）
            const base64 = base64Data.includes(',')
                ? base64Data.split(',')[1]
                : base64Data;

            // 解码base64为Buffer
            const buffer = Buffer.from(base64, 'base64');

            // 生成唯一文件名
            const fileName = this.generateFileName(originalFileName);

            // 构建OSS路径
            const ossPath = `images/${category}/${fileName}`;

            // 上传到OSS
            const result = await client.put(ossPath, buffer);

            this.logger.log(`Image uploaded to OSS: ${result.url}`);

            // 返回URL（优先使用自定义域名，否则使用默认URL）
            const customDomain = process.env.OSS_CUSTOM_DOMAIN;
            if (customDomain) {
                return `${customDomain}/${ossPath}`;
            }

            return result.url;
        } catch (error: any) {
            this.logger.error(`Failed to upload image to OSS: ${error.message}`, error.stack);
            throw new Error(`图片上传失败: ${error.message}`);
        }
    }

    /**
     * 上传Buffer图片到OSS
     * @param buffer 图片Buffer
     * @param category 图片分类
     * @param originalFileName 原始文件名（可选）
     * @returns OSS URL
     */
    async uploadBufferImage(
        buffer: Buffer,
        category: ImageCategory,
        originalFileName?: string,
    ): Promise<string> {
        try {
            // 获取OSS客户端（自动处理STS Token刷新）
            const client = await this.getClient();

            // 生成唯一文件名
            const fileName = this.generateFileName(originalFileName);

            // 构建OSS路径
            const ossPath = `images/${category}/${fileName}`;

            // 上传到OSS
            const result = await client.put(ossPath, buffer);

            this.logger.log(`Image uploaded to OSS: ${result.url}`);

            // 返回URL（优先使用自定义域名，否则使用默认URL）
            const customDomain = process.env.OSS_CUSTOM_DOMAIN;
            if (customDomain) {
                return `${customDomain}/${ossPath}`;
            }

            return result.url;
        } catch (error: any) {
            this.logger.error(`Failed to upload image to OSS: ${error.message}`, error.stack);
            throw new Error(`图片上传失败: ${error.message}`);
        }
    }

    /**
     * 删除OSS文件
     * @param url OSS URL
     */
    async deleteImage(url: string): Promise<void> {
        try {
            // 获取OSS客户端（自动处理STS Token刷新）
            const client = await this.getClient();

            // 从URL中提取OSS路径
            const ossPath = this.extractOssPath(url);
            if (!ossPath) {
                this.logger.warn(`Invalid OSS URL: ${url}`);
                return;
            }

            await client.delete(ossPath);
            this.logger.log(`Image deleted from OSS: ${ossPath}`);
        } catch (error: any) {
            this.logger.error(`Failed to delete image from OSS: ${error.message}`, error.stack);
            // 删除失败不抛出异常，避免影响主流程
        }
    }

    /**
     * 生成唯一文件名
     * @param originalFileName 原始文件名（可选）
     * @returns 文件名
     */
    private generateFileName(originalFileName?: string): string {
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');

        // 从原始文件名提取扩展名，如果没有则使用jpg
        let extension = 'jpg';
        if (originalFileName) {
            const match = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
            if (match) {
                extension = match[1].toLowerCase();
            }
        }

        return `${timestamp}_${random}.${extension}`;
    }

    /**
     * 从URL中提取OSS路径
     * @param url OSS URL
     * @returns OSS路径
     */
    private extractOssPath(url: string): string | null {
        try {
            // 如果是自定义域名
            const customDomain = process.env.OSS_CUSTOM_DOMAIN;
            if (customDomain && url.startsWith(customDomain)) {
                return url.replace(customDomain + '/', '');
            }

            // 如果是默认OSS URL格式：https://bucket.oss-region.aliyuncs.com/path
            const match = url.match(/https?:\/\/[^\/]+\/(.+)$/);
            if (match) {
                return match[1];
            }

            // 如果已经是相对路径
            if (!url.startsWith('http')) {
                return url;
            }

            return null;
        } catch (error) {
            return null;
        }
    }
}

