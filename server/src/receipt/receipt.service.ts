import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductSalesSpec, ProductService } from '../product/product.service';

// 临时内存存储，模拟收货单数据
export interface ReceiptDetail {
  id: number;
  receiptNo: string;     // 收货单号
  sku: string;           // SKU编码
  productName: string;   // 商品名称
  quantity: number;      // 数量
  price?: number;        // 价格
  totalAmount?: number;  // 总金额
  createdAt: Date;
  updatedAt: Date;
  supplierName?: string; // 供应商名称（来自采购单商品明细）
}

// 收货单明细与商品信息的组合
export interface ReceiptDetailWithProduct {
  receiptDetail: ReceiptDetail;
  productInfo?: ProductSalesSpec;  // 关联的商品信息
}

@Injectable()
export class ReceiptService {
  private receiptDetails: ReceiptDetail[] = [];

  constructor(
    private prisma: PrismaService,
    private productService: ProductService
  ) {
    // 初始化示例收货单数据
    this.initSampleData();
  }

  private initSampleData() {
    const sampleReceipts: ReceiptDetail[] = [
      // 添加一个包含标签资料SKU的测试收货单
      {
        id: 999,
        receiptNo: 'TEST-CERTIFICATE-001',
        sku: '1925487722303479852',
        productName: '测试合格证商品',
        quantity: 10,
        price: 5.0,
        totalAmount: 50.0,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplierName: '(推)13334436',
      },
      // 添加一个厂家名称为空的测试收货单（应该使用合格证模板）
      {
        id: 998,
        receiptNo: 'TEST-EMPTY-MANUFACTURER-001',
        sku: 'TEST-EMPTY-MANUFACTURER',
        productName: '测试厂家名称为空商品',
        quantity: 5,
        price: 10.0,
        totalAmount: 50.0,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplierName: '测试供应商',
      },
      {
        id: 1,
        receiptNo: 'SH202501001',
        sku: 'SKU001',
        productName: '可口可乐 330ml',
        quantity: 100,
        price: 3.5,
        totalAmount: 350.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        receiptNo: 'SH202501001',
        sku: 'SKU002',
        productName: '百事可乐 500ml',
        quantity: 80,
        price: 4.0,
        totalAmount: 320.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        receiptNo: 'SH202501002',
        sku: 'SKU003',
        productName: '雪碧 330ml',
        quantity: 60,
        price: 3.5,
        totalAmount: 210.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 4,
        receiptNo: 'SH202501002',
        sku: 'SKU004',
        productName: '芬达橙味 500ml',
        quantity: 40,
        price: 4.5,
        totalAmount: 180.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 5,
        receiptNo: 'SH202501003',
        sku: 'SKU005',
        productName: '康师傅绿茶 500ml',
        quantity: 120,
        price: 3.0,
        totalAmount: 360.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    this.receiptDetails = sampleReceipts;
  }

  // 动态获取第一匹配列名
  private pickValue(row: any, candidates: string[], fallback: any = null) {
    for (const key of Object.keys(row)) {
      if (candidates.includes(key)) return row[key];
    }
    return fallback;
  }

  // 根据关联收货单号搜索采购明细（重新设计的数据获取逻辑）
  async findByReceiptNo(receiptNo: string): Promise<ReceiptDetailWithProduct[]> {
    try {
      console.log(`[ReceiptService] 查询收货单: ${receiptNo}`);
      
      // 第一步：通过收货单号获取采购单商品明细
      let rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT d.\`sku_id\`, d.\`计划采购数量(基础单位)\`, d.\`供应商名称\`, d.\`采购单号\`
         FROM \`sm_chaigou\`.\`采购单商品明细\` d
         JOIN \`sm_chaigou\`.\`待收货采购收货单号\` v
           ON TRIM(d.\`采购单号\`) = TRIM(v.\`待收货采购单\`)
         WHERE TRIM(v.\`待收货单号\`) = TRIM(?)`,
        receiptNo,
      );
      
      // 若视图没有匹配，回退到"采购单信息.关联收货单号"方式
      if (!rows || rows.length === 0) {
        rows = await this.prisma.$queryRawUnsafe(
          `SELECT d.\`sku_id\`, d.\`计划采购数量(基础单位)\`, d.\`供应商名称\`, d.\`采购单号\`
           FROM \`sm_chaigou\`.\`采购单商品明细\` d
           JOIN \`sm_chaigou\`.\`采购单信息\` i 
             ON TRIM(d.\`采购单号\`) = TRIM(i.\`采购单号\`)
           WHERE TRIM(i.\`关联收货单号\`) = TRIM(?)`,
          receiptNo,
        );
      }

      const details: ReceiptDetailWithProduct[] = [];
      let idx = 1;
      
      for (const r of rows) {
        const skuId = String(r.sku_id || '');
        const quantity = Number(r['计划采购数量(基础单位)'] || 0);
        const supplierName = String(r['供应商名称'] || '');
        
        console.log(`[ReceiptService] 处理商品: SKU=${skuId}, 数量=${quantity}, 供应商=${supplierName}`);
        
        if (!skuId) {
          console.log(`[ReceiptService] 跳过空SKU的记录`);
          continue;
        }

        // 第二步：通过sku_id连接商品主档销售规格表获取商品信息
        let productInfo: any = null;
        try {
          const productRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT \`商品名称\`, \`商品条码\`, \`规格名称\`, \`SKU编码\`
             FROM \`sm_shangping\`.\`商品主档销售规格\`
             WHERE \`SKU编码\` = ?`,
            skuId,
          );
          
          if (productRows && productRows.length > 0) {
            const p = productRows[0];
            productInfo = {
              skuCode: String(p['SKU编码'] || skuId),
              productName: String(p['商品名称'] || ''),
              productCode: String(p['商品条码'] || ''),
              spec: String(p['规格名称'] || ''),
            };
            
            // 计算核对条码尾号
            const productCode = productInfo.productCode;
            let barcodeTail = '';
            if (productCode) {
              if (productCode.includes(',')) {
                // 有逗号时取第一个逗号前面条码的最后8个字符
                const firstBarcode = productCode.split(',')[0].trim();
                barcodeTail = firstBarcode.slice(-8);
              } else {
                // 没有逗号时取最后8个字符
                barcodeTail = productCode.slice(-8);
              }
            }
            productInfo.barcodeTail = barcodeTail;
            
            console.log(`[ReceiptService] 获取到商品信息:`, productInfo);
          }
        } catch (error) {
          console.error(`[ReceiptService] 获取商品信息失败:`, error);
        }

        // 第三步：通过sku_id和供应商名称连接label_data_audit表获取标签资料
        let labelData: any = null;
        try {
          const labelRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT \`header_info\`, \`execution_standard\`, \`product_name\`, 
                    \`manufacturer_name\`, \`address_info\`, \`material\`, \`other_info\`
             FROM \`sm_xitongkaifa\`.\`label_data_audit\`
             WHERE \`sku\` = ? AND \`supplier_name\` = ?`,
            skuId,
            supplierName,
          );
          
          if (labelRows && labelRows.length > 0) {
            const l = labelRows[0];
            labelData = {
              headerInfo: String(l.header_info || ''),
              executionStandard: String(l.execution_standard || ''),
              productName: String(l.product_name || ''),
              manufacturerName: String(l.manufacturer_name || ''),
              addressInfo: String(l.address_info || ''),
              material: String(l.material || ''),
              otherInfo: String(l.other_info || ''),
            };
            console.log(`[ReceiptService] 获取到标签资料:`, labelData);
          }
        } catch (error) {
          console.error(`[ReceiptService] 获取标签资料失败:`, error);
        }

        const detail: ReceiptDetail = {
          id: idx++,
          receiptNo,
          sku: skuId,
          productName: productInfo?.productName || '',
          quantity: quantity,
          price: undefined,
          totalAmount: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          supplierName: supplierName,
        };

        // 将标签资料附加到productInfo中
        const enrichedProductInfo = {
          ...productInfo,
          labelData: labelData,
        };

        details.push({ 
          receiptDetail: detail, 
          productInfo: enrichedProductInfo || undefined 
        });
      }
      
      console.log(`[ReceiptService] 返回${details.length}条记录`);
      if (details.length > 0) return details;
    } catch (error) {
      console.error(`[ReceiptService] 查询收货单明细失败:`, error);
    }

