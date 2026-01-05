import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { OperationLogService } from '../operation-log/operation-log.service';
import { Logger } from '../utils/logger.util';

// 渠道类型
export type ChannelType = '1688先采后付' | '京东金融' | '微信' | '支付宝';

// 通用交易记录接口（使用Record类型避免字段重复问题）
export type TransactionRecord = {
    // 公共字段
    支付渠道: string;
    支付账号: string;
    收支金额: number;
    交易账单号: string;
    账单交易时间: Date | string;
} & Record<string, any>; // 允许其他字段动态添加

@Injectable()
export class TransactionRecordService {
    constructor(private operationLogService: OperationLogService) { }

    private async getConnection() {
        if (!process.env.DB_PASSWORD) {
            throw new Error('DB_PASSWORD environment variable is required');
        }
        return await mysql.createConnection({
            host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
            user: process.env.DB_USER || 'xitongquanju',
            password: process.env.DB_PASSWORD,
            database: 'sm_zhangdan_caiwu',
            port: parseInt(process.env.DB_PORT || '3306'),
        });
    }

    // 根据渠道获取表名
    private getTableName(channel: ChannelType): string {
        const tableMap: Record<ChannelType, string> = {
            '1688先采后付': '1688先采后付交易记录',
            '京东金融': '京东金融交易记录',
            '微信': '微信交易记录',
            '支付宝': '支付宝交易记录',
        };
        return tableMap[channel];
    }

