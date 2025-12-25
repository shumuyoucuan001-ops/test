import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('product-master')
export class ProductMasterController {
  constructor(private prisma: PrismaService) { }

  @Get('columns')
  async columns() {
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'sm_shangping' AND TABLE_NAME = '商品主档销售规格'
       ORDER BY ORDINAL_POSITION`
    );
    return rows || [];
  }

  @Get()
  async list(@Query('q') q?: string, @Query('limit') limit?: string) {
    const kw = (q || '').trim();
    const max = Math.max(1, Math.min(Number(limit) || 200, 2000));
    let where = '';
    let params: any[] = [];
    if (kw) {
      where = `WHERE \`SPU编码\` LIKE ? OR \`商品名称\` LIKE ? OR \`SKU编码\` LIKE ? OR \`商品条码\` LIKE ?`;
      const like = `%${kw}%`;
      params = [like, like, like, like];
    }
    const sql = `SELECT \`SPU编码\` AS spuCode, \`商品名称\` AS productName, \`规格名称\` AS spec, \`SKU编码\` AS skuCode, \`商品条码\` AS productCode, \`拣货标准\` AS pickingStandard
                FROM \`sm_shangping\`.\`商品主档销售规格\`
                ${where}
                ORDER BY \`SPU编码\` ASC
                LIMIT ${max}`;
    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
    return rows || [];
  }

  @Get(':sku')
  async detail(@Param('sku') sku: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`sm_shangping\`.\`商品主档销售规格\` WHERE \`SKU编码\` = ? LIMIT 1`,
      sku,
    );
    return rows?.[0] || null;
  }

  @Get(':sku/product-info')
  async getProductInfo(@Param('sku') sku: string) {
    // 从仓店补货参考表查询数据（使用聚合查询）
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        MAX(\`商品名称\`) AS productName, 
        MAX(\`商品UPC\`) AS productCode, 
        MAX(\`规格\`) AS specName,
        MAX(\`采购单价 (基础单位)\`) AS purchasePriceBase,
        MAX(\`采购单价 (采购单位)\`) AS purchasePriceUnit
       FROM \`sm_chaigou\`.\`仓店补货参考\`
       WHERE \`商品SKU\` = ? 
       GROUP BY \`商品SKU\`
       LIMIT 1`,
      sku,
    );
    if (rows && rows.length > 0) {
      return {
        productName: rows[0].productName || null,
        productCode: rows[0].productCode || null,
        specName: rows[0].specName || null,
        purchasePriceBase: rows[0].purchasePriceBase || null,
        purchasePriceUnit: rows[0].purchasePriceUnit || null,
      };
    }
    return null;
  }
}