    // fallback to in-memory
    console.log(`[ReceiptService] 回退到内存数据`);
    const mem = this.receiptDetails.filter(r => r.receiptNo === receiptNo);
    const detailsWithProduct: ReceiptDetailWithProduct[] = [];
    for (const detail of mem) {
      const productInfo = await this.productService.findBySkuCode(detail.sku);
      detailsWithProduct.push({ receiptDetail: detail, productInfo: productInfo || undefined });
    }
    return detailsWithProduct;
  }

  // 获取所有关联收货单号（去重） 优先数据库
  async getAllReceiptNumbers(): Promise<string[]> {
    try {
      // 视图来源
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        'SELECT DISTINCT TRIM(`待收货单号`) AS no FROM `sm_chaigou`.`待收货采购收货单号` WHERE `待收货单号` IS NOT NULL AND TRIM(`待收货单号`) <> "" ORDER BY no DESC LIMIT 1000'
      );
      const list = rows.map(r => String(r.no)).filter(Boolean);
      // 追加从采购单信息的关联收货单号来源（去重）
      try {
        const rows2: any[] = await this.prisma.$queryRawUnsafe(
          'SELECT DISTINCT TRIM(`关联收货单号`) AS no FROM `sm_chaigou`.`采购单信息` WHERE `关联收货单号` IS NOT NULL AND TRIM(`关联收货单号`) <> "" ORDER BY no DESC LIMIT 1000'
        );
        for (const r of rows2) {
          const val = String(r.no);
          if (val && !list.includes(val)) list.push(val);
        }
      } catch {}
      if (list.length > 0) return list;
    } catch (e) {}
    const receiptNumbers = [...new Set(this.receiptDetails.map(r => r.receiptNo))];
    return receiptNumbers.sort();
  }

  // 根据关联收货单号搜索（模糊匹配） 优先数据库，支持物流信息搜索
  async searchReceiptNumbers(keyword: string): Promise<string[]> {
    const kw = `%${keyword || ''}%`;
    try {
      if (!keyword) return this.getAllReceiptNumbers();
      // 视图模糊匹配"待收货单号"和"物流信息"
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        'SELECT DISTINCT TRIM(`待收货单号`) AS no FROM `sm_chaigou`.`待收货采购收货单号` WHERE (TRIM(`待收货单号`) LIKE ? OR TRIM(`物流信息`) LIKE ?) ORDER BY no DESC LIMIT 100',
        kw,
        kw,
      );
      const list = rows.map(r => String(r.no)).filter(Boolean);
      // 追加从采购单信息的关联收货单号模糊匹配
      try {
        const rows2: any[] = await this.prisma.$queryRawUnsafe(
          'SELECT DISTINCT TRIM(`关联收货单号`) AS no FROM `sm_chaigou`.`采购单信息` WHERE TRIM(`关联收货单号`) LIKE ? ORDER BY no DESC LIMIT 100',
          kw,
        );
        for (const r of rows2) {
          const val = String(r.no);
          if (val && !list.includes(val)) list.push(val);
        }
      } catch {}
      if (list.length > 0) return list;
    } catch (e) {}
    const allNumbers = await this.getAllReceiptNumbers();
    return allNumbers.filter(no => no.toLowerCase().includes((keyword || '').toLowerCase()));
  }

  // 获取收货单统计信息
  async getReceiptSummary(receiptNo: string): Promise<{
    receiptNo: string;
    totalItems: number;
    totalQuantity: number;
    totalAmount: number;
    details: ReceiptDetailWithProduct[];
  }> {
    const details = await this.findByReceiptNo(receiptNo);

    const totalItems = details.length;
    const totalQuantity = details.reduce((sum, d) => sum + d.receiptDetail.quantity, 0);
    const totalAmount = details.reduce((sum, d) => sum + (d.receiptDetail.totalAmount || 0), 0);

    return {
      receiptNo,
      totalItems,
      totalQuantity,
      totalAmount,
      details,
    };
  }
}