    // 获取所有记录（分页、搜索）
    async getAll(
        channel: ChannelType,
        page: number = 1,
        limit: number = 20,
        search?: string,
        bindingStatuses?: string[], // 绑定状态筛选：['已绑定采购单', '已生成对账单', '非采购单流水']
    ): Promise<{ data: TransactionRecord[]; total: number }> {
        const connection = await this.getConnection();
        const tableName = this.getTableName(channel);

        try {
            const offset = (page - 1) * limit;
            let whereClause = '1=1';
            const queryParams: any[] = [];

            // 搜索条件（支持多种搜索格式）
            if (search) {
                const searchTrimmed = search.trim();
                // 支持格式：字段名:值（多个条件用空格分隔）或 直接搜索
                const searchParts = searchTrimmed.split(/\s+/);
                const fieldConditions: string[] = [];
                const fieldParams: any[] = [];
                let hasGeneralSearch = false;
                let generalSearchTerm = '';

                for (const part of searchParts) {
                    if (part.includes(':')) {
                        const [fieldName, fieldValue] = part.split(':').map(s => s.trim());
                        if (fieldName && fieldValue) {
                            if (fieldName === '支付渠道') {
                                fieldConditions.push('支付渠道 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '支付账号') {
                                fieldConditions.push('支付账号 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '交易账单号') {
                                fieldConditions.push('交易账单号 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '收支金额') {
                                const amount = parseFloat(fieldValue);
                                if (!isNaN(amount)) {
                                    // 如果输入的是正数，同时搜索正数和负数
                                    if (amount >= 0) {
                                        fieldConditions.push('(收支金额 = ? OR 收支金额 = ?)');
                                        fieldParams.push(amount, -amount);
                                    } else {
                                        // 如果输入的是负数，只搜索负数
                                        fieldConditions.push('收支金额 = ?');
                                        fieldParams.push(amount);
                                    }
                                }
                            }
                        }
                    } else if (part) {
                        hasGeneralSearch = true;
                        generalSearchTerm = part;
                    }
                }

                // 添加字段条件
                if (fieldConditions.length > 0) {
                    whereClause += ' AND (' + fieldConditions.join(' AND ') + ')';
                    queryParams.push(...fieldParams);
                }

                // 添加通用搜索条件
                if (hasGeneralSearch) {
                    whereClause += ` AND (
            交易账单号 LIKE ? OR 
            支付账号 LIKE ? OR
            支付渠道 LIKE ?
          )`;
                    queryParams.push(`%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`);
                }
            }

            // 查询数据（如果有绑定状态筛选，需要查询更多数据来确保筛选准确）
            // 先查询比需要更多的数据，筛选后再截取
            // 不在SQL层面筛选绑定状态，而是在代码层面筛选，确保准确性
            // 如果有多个状态筛选，需要查询更多数据，因为同时满足多个状态的记录可能较少
            const statusCount = bindingStatuses && bindingStatuses.length > 0 ? bindingStatuses.length : 0;
            const queryLimit = statusCount > 0 ? limit * (10 * statusCount) : limit; // 根据状态数量动态增加查询量
            const dataQuery = `SELECT * FROM \`${tableName}\` WHERE ${whereClause} ORDER BY 账单交易时间 DESC LIMIT ? OFFSET ?`;
            const [rows]: any = await connection.execute(dataQuery, [...queryParams, queryLimit, offset]);

            // 转换日期格式并查询绑定状态
            const data = await Promise.all(rows.map(async (row: any) => {
                if (row.账单交易时间) {
                    row.账单交易时间 = new Date(row.账单交易时间).toISOString();
                }

                // 查询绑定状态
                const bindingStatusInfo = await this.getBindingStatusInfo(connection, row.交易账单号);

                // 如果有绑定状态筛选，需要再次验证（确保准确性）
                if (bindingStatuses && bindingStatuses.length > 0) {
                    const recordStatuses = bindingStatusInfo.statuses;

                    // 检查记录是否同时满足所有选中的状态（AND逻辑）
                    // 排除"无绑定状态"（因为它与其他状态互斥）
                    const statusesToCheck = bindingStatuses.filter(s => s !== '无绑定状态');
                    const hasNoBindingStatus = bindingStatuses.includes('无绑定状态');

                    let matchesSelectedStatus = true;

                    // 如果选择了"无绑定状态"
                    if (hasNoBindingStatus) {
                        // "无绑定状态"意味着没有任何绑定状态
                        // 如果同时选择了其他状态，这是矛盾的，应该返回false
                        if (statusesToCheck.length > 0) {
                            // "无绑定状态"与其他状态不能同时选择，这是用户选择错误，但这里我们处理为false
                            matchesSelectedStatus = false;
                        } else {
                            // 只选择了"无绑定状态"，检查记录是否真的没有任何状态
                            matchesSelectedStatus = recordStatuses.length === 0;
                        }
                    } else {
                        // 没有选择"无绑定状态"，检查记录是否包含所有选中的状态
                        if (statusesToCheck.length === 0) {
                            matchesSelectedStatus = false;
                        } else {
                            // 记录必须包含所有选中的状态（AND逻辑）
                            matchesSelectedStatus = statusesToCheck.every(selectedStatus => {
                                return recordStatuses.includes(selectedStatus);
                            });
                        }
                    }

                    // 如果记录不满足所有选中的状态，跳过这条记录
                    if (!matchesSelectedStatus) {
                        return null;
                    }
                }

                row.绑定状态 = bindingStatusInfo.statuses;
                row.绑定状态对应情况 = bindingStatusInfo.details;
                row.是否有非采购单流水 = bindingStatusInfo.hasNonPurchaseBill;

                return row;
            }));

            // 过滤掉null值（不满足筛选条件的记录）
            let filteredData = data.filter(record => record !== null);

            // 如果有绑定状态筛选，需要重新分页（因为筛选后数量可能变化）
            // 如果筛选后数据不足，可能需要继续查询更多数据
            if (bindingStatuses && bindingStatuses.length > 0) {
                // 如果筛选后的数据不足一页，且查询到的原始数据达到了限制，可能需要继续查询
                if (filteredData.length < limit && rows.length === queryLimit) {
                    // 继续查询更多数据，直到找到足够的数据或没有更多数据
                    let currentOffset = offset + queryLimit;
                    let collectedData = filteredData;

                    // 如果选择了多个状态，需要查询更多数据才能找到同时满足所有状态的记录
                    const maxQueryLimit = statusCount > 1 ? 50000 : 10000;
                    while (collectedData.length < limit && currentOffset < maxQueryLimit) {
                        const nextLimit = Math.min(queryLimit, maxQueryLimit - currentOffset);
                        const nextDataQuery = `SELECT * FROM \`${tableName}\` WHERE ${whereClause} ORDER BY 账单交易时间 DESC LIMIT ? OFFSET ?`;
                        const [nextRows]: any = await connection.execute(nextDataQuery, [...queryParams, nextLimit, currentOffset]);

                        if (nextRows.length === 0) {
                            break; // 没有更多数据了
                        }

                        // 处理下一批数据
                        const nextData = await Promise.all(nextRows.map(async (row: any) => {
                            if (row.账单交易时间) {
                                row.账单交易时间 = new Date(row.账单交易时间).toISOString();
                            }

                            const bindingStatusInfo = await this.getBindingStatusInfo(connection, row.交易账单号);
                            const recordStatuses = bindingStatusInfo.statuses;

                            // 检查记录是否同时满足所有选中的状态（AND逻辑）
                            const statusesToCheck = bindingStatuses.filter(s => s !== '无绑定状态');
                            const hasNoBindingStatus = bindingStatuses.includes('无绑定状态');

                            let matchesSelectedStatus = true;

                            if (hasNoBindingStatus) {
                                if (statusesToCheck.length > 0) {
                                    matchesSelectedStatus = false;
                                } else {
                                    matchesSelectedStatus = recordStatuses.length === 0;
                                }
                            } else {
                                if (statusesToCheck.length === 0) {
                                    matchesSelectedStatus = false;
                                } else {
                                    matchesSelectedStatus = statusesToCheck.every(selectedStatus => {
                                        return recordStatuses.includes(selectedStatus);
                                    });
                                }
                            }

                            if (!matchesSelectedStatus) {
                                return null;
                            }

                            row.绑定状态 = bindingStatusInfo.statuses;
                            row.绑定状态对应情况 = bindingStatusInfo.details;
                            row.是否有非采购单流水 = bindingStatusInfo.hasNonPurchaseBill;

                            return row;
                        }));

                        const validNextData = nextData.filter(record => record !== null);
                        collectedData = [...collectedData, ...validNextData];

                        if (nextRows.length < nextLimit) {
                            break; // 没有更多数据了
                        }

                        currentOffset += nextLimit;

                        // 如果已经收集到足够的数据，就停止
                        if (collectedData.length >= limit) {
                            break;
                        }
                    }

                    filteredData = collectedData.slice(0, limit);
                } else {
                    // 只取需要的数量
                    filteredData = filteredData.slice(0, limit);
                }
            }

            // 查询总数
            let total = 0;
            if (!bindingStatuses || bindingStatuses.length === 0) {
                // 没有绑定状态筛选时，直接查询总数
                const countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\` WHERE ${whereClause}`;
                const [countResult]: any = await connection.execute(countQuery, queryParams);
                total = countResult[0]?.total || 0;
            } else {
                // 有绑定状态筛选时，需要查询所有符合基础条件的记录并验证绑定状态
                // 为了提高性能，这里查询所有符合基础条件的记录ID（不分页）
                const allDataQuery = `SELECT 交易账单号 FROM \`${tableName}\` WHERE ${whereClause} ORDER BY 账单交易时间 DESC LIMIT 5000`;
                const [allRows]: any = await connection.execute(allDataQuery, queryParams);

                // 验证每条记录的绑定状态
                let validCount = 0;
                for (const row of allRows) {
                    const bindingStatusInfo = await this.getBindingStatusInfo(connection, row.交易账单号);
                    const recordStatuses = bindingStatusInfo.statuses;
                    // 检查记录是否同时满足所有选中的状态（AND逻辑）
                    const statusesToCheck = bindingStatuses.filter(s => s !== '无绑定状态');
                    const hasNoBindingStatus = bindingStatuses.includes('无绑定状态');

                    let matchesSelectedStatus = true;

                    if (hasNoBindingStatus) {
                        if (statusesToCheck.length > 0) {
                            matchesSelectedStatus = false;
                        } else {
                            matchesSelectedStatus = recordStatuses.length === 0;
                        }
                    } else {
                        if (statusesToCheck.length === 0) {
                            matchesSelectedStatus = false;
                        } else {
                            matchesSelectedStatus = statusesToCheck.every(selectedStatus => {
                                return recordStatuses.includes(selectedStatus);
                            });
                        }
                    }
                    if (matchesSelectedStatus) {
                        validCount++;
                    }
                }
                total = validCount;

                // 如果查询到的数据达到限制，说明可能还有更多数据
                if (allRows.length === 5000) {
                    // 无法准确计算总数，使用当前值
                    // 实际项目中可以考虑缓存或优化查询
                }
            }

            return { data: filteredData, total };
        } catch (error) {
            Logger.error(`[TransactionRecordService] Failed to get records for ${channel}:`, error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 查询绑定状态信息
    private async getBindingStatusInfo(connection: any, 交易账单号: string): Promise<{
        statuses: string[];
        details: string[];
        hasNonPurchaseBill: boolean;
    }> {
        const statuses: string[] = [];
        const details: string[] = [];

        try {
            // 1. 查询是否在'手动绑定对账单号'表中
            const manualBindingQuery = `SELECT COUNT(*) as count FROM \`手动绑定对账单号\` WHERE \`交易单号\` = ?`;
            const [manualBindingResult]: any = await connection.execute(manualBindingQuery, [交易账单号]);
            if (manualBindingResult[0]?.count > 0) {
                statuses.push('已绑定采购单');
            }

            // 2. 查询是否在'交易单号绑定采购单记录'表中，并获取记录状态
            const bindingRecordQuery = `SELECT DISTINCT \`记录状态\` FROM \`交易单号绑定采购单记录\` WHERE \`交易单号\` = ? AND \`记录状态\` IS NOT NULL AND \`记录状态\` != ''`;
            const [bindingRecordResult]: any = await connection.execute(bindingRecordQuery, [交易账单号]);
            if (bindingRecordResult.length > 0) {
                statuses.push('已生成对账单');
                // 收集所有记录状态（已去重），并加上前缀
                bindingRecordResult.forEach((row: any) => {
                    if (row.记录状态) {
                        details.push(`对账单记录状态:${row.记录状态}`);
                    }
                });
            }

            // 3. 查询是否在'非采购单流水记录'表中，并获取财务审核状态
            const nonPurchaseQuery = `SELECT DISTINCT \`财务审核状态\` FROM \`非采购单流水记录\` WHERE \`账单流水\` = ? AND \`财务审核状态\` IS NOT NULL AND \`财务审核状态\` != ''`;
            const [nonPurchaseResult]: any = await connection.execute(nonPurchaseQuery, [交易账单号]);
            if (nonPurchaseResult.length > 0) {
                statuses.push('非采购单流水');
                // 收集所有财务审核状态（已去重），并加上前缀
                nonPurchaseResult.forEach((row: any) => {
                    if (row.财务审核状态) {
                        details.push(`非采购单流水财务审核状态:${row.财务审核状态}`);
                    }
                });
            }

            return {
                statuses,
                details,
                hasNonPurchaseBill: nonPurchaseResult.length > 0,
            };
        } catch (error) {
            Logger.error(`[TransactionRecordService] Failed to get binding status for ${交易账单号}:`, error);
            return { statuses: [], details: [], hasNonPurchaseBill: false };
        }
    }

    // 批量创建记录
    async batchCreate(channel: ChannelType, records: Partial<TransactionRecord>[]): Promise<{
        success: number;
        failed: number;
        errors: string[];
    }> {
        const connection = await this.getConnection();
        const tableName = this.getTableName(channel);

        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        try {
            await connection.beginTransaction();

            for (const record of records) {
                try {
                    // 构建插入SQL（根据渠道不同，字段也不同）
                    const fields: string[] = [];
                    const placeholders: string[] = [];
                    const values: any[] = [];

                    // 公共字段
                    if (record.支付渠道 !== undefined) {
                        fields.push('支付渠道');
                        placeholders.push('?');
                        values.push(record.支付渠道);
                    }
                    if (record.支付账号 !== undefined) {
                        fields.push('支付账号');
                        placeholders.push('?');
                        values.push(record.支付账号);
                    }
                    if (record.收支金额 !== undefined) {
                        fields.push('收支金额');
                        placeholders.push('?');
                        values.push(record.收支金额);
                    }
                    if (record.交易账单号 !== undefined) {
                        fields.push('交易账单号');
                        placeholders.push('?');
                        values.push(record.交易账单号);
                    }
                    if (record.账单交易时间 !== undefined) {
                        fields.push('账单交易时间');
                        placeholders.push('?');
                        values.push(record.账单交易时间);
                    }

                    // 根据渠道添加特有字段
                    if (channel === '1688先采后付') {
                        if (record.订单号 !== undefined) {
                            fields.push('订单号');
                            placeholders.push('?');
                            values.push(record.订单号);
                        }
                        if (record.订单支付时间 !== undefined) {
                            fields.push('订单支付时间');
                            placeholders.push('?');
                            values.push(record.订单支付时间);
                        }
                        if (record.订单名称 !== undefined) {
                            fields.push('订单名称');
                            placeholders.push('?');
                            values.push(record.订单名称);
                        }
                        if (record['支付金额(元)'] !== undefined) {
                            fields.push('支付金额(元)');
                            placeholders.push('?');
                            values.push(record['支付金额(元)']);
                        }
                        if (record['确认收货金额(元)'] !== undefined) {
                            fields.push('确认收货金额(元)');
                            placeholders.push('?');
                            values.push(record['确认收货金额(元)']);
                        }
                        if (record.确认收货时间 !== undefined) {
                            fields.push('确认收货时间');
                            placeholders.push('?');
                            values.push(record.确认收货时间);
                        }
                        if (record.账期类型 !== undefined) {
                            fields.push('账期类型');
                            placeholders.push('?');
                            values.push(record.账期类型);
                        }
                        if (record.是否有退款 !== undefined) {
                            fields.push('是否有退款');
                            placeholders.push('?');
                            values.push(record.是否有退款);
                        }
                        if (record['退款金额(元)'] !== undefined) {
                            fields.push('退款金额(元)');
                            placeholders.push('?');
                            values.push(record['退款金额(元)']);
                        }
                    } else if (channel === '京东金融') {
                        if (record.交易时间 !== undefined) {
                            fields.push('交易时间');
                            placeholders.push('?');
                            values.push(record.交易时间);
                        }
                        if (record.商户名称 !== undefined) {
                            fields.push('商户名称');
                            placeholders.push('?');
                            values.push(record.商户名称);
                        }
                        if (record.交易说明 !== undefined) {
                            fields.push('交易说明');
                            placeholders.push('?');
                            values.push(record.交易说明);
                        }
                        if (record.金额 !== undefined) {
                            fields.push('金额');
                            placeholders.push('?');
                            values.push(record.金额);
                        }
                        if (record['收/付款方式'] !== undefined) {
                            fields.push('收/付款方式');
                            placeholders.push('?');
                            values.push(record['收/付款方式']);
                        }
                        if (record.交易状态 !== undefined) {
                            fields.push('交易状态');
                            placeholders.push('?');
                            values.push(record.交易状态);
                        }
                        if (record['收/支'] !== undefined) {
                            fields.push('收/支');
                            placeholders.push('?');
                            values.push(record['收/支']);
                        }
                        if (record.交易分类 !== undefined) {
                            fields.push('交易分类');
                            placeholders.push('?');
                            values.push(record.交易分类);
                        }
                        if (record.交易订单号 !== undefined) {
                            fields.push('交易订单号');
                            placeholders.push('?');
                            values.push(record.交易订单号);
                        }
                        if (record.商家订单号 !== undefined) {
                            fields.push('商家订单号');
                            placeholders.push('?');
                            values.push(record.商家订单号);
                        }
                        if (record.备注 !== undefined) {
                            fields.push('备注');
                            placeholders.push('?');
                            values.push(record.备注);
                        }
                    } else if (channel === '微信') {
                        if (record.交易时间 !== undefined) {
                            fields.push('交易时间');
                            placeholders.push('?');
                            values.push(record.交易时间);
                        }
                        if (record.交易类型 !== undefined) {
                            fields.push('交易类型');
                            placeholders.push('?');
                            values.push(record.交易类型);
                        }
                        if (record.交易对方 !== undefined) {
                            fields.push('交易对方');
                            placeholders.push('?');
                            values.push(record.交易对方);
                        }
                        if (record.商品 !== undefined) {
                            fields.push('商品');
                            placeholders.push('?');
                            values.push(record.商品);
                        }
                        if (record['收/支'] !== undefined) {
                            fields.push('收/支');
                            placeholders.push('?');
                            values.push(record['收/支']);
                        }
                        if (record['金额(元)'] !== undefined) {
                            fields.push('金额(元)');
                            placeholders.push('?');
                            values.push(record['金额(元)']);
                        }
                        if (record.支付方式 !== undefined) {
                            fields.push('支付方式');
                            placeholders.push('?');
                            values.push(record.支付方式);
                        }
                        if (record.当前状态 !== undefined) {
                            fields.push('当前状态');
                            placeholders.push('?');
                            values.push(record.当前状态);
                        }
                        if (record.交易单号 !== undefined) {
                            fields.push('交易单号');
                            placeholders.push('?');
                            values.push(record.交易单号);
                        }
                        if (record.商户单号 !== undefined) {
                            fields.push('商户单号');
                            placeholders.push('?');
                            values.push(record.商户单号);
                        }
                        if (record.备注 !== undefined) {
                            fields.push('备注');
                            placeholders.push('?');
                            values.push(record.备注);
                        }
                    } else if (channel === '支付宝') {
                        if (record.交易时间 !== undefined) {
                            fields.push('交易时间');
                            placeholders.push('?');
                            values.push(record.交易时间);
                        }
                        if (record.交易分类 !== undefined) {
                            fields.push('交易分类');
                            placeholders.push('?');
                            values.push(record.交易分类);
                        }
                        if (record.交易对方 !== undefined) {
                            fields.push('交易对方');
                            placeholders.push('?');
                            values.push(record.交易对方);
                        }
                        if (record.对方账号 !== undefined) {
                            fields.push('对方账号');
                            placeholders.push('?');
                            values.push(record.对方账号);
                        }
                        if (record.商品说明 !== undefined) {
                            fields.push('商品说明');
                            placeholders.push('?');
                            values.push(record.商品说明);
                        }
                        if (record['收/支'] !== undefined) {
                            fields.push('收/支');
                            placeholders.push('?');
                            values.push(record['收/支']);
                        }
                        if (record.金额 !== undefined) {
                            fields.push('金额');
                            placeholders.push('?');
                            values.push(record.金额);
                        }
                        if (record['收/付款方式'] !== undefined) {
                            fields.push('收/付款方式');
                            placeholders.push('?');
                            values.push(record['收/付款方式']);
                        }
                        if (record.交易状态 !== undefined) {
                            fields.push('交易状态');
                            placeholders.push('?');
                            values.push(record.交易状态);
                        }
                        if (record.交易订单号 !== undefined) {
                            fields.push('交易订单号');
                            placeholders.push('?');
                            values.push(record.交易订单号);
                        }
                        if (record.商家订单号 !== undefined) {
                            fields.push('商家订单号');
                            placeholders.push('?');
                            values.push(record.商家订单号);
                        }
                        if (record.备注 !== undefined) {
                            fields.push('备注');
                            placeholders.push('?');
                            values.push(record.备注);
                        }
                    }

                    if (fields.length === 0) {
                        throw new Error('没有可插入的字段');
                    }

                    const insertQuery = `INSERT INTO \`${tableName}\` (${fields.map(f => `\`${f}\``).join(', ')}) VALUES (${placeholders.join(', ')})`;
                    await connection.execute(insertQuery, values);
                    success++;
                } catch (error: any) {
                    failed++;
                    const errorMsg = error.message || '未知错误';
                    errors.push(`交易账单号 ${record.交易账单号 || '未知'}: ${errorMsg}`);
                    Logger.error(`[TransactionRecordService] Failed to insert record:`, error);
                }
            }

            await connection.commit();
            return { success, failed, errors };
        } catch (error) {
            await connection.rollback();
            Logger.error(`[TransactionRecordService] Batch create failed for ${channel}:`, error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 获取所有记录（用于导出）
    async getAllForExport(channel: ChannelType, search?: string): Promise<TransactionRecord[]> {
        const connection = await this.getConnection();
        const tableName = this.getTableName(channel);

        try {
            let whereClause = '1=1';
            const queryParams: any[] = [];

            if (search) {
                whereClause += ` AND (
          交易账单号 LIKE ? OR 
          支付账号 LIKE ? OR
          支付渠道 LIKE ?
        )`;
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const query = `SELECT * FROM \`${tableName}\` WHERE ${whereClause} ORDER BY 账单交易时间 DESC`;
            const [rows]: any = await connection.execute(query, queryParams);

            // 转换日期格式
            return rows.map((row: any) => {
                if (row.账单交易时间) {
                    row.账单交易时间 = new Date(row.账单交易时间).toISOString();
                }
                return row;
            });
        } catch (error) {
            Logger.error(`[TransactionRecordService] Failed to get all records for export (${channel}):`, error);
            throw error;
        } finally {
            await connection.end();
        }
    }
}

