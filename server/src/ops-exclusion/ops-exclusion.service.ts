
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OpsExclusionItem {
    '视图名称': string;
    '门店编码': string;
    'SKU编码': string;
    'SPU编码': string;
}

@Injectable()
export class OpsExclusionService {
    constructor(private prisma: PrismaService) { }

    private table = '`sm_cuxiaohuodong`.`活动视图排除规则`';

    async list(q?: string): Promise<OpsExclusionItem[]> {
        const keyword = (q || '').trim();
        let sql: string;
        let params: any[] = [];

        if (keyword) {
            const like = `%${keyword}%`;
            sql = `SELECT \`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\`
         FROM ${this.table}
         WHERE \`视图名称\` LIKE ? OR \`门店编码\` LIKE ? OR \`SKU编码\` LIKE ? OR \`SPU编码\` LIKE ?
         ORDER BY \`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\``;
            params = [like, like, like, like];
        } else {
            sql = `SELECT \`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\`
         FROM ${this.table}
         ORDER BY \`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\``;
        }

        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
        return (rows || []).map(r => ({
            '视图名称': String(r['视图名称'] || ''),
            '门店编码': String(r['门店编码'] || ''),
            'SKU编码': String(r['SKU编码'] || ''),
            'SPU编码': String(r['SPU编码'] || ''),
        }));
    }

    async create(item: OpsExclusionItem): Promise<void> {
        this.validate(item);
        await this.prisma.$executeRawUnsafe(
            `INSERT INTO ${this.table} (\`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\`) VALUES (?, ?, ?, ?)`,
            item['视图名称'] || '',
            item['门店编码'] || '',
            item['SKU编码'] || '',
            item['SPU编码'] || '',
        );
    }

    async update(original: OpsExclusionItem, data: OpsExclusionItem): Promise<void> {
        this.validate(data);
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE ${this.table}
       SET \`视图名称\`=?, \`门店编码\`=?, \`SKU编码\`=?, \`SPU编码\`=?
       WHERE \`视图名称\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`SKU编码\`, '') = COALESCE(?, '') AND COALESCE(\`SPU编码\`, '') = COALESCE(?, '')`,
            data['视图名称'] || '', data['门店编码'] || '', data['SKU编码'] || '', data['SPU编码'] || '',
            original['视图名称'] || '', original['门店编码'] || '', original['SKU编码'] || '', original['SPU编码'] || '',
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到原记录，更新失败');
        }
    }

    async remove(item: OpsExclusionItem): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`视图名称\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`SKU编码\`, '') = COALESCE(?, '') AND COALESCE(\`SPU编码\`, '') = COALESCE(?, '')`,
            item['视图名称'] || '', item['门店编码'] || '', item['SKU编码'] || '', item['SPU编码'] || '',
        );
        // @ts-ignore
        if (!affected) {
            throw new BadRequestException('未找到记录，删除失败');
        }
    }

    private validate(item: OpsExclusionItem) {
        if (!item['视图名称']) {
            throw new BadRequestException('视图名称为必填');
        }
    }
}
