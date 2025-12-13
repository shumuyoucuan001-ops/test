import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

export interface LabelPrintItem {
  templateName: string; // 标签模板
  spuCode: string; // SPU编码
  productName: string; // 商品名称
  skuCode: string; // SKU编码
  spec: string; // 规格
  productCode: string; // 商品条码
  barcodeTail: string; // 核对条码尾号
  factoryName?: string; // 厂家名称
  headerInfo?: string; // 抬头信息
  productSpec?: string; // 产品规格（用于合格证）
  executeStandard?: string; // 执行标准
  addressInfo?: string; // 地址信息
  material?: string; // 材质
  otherInfo?: string; // 其他信息
}

@Injectable()
export class LabelPrintService {
  constructor(private prisma: PrismaService) { }

  private tailBarcode(code?: string): string {
    if (!code) return '';
    const normalized = String(code).replace(/，/g, ',');
    const firstPart = normalized.split(',')[0]?.trim() || '';
    const base = firstPart || normalized.trim();
    return base.length > 8 ? base.slice(-8) : base;
  }

  private async fetchProductNameBySkuOrBarcode(sku: string, productCode?: string): Promise<string | undefined> {
    try {
      const firstBarcode = this.tailBarcode(productCode || '');
      const like = `%${productCode || ''}%`;
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT \`商品名称\` AS name
         FROM \`sm_shangping\`.\`商品主档销售规格\`
         WHERE \`SKU编码\` = ?
            OR FIND_IN_SET(?, REPLACE(\`商品条码\`, '，', ','))
            OR \`商品条码\` LIKE ?
         LIMIT 1`,
        sku.trim(), firstBarcode, like
      );
      if (rows && rows.length) return String(rows[0]?.name || '');
    } catch (_) { }
    return undefined;
  }

  async search(q: string): Promise<LabelPrintItem[]> {
    const kw = `%${q || ''}%`;
    // 先取原视图结果，再并行补齐商品名称（最多20条，性能可接受）
    const baseRows: any[] = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM `sm_shangping`.`商品标签打印` WHERE `SPU编码` LIKE ? OR `SKU编码` LIKE ? OR `商品条码` LIKE ? LIMIT 20',
      kw, kw, kw,
    );

    const results = await Promise.all(
      (baseRows || []).map(async (r: any) => {
        const sku = String(r['SKU编码'] ?? '').trim();
        // 优先使用"商品标签"表中的"产品名称"
        let nameFromLabel: string | undefined;
        try {
          const rows: any[] = await this.prisma.$queryRawUnsafe(
            'SELECT `产品名称` FROM `sm_shangping`.`商品标签` WHERE (`SKU` = ? OR `SKU编码` = ? OR `sku` = ?) LIMIT 1',
            sku, sku, sku,
          );
          if (rows && rows.length) nameFromLabel = String(rows[0]['产品名称'] || '').trim() || undefined;
        } catch { }
        const nameFromMaster = nameFromLabel === undefined && sku
          ? await this.fetchProductNameBySkuOrBarcode(sku, String(r['商品条码'] ?? ''))
          : nameFromLabel;

        // 从商品主档销售规格表获取规格名称
        let spec = '';
        if (sku) {
          try {
            const specRows: any[] = await this.prisma.$queryRawUnsafe(
              'SELECT `规格名称` AS spec FROM `sm_shangping`.`商品主档销售规格` WHERE `SKU编码` = ? LIMIT 1',
              sku,
            );
            if (specRows && specRows.length && specRows[0]?.spec) {
              spec = String(specRows[0].spec);
            }
          } catch (err) {
            // 查询失败时记录错误但不中断流程
            Logger.error(`[label-print] Error querying spec for SKU=${sku}:`, err);
          }
        }
        // 如果从主表查不到，fallback到视图数据
        if (!spec) {
          spec = String(r['规格'] ?? '');
        }

        return {
          templateName: String(r['标签模板'] ?? ''),
          spuCode: String(r['SPU编码'] ?? ''),
          productName: String(nameFromMaster || ''),
          skuCode: sku,
          spec: spec,
          productCode: String(r['商品条码'] ?? ''),
          factoryName: r['厂家名称'] ? String(r['厂家名称']) : undefined,
          headerInfo: r['抬头信息'] ? String(r['抬头信息']) : undefined,
          productSpec: r['产品规格'] ? String(r['产品规格']) : undefined,
          executeStandard: r['执行标准'] ? String(r['执行标准']) : undefined,
          addressInfo: r['地址信息'] ? String(r['地址信息']) : undefined,
          material: r['材质'] ? String(r['材质']) : undefined,
          otherInfo: r['其他信息'] ? String(r['其他信息']) : undefined,
          barcodeTail: this.tailBarcode(String(r['商品条码'] ?? '')),
        } as LabelPrintItem;
      })
    );

    return results;
  }
}


