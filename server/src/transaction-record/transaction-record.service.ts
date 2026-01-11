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
        Logger.log(`[TransactionRecordService] getAll called: channel=${channel}, page=${page}, limit=${limit}, search=${search}, bindingStatuses=${bindingStatuses?.join(',') || 'none'}`);
        
        const connection = await this.getConnection();
        const tableName = this.getTableName(channel);
        Logger.log(`[TransactionRecordService] Using table: ${tableName}`);

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
                            // 公共字段
                            if (fieldName === '支付渠道') {
                                fieldConditions.push('支付渠道 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '支付账号') {
                                fieldConditions.push('支付账号 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '交易账单号') {
                                fieldConditions.push('交易账单号 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '账单交易时间') {
                                // 账单交易时间是日期时间字段，需要使用 DATE_FORMAT 格式化后搜索
                                // 支持搜索年份（如2025）、日期、时间等
                                // 格式化后的字符串格式：2025-01-01 12:00:00，所以搜索 "2025" 可以匹配年份
                                // 确保字段不为 NULL，避免 DATE_FORMAT 返回 NULL 导致 LIKE 搜索失败
                                fieldConditions.push('账单交易时间 IS NOT NULL AND DATE_FORMAT(账单交易时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
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
                            // 1688先采后付渠道特有字段
                            else if (channel === '1688先采后付') {
                                if (fieldName === '订单号') {
                                    fieldConditions.push('订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '订单支付时间') {
                                    fieldConditions.push('订单支付时间 IS NOT NULL AND DATE_FORMAT(订单支付时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '订单名称') {
                                    fieldConditions.push('订单名称 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '支付金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`支付金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '确认收货金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`确认收货金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '确认收货时间') {
                                    fieldConditions.push('确认收货时间 IS NOT NULL AND DATE_FORMAT(确认收货时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '账期类型') {
                                    fieldConditions.push('账期类型 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '是否有退款') {
                                    fieldConditions.push('是否有退款 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '退款金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`退款金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                }
                            }
                            // 京东金融渠道特有字段
                            else if (channel === '京东金融') {
                                if (fieldName === '交易时间') {
                                    fieldConditions.push('交易时间 IS NOT NULL AND DATE_FORMAT(交易时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商户名称') {
                                    fieldConditions.push('商户名称 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易说明') {
                                    fieldConditions.push('交易说明 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '金额') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('金额 LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '收/付款方式') {
                                    fieldConditions.push('`收/付款方式` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易状态') {
                                    fieldConditions.push('交易状态 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '收/支') {
                                    fieldConditions.push('`收/支` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易分类') {
                                    fieldConditions.push('交易分类 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易订单号') {
                                    fieldConditions.push('交易订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商家订单号') {
                                    fieldConditions.push('商家订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '备注') {
                                    fieldConditions.push('备注 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                }
                            }
                            // 微信渠道特有字段
                            else if (channel === '微信') {
                                if (fieldName === '交易时间') {
                                    fieldConditions.push('交易时间 IS NOT NULL AND DATE_FORMAT(交易时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易类型') {
                                    fieldConditions.push('交易类型 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易对方') {
                                    fieldConditions.push('交易对方 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商品') {
                                    fieldConditions.push('商品 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '收/支') {
                                    fieldConditions.push('`收/支` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '支付方式') {
                                    fieldConditions.push('支付方式 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '当前状态') {
                                    fieldConditions.push('当前状态 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易单号') {
                                    fieldConditions.push('交易单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商户单号') {
                                    fieldConditions.push('商户单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '备注') {
                                    fieldConditions.push('备注 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                }
                            }
                            // 支付宝渠道特有字段
                            else if (channel === '支付宝') {
                                if (fieldName === '交易时间') {
                                    fieldConditions.push('交易时间 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易分类') {
                                    fieldConditions.push('交易分类 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易对方') {
                                    fieldConditions.push('交易对方 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '对方账号') {
                                    fieldConditions.push('对方账号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商品说明') {
                                    fieldConditions.push('商品说明 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '收/支') {
                                    fieldConditions.push('`收/支` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '金额') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('金额 LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '收/付款方式') {
                                    fieldConditions.push('`收/付款方式` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易状态') {
                                    fieldConditions.push('交易状态 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易订单号') {
                                    fieldConditions.push('交易订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商家订单号') {
                                    fieldConditions.push('商家订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '备注') {
                                    fieldConditions.push('备注 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
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
                    if (channel === '1688先采后付') {
                        // 1688先采后付渠道的通用搜索
                        whereClause += ` AND (
            交易账单号 LIKE ? OR 
            支付账号 LIKE ? OR
            支付渠道 LIKE ? OR
            订单号 LIKE ? OR
            订单名称 LIKE ? OR
            备注 LIKE ?
          )`;
                        queryParams.push(
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`
                        );
                    } else if (channel === '京东金融') {
                        // 京东金融渠道的通用搜索
                        whereClause += ` AND (
            交易账单号 LIKE ? OR 
            支付账号 LIKE ? OR
            支付渠道 LIKE ? OR
            商户名称 LIKE ? OR
            交易说明 LIKE ? OR
            交易订单号 LIKE ? OR
            商家订单号 LIKE ? OR
            备注 LIKE ?
          )`;
                        queryParams.push(
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`
                        );
                    } else if (channel === '微信') {
                        // 微信渠道的通用搜索
                        whereClause += ` AND (
            交易账单号 LIKE ? OR 
            支付账号 LIKE ? OR
            支付渠道 LIKE ? OR
            交易类型 LIKE ? OR
            交易对方 LIKE ? OR
            商品 LIKE ? OR
            交易单号 LIKE ? OR
            商户单号 LIKE ? OR
            备注 LIKE ?
          )`;
                        queryParams.push(
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`
                        );
                    } else if (channel === '支付宝') {
                        // 支付宝渠道的通用搜索范围更广，包括所有常用字段
                        whereClause += ` AND (
            交易账单号 LIKE ? OR 
            支付账号 LIKE ? OR
            支付渠道 LIKE ? OR
            交易分类 LIKE ? OR
            交易对方 LIKE ? OR
            对方账号 LIKE ? OR
            商品说明 LIKE ? OR
            交易订单号 LIKE ? OR
            商家订单号 LIKE ? OR
            备注 LIKE ?
          )`;
                        queryParams.push(
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`
                        );
                    } else {
                        // 其他渠道的通用搜索（兜底）
                        whereClause += ` AND (
            交易账单号 LIKE ? OR 
            支付账号 LIKE ? OR
            支付渠道 LIKE ?
          )`;
                        queryParams.push(`%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`);
                    }
                }
            }

            // 如果有绑定状态筛选，先在SQL层面进行初步筛选（性能优化）
            // 这样可以大大减少需要查询的记录数
            if (bindingStatuses && bindingStatuses.length > 0) {
                const statusesToCheck = bindingStatuses.filter(s => s !== '无绑定状态');
                const hasNoBindingStatus = bindingStatuses.includes('无绑定状态');

                // 构建绑定状态的SQL筛选条件（AND逻辑：必须同时满足所有选中的状态）
                const bindingConditions: string[] = [];

                if (statusesToCheck.includes('已绑定采购单')) {
                    bindingConditions.push(`EXISTS (SELECT 1 FROM \`手动绑定对账单号\` WHERE \`交易单号\` = \`${tableName}\`.\`交易账单号\`)`);
                }
                if (statusesToCheck.includes('已生成对账单')) {
                    bindingConditions.push(`EXISTS (SELECT 1 FROM \`交易单号绑定采购单记录\` WHERE \`交易单号\` = \`${tableName}\`.\`交易账单号\`)`);
                }
                if (statusesToCheck.includes('非采购单流水')) {
                    bindingConditions.push(`EXISTS (SELECT 1 FROM \`非采购单流水记录\` WHERE \`账单流水\` = \`${tableName}\`.\`交易账单号\`)`);
                }
                if (hasNoBindingStatus) {
                    // "无绑定状态"与其他状态互斥，不能同时选择
                    if (statusesToCheck.length === 0) {
                        // 只选择了"无绑定状态"
                        bindingConditions.push(`NOT EXISTS (SELECT 1 FROM \`手动绑定对账单号\` WHERE \`交易单号\` = \`${tableName}\`.\`交易账单号\`)
                            AND NOT EXISTS (SELECT 1 FROM \`交易单号绑定采购单记录\` WHERE \`交易单号\` = \`${tableName}\`.\`交易账单号\`)
                            AND NOT EXISTS (SELECT 1 FROM \`非采购单流水记录\` WHERE \`账单流水\` = \`${tableName}\`.\`交易账单号\`)`);
                    }
                    // 如果同时选择了"无绑定状态"和其他状态，这是矛盾的，SQL层面不筛选，代码层面会过滤
                }

                // 如果有多于一个状态，使用AND连接（必须同时满足）
                if (bindingConditions.length > 0) {
                    whereClause += ' AND (' + bindingConditions.join(' AND ') + ')';
                }
            }

            // 查询数据（现在SQL层面已经进行了初步筛选）
            const dataQuery = `SELECT * FROM \`${tableName}\` WHERE ${whereClause} ORDER BY 账单交易时间 DESC LIMIT ? OFFSET ?`;
            const [rows]: any = await connection.execute(dataQuery, [...queryParams, limit * 3, offset]); // 查询3倍数据以确保筛选后有足够数据

            // 批量查询绑定状态信息（性能优化）
            const 交易账单号列表 = rows.map((row: any) => row.交易账单号).filter(Boolean);
            const bindingStatusMap = await this.getBatchBindingStatusInfo(connection, 交易账单号列表);

            // 转换日期格式并应用绑定状态信息
            const data = rows.map((row: any) => {
                if (row.账单交易时间) {
                    row.账单交易时间 = new Date(row.账单交易时间).toISOString();
                }

                // 从批量查询结果中获取绑定状态
                const bindingStatusInfo = bindingStatusMap.get(row.交易账单号) || { statuses: [], details: [], hasNonPurchaseBill: false };

                // 如果有绑定状态筛选，需要验证（确保准确性）
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
            });

            // 过滤掉null值（不满足筛选条件的记录）
            let filteredData = data.filter(record => record !== null);
            Logger.log(`[TransactionRecordService] After filtering binding statuses: ${filteredData.length} records`);

            // 如果有绑定状态筛选，只取需要的数量
            if (bindingStatuses && bindingStatuses.length > 0) {
                filteredData = filteredData.slice(0, limit);
            }

            // 查询总数
            let total = 0;
            if (!bindingStatuses || bindingStatuses.length === 0) {
                // 没有绑定状态筛选时，直接查询总数
                const countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\` WHERE ${whereClause}`;
                const [countResult]: any = await connection.execute(countQuery, queryParams);
                total = countResult[0]?.total || 0;
            } else {
                // 有绑定状态筛选时，由于已经在SQL层面筛选，可以直接使用COUNT
                // 但为了确保准确性，仍然需要验证绑定状态
                // 为了提高性能，限制查询数量
                const countLimit = 2000; // 最多验证2000条记录
                const allDataQuery = `SELECT 交易账单号 FROM \`${tableName}\` WHERE ${whereClause} ORDER BY 账单交易时间 DESC LIMIT ${countLimit}`;
                const [allRows]: any = await connection.execute(allDataQuery, queryParams);

                // 如果查询到的数据少于限制，说明已经查询完了所有数据
                if (allRows.length < countLimit) {
                    // 批量查询所有记录的绑定状态并验证
                    const all交易账单号列表 = allRows.map((row: any) => row.交易账单号).filter(Boolean);
                    const allBindingStatusMap = await this.getBatchBindingStatusInfo(connection, all交易账单号列表);

                    // 验证每条记录的绑定状态
                    let validCount = 0;
                    for (const row of allRows) {
                        const bindingStatusInfo = allBindingStatusMap.get(row.交易账单号) || { statuses: [], details: [], hasNonPurchaseBill: false };
                        const recordStatuses = bindingStatusInfo.statuses;
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
                } else {
                    // 数据量很大，使用估算值
                    // 由于SQL层面已经筛选，可以假设筛选后的数据符合条件
                    total = allRows.length;
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

    // 批量查询绑定状态信息（性能优化）
    private async getBatchBindingStatusInfo(connection: any, 交易账单号列表: string[]): Promise<Map<string, {
        statuses: string[];
        details: string[];
        hasNonPurchaseBill: boolean;
    }>> {
        const resultMap = new Map<string, {
            statuses: string[];
            details: string[];
            hasNonPurchaseBill: boolean;
        }>();

        if (交易账单号列表.length === 0) {
            return resultMap;
        }

        try {
            // 初始化所有交易账单号的结果
            交易账单号列表.forEach(交易账单号 => {
                resultMap.set(交易账单号, { statuses: [], details: [], hasNonPurchaseBill: false });
            });

            // 分批查询，每批最多1000个，避免IN查询参数过多
            const batchSize = 1000;
            for (let i = 0; i < 交易账单号列表.length; i += batchSize) {
                const batch = 交易账单号列表.slice(i, i + batchSize);
                const placeholders = batch.map(() => '?').join(',');

                // 批量查询1：查询'手动绑定对账单号'表
                const manualBindingQuery = `SELECT DISTINCT \`交易单号\` FROM \`手动绑定对账单号\` WHERE \`交易单号\` IN (${placeholders})`;
                const [manualBindingResult]: any = await connection.execute(manualBindingQuery, batch);
                manualBindingResult.forEach((row: any) => {
                    const 交易单号 = row.交易单号;
                    if (resultMap.has(交易单号)) {
                        resultMap.get(交易单号)!.statuses.push('已绑定采购单');
                    }
                });

                // 批量查询2：查询'交易单号绑定采购单记录'表
                const bindingRecordQuery = `SELECT DISTINCT \`交易单号\`, \`记录状态\` FROM \`交易单号绑定采购单记录\` WHERE \`交易单号\` IN (${placeholders}) AND \`记录状态\` IS NOT NULL AND \`记录状态\` != ''`;
                const [bindingRecordResult]: any = await connection.execute(bindingRecordQuery, batch);
                bindingRecordResult.forEach((row: any) => {
                    const 交易单号 = row.交易单号;
                    if (resultMap.has(交易单号)) {
                        const info = resultMap.get(交易单号)!;
                        if (!info.statuses.includes('已生成对账单')) {
                            info.statuses.push('已生成对账单');
                        }
                        const 记录状态 = row.记录状态;
                        if (记录状态) {
                            // 检查是否已存在该状态
                            const statusKey = `对账单记录状态:${记录状态}`;
                            if (!info.details.includes(statusKey)) {
                                info.details.push(statusKey);
                            }
                        }
                    }
                });

                // 批量查询3：查询'非采购单流水记录'表
                const nonPurchaseQuery = `SELECT DISTINCT \`账单流水\`, \`财务审核状态\` FROM \`非采购单流水记录\` WHERE \`账单流水\` IN (${placeholders}) AND \`财务审核状态\` IS NOT NULL AND \`财务审核状态\` != ''`;
                const [nonPurchaseResult]: any = await connection.execute(nonPurchaseQuery, batch);
                nonPurchaseResult.forEach((row: any) => {
                    const 账单流水 = row.账单流水;
                    if (resultMap.has(账单流水)) {
                        const info = resultMap.get(账单流水)!;
                        if (!info.statuses.includes('非采购单流水')) {
                            info.statuses.push('非采购单流水');
                        }
                        info.hasNonPurchaseBill = true;
                        const 财务审核状态 = row.财务审核状态;
                        if (财务审核状态) {
                            // 检查是否已存在该状态
                            const statusKey = `非采购单流水财务审核状态:${财务审核状态}`;
                            if (!info.details.includes(statusKey)) {
                                info.details.push(statusKey);
                            }
                        }
                    }
                });
            }

            return resultMap;
        } catch (error) {
            Logger.error(`[TransactionRecordService] Failed to get batch binding status:`, error);
            // 返回空结果
            交易账单号列表.forEach(交易账单号 => {
                resultMap.set(交易账单号, { statuses: [], details: [], hasNonPurchaseBill: false });
            });
            return resultMap;
        }
    }

    // 查询绑定状态信息（保留单条查询方法以兼容）
    private async getBindingStatusInfo(connection: any, 交易账单号: string): Promise<{
        statuses: string[];
        details: string[];
        hasNonPurchaseBill: boolean;
    }> {
        const batchResult = await this.getBatchBindingStatusInfo(connection, [交易账单号]);
        return batchResult.get(交易账单号) || { statuses: [], details: [], hasNonPurchaseBill: false };
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
                            // 公共字段
                            if (fieldName === '支付渠道') {
                                fieldConditions.push('支付渠道 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '支付账号') {
                                fieldConditions.push('支付账号 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '交易账单号') {
                                fieldConditions.push('交易账单号 LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '账单交易时间') {
                                // 账单交易时间是日期时间字段，需要使用 DATE_FORMAT 格式化后搜索
                                // 支持搜索年份（如2025）、日期、时间等
                                // 格式化后的字符串格式：2025-01-01 12:00:00，所以搜索 "2025" 可以匹配年份
                                // 确保字段不为 NULL，避免 DATE_FORMAT 返回 NULL 导致 LIKE 搜索失败
                                fieldConditions.push('账单交易时间 IS NOT NULL AND DATE_FORMAT(账单交易时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                fieldParams.push(`%${fieldValue}%`);
                            } else if (fieldName === '收支金额') {
                                const amount = parseFloat(fieldValue);
                                if (!isNaN(amount)) {
                                    if (amount >= 0) {
                                        fieldConditions.push('(收支金额 = ? OR 收支金额 = ?)');
                                        fieldParams.push(amount, -amount);
                                    } else {
                                        fieldConditions.push('收支金额 = ?');
                                        fieldParams.push(amount);
                                    }
                                }
                            }
                            // 1688先采后付渠道特有字段
                            else if (channel === '1688先采后付') {
                                if (fieldName === '订单号') {
                                    fieldConditions.push('订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '订单支付时间') {
                                    fieldConditions.push('订单支付时间 IS NOT NULL AND DATE_FORMAT(订单支付时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '订单名称') {
                                    fieldConditions.push('订单名称 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '支付金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`支付金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '确认收货金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`确认收货金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '确认收货时间') {
                                    fieldConditions.push('确认收货时间 IS NOT NULL AND DATE_FORMAT(确认收货时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '账期类型') {
                                    fieldConditions.push('账期类型 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '是否有退款') {
                                    fieldConditions.push('是否有退款 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '退款金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`退款金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                }
                            }
                            // 京东金融渠道特有字段
                            else if (channel === '京东金融') {
                                if (fieldName === '交易时间') {
                                    fieldConditions.push('交易时间 IS NOT NULL AND DATE_FORMAT(交易时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商户名称') {
                                    fieldConditions.push('商户名称 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易说明') {
                                    fieldConditions.push('交易说明 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '金额') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('金额 LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '收/付款方式') {
                                    fieldConditions.push('`收/付款方式` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易状态') {
                                    fieldConditions.push('交易状态 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '收/支') {
                                    fieldConditions.push('`收/支` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易分类') {
                                    fieldConditions.push('交易分类 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易订单号') {
                                    fieldConditions.push('交易订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商家订单号') {
                                    fieldConditions.push('商家订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '备注') {
                                    fieldConditions.push('备注 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                }
                            }
                            // 微信渠道特有字段
                            else if (channel === '微信') {
                                if (fieldName === '交易时间') {
                                    fieldConditions.push('交易时间 IS NOT NULL AND DATE_FORMAT(交易时间, \'%Y-%m-%d %H:%i:%s\') LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易类型') {
                                    fieldConditions.push('交易类型 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易对方') {
                                    fieldConditions.push('交易对方 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商品') {
                                    fieldConditions.push('商品 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '收/支') {
                                    fieldConditions.push('`收/支` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '金额(元)') {
                                    const amount = parseFloat(fieldValue);
                                    if (!isNaN(amount)) {
                                        fieldConditions.push('`金额(元)` LIKE ?');
                                        fieldParams.push(`%${fieldValue}%`);
                                    }
                                } else if (fieldName === '支付方式') {
                                    fieldConditions.push('支付方式 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '当前状态') {
                                    fieldConditions.push('当前状态 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易单号') {
                                    fieldConditions.push('交易单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商户单号') {
                                    fieldConditions.push('商户单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '备注') {
                                    fieldConditions.push('备注 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                }
                            }
                            // 支付宝渠道特有字段
                            else if (channel === '支付宝') {
                                if (fieldName === '交易时间') {
                                    fieldConditions.push('交易时间 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易分类') {
                                    fieldConditions.push('交易分类 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易对方') {
                                    fieldConditions.push('交易对方 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '对方账号') {
                                    fieldConditions.push('对方账号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商品说明') {
                                    fieldConditions.push('商品说明 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '收/支') {
                                    fieldConditions.push('`收/支` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '金额') {
                                    fieldConditions.push('金额 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '收/付款方式') {
                                    fieldConditions.push('`收/付款方式` LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易状态') {
                                    fieldConditions.push('交易状态 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '交易订单号') {
                                    fieldConditions.push('交易订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '商家订单号') {
                                    fieldConditions.push('商家订单号 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
                                } else if (fieldName === '备注') {
                                    fieldConditions.push('备注 LIKE ?');
                                    fieldParams.push(`%${fieldValue}%`);
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
                    if (channel === '1688先采后付') {
                        // 1688先采后付渠道的通用搜索
                        whereClause += ` AND (
              交易账单号 LIKE ? OR 
              支付账号 LIKE ? OR
              支付渠道 LIKE ? OR
              订单号 LIKE ? OR
              订单名称 LIKE ? OR
              备注 LIKE ?
            )`;
                        queryParams.push(
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`
                        );
                    } else if (channel === '京东金融') {
                        // 京东金融渠道的通用搜索
                        whereClause += ` AND (
              交易账单号 LIKE ? OR 
              支付账号 LIKE ? OR
              支付渠道 LIKE ? OR
              商户名称 LIKE ? OR
              交易说明 LIKE ? OR
              交易订单号 LIKE ? OR
              商家订单号 LIKE ? OR
              备注 LIKE ?
            )`;
                        queryParams.push(
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`
                        );
                    } else if (channel === '微信') {
                        // 微信渠道的通用搜索
                        whereClause += ` AND (
              交易账单号 LIKE ? OR 
              支付账号 LIKE ? OR
              支付渠道 LIKE ? OR
              交易类型 LIKE ? OR
              交易对方 LIKE ? OR
              商品 LIKE ? OR
              交易单号 LIKE ? OR
              商户单号 LIKE ? OR
              备注 LIKE ?
            )`;
                        queryParams.push(
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`
                        );
                    } else if (channel === '支付宝') {
                        // 支付宝渠道的通用搜索范围更广
                        whereClause += ` AND (
              交易账单号 LIKE ? OR 
              支付账号 LIKE ? OR
              支付渠道 LIKE ? OR
              交易分类 LIKE ? OR
              交易对方 LIKE ? OR
              对方账号 LIKE ? OR
              商品说明 LIKE ? OR
              交易订单号 LIKE ? OR
              商家订单号 LIKE ? OR
              备注 LIKE ?
            )`;
                        queryParams.push(`%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`,
                            `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`);
                    } else {
                        // 其他渠道的通用搜索（兜底）
                        whereClause += ` AND (
              交易账单号 LIKE ? OR 
              支付账号 LIKE ? OR
              支付渠道 LIKE ?
            )`;
                        queryParams.push(`%${generalSearchTerm}%`, `%${generalSearchTerm}%`, `%${generalSearchTerm}%`);
                    }
                }
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

