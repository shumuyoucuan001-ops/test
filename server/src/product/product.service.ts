import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 临时内存存储，模拟商品数据（等数据库连接问题解决后切换回 Prisma）
export interface ProductSalesSpec {
  id: number;
  productCode: string;  // 商品条码
  skuCode: string;      // SKU编码
  productName: string;  // 商品名称
  spec?: string;        // 规格
  unit?: string;        // 单位
  price?: number;       // 价格
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductLabel {
  id: number;
  productCode: string;  // 商品条码
  labelName: string;    // 标签名称
  labelContent: string; // 标签内容HTML
  isActive: boolean;    // 是否启用
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithLabels {
  product: ProductSalesSpec;
  labels: ProductLabel[];
}

@Injectable()
export class ProductService {
  private products: ProductSalesSpec[] = [];
  private productLabels: ProductLabel[] = [];
  private nextLabelId = 1;

  constructor(private prisma: PrismaService) {
    // 初始化示例商品数据
    this.initSampleData();
    this.initSampleLabels();
  }

  private initSampleData() {
    const sampleProducts: ProductSalesSpec[] = [
      {
        id: 1,
        productCode: '6901028089296',
        skuCode: 'SKU001',
        productName: '可口可乐 330ml',
        spec: '330ml',
        unit: '瓶',
        price: 3.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        productCode: '6901028089302',
        skuCode: 'SKU002',
        productName: '百事可乐 500ml',
        spec: '500ml',
        unit: '瓶',
        price: 4.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        productCode: '6901028089319',
        skuCode: 'SKU003',
        productName: '雪碧 330ml',
        spec: '330ml',
        unit: '瓶',
        price: 3.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 4,
        productCode: '6901028089326',
        skuCode: 'SKU004',
        productName: '芬达橙味 500ml',
        spec: '500ml',
        unit: '瓶',
        price: 4.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 5,
        productCode: '6901028089333',
        skuCode: 'SKU005',
        productName: '康师傅绿茶 500ml',
        spec: '500ml',
        unit: '瓶',
        price: 3.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    this.products = sampleProducts;
  }

  private initSampleLabels() {
    const sampleLabels: ProductLabel[] = [
      {
        id: this.nextLabelId++,
        productCode: '6901028089296',
        labelName: '可口可乐标签',
        labelContent: '<div>可口可乐专用标签内容</div>',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: this.nextLabelId++,
        productCode: '6901028089302',
        labelName: '百事可乐标签',
        labelContent: '<div>百事可乐专用标签内容</div>',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    this.productLabels = sampleLabels;
  }

  // 将数据库记录映射为标准结构
  private mapDbRowToProduct(row: any): ProductSalesSpec {
    return {
      id: 0,
      productCode: String(row.productCode ?? ''),
      skuCode: String(row.skuCode ?? ''),
      productName: String(row.productName ?? ''),
      spec: row.spec ? String(row.spec) : undefined,
      unit: row.unit ? String(row.unit) : undefined,
      price: row.price != null ? Number(row.price) : undefined,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
    };
  }

  // 根据商品条码搜索（优先数据库，失败回退内存）
  async findByBarcode(barcode: string): Promise<ProductSalesSpec | null> {
    try {
      const like = `%${barcode}%`;
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT 
           0 AS id,
           \`商品条码\`       AS productCode,
           \`SKU编码\`        AS skuCode,
           \`商品名称\`       AS productName,
           \`规格名称\`       AS spec,
           COALESCE(\`商品售卖单位\`, \`货品单位1\`) AS unit,
           CAST(\`总部零售价\` AS DECIMAL(10,2)) AS price,
           \`商品创建时间\`   AS createdAt,
           \`数据更新时间\`   AS updatedAt
         FROM \`sm_shangping\`.\`商品主档销售规格\`
         WHERE \`商品条码\` = ?
            OR FIND_IN_SET(?, REPLACE(\`商品条码\`, '，', ','))
            OR \`商品条码\` LIKE ?
         LIMIT 1`,
        barcode, barcode, like
      );
      if (rows && rows.length > 0) {
        return this.mapDbRowToProduct(rows[0]);
      }
    } catch (e) {
      // ignore and fallback
    }
    const product = this.products.find(p => p.productCode.includes(barcode));
    return product || null;
  }

  // 根据SKU编码搜索（优先数据库）
  async findBySkuCode(skuCode: string): Promise<ProductSalesSpec | null> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT 
           0 AS id,
           \`商品条码\`       AS productCode,
           \`SKU编码\`        AS skuCode,
           \`商品名称\`       AS productName,
           \`规格名称\`       AS spec,
           COALESCE(\`商品售卖单位\`, \`货品单位1\`) AS unit,
           CAST(\`总部零售价\` AS DECIMAL(10,2)) AS price,
           \`商品创建时间\`   AS createdAt,
           \`数据更新时间\`   AS updatedAt
         FROM \`sm_shangping\`.\`商品主档销售规格\`
         WHERE \`SKU编码\` = ?
         LIMIT 1`,
        skuCode
      );
      if (rows && rows.length > 0) {
        return this.mapDbRowToProduct(rows[0]);
      }
    } catch (e) {}
    const product = this.products.find(p => p.skuCode === skuCode);
    return product || null;
  }

  // 模糊搜索商品（支持商品名称、条码、SKU） 优先数据库，失败回退
  async search(keyword: string): Promise<ProductSalesSpec[]> {
    try {
      if (!keyword) return [];
      const kw = `%${keyword}%`;
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT 
           0 AS id,
           \`商品条码\`       AS productCode,
           \`SKU编码\`        AS skuCode,
           \`商品名称\`       AS productName,
           \`规格名称\`       AS spec,
           COALESCE(\`商品售卖单位\`, \`货品单位1\`) AS unit,
           CAST(\`总部零售价\` AS DECIMAL(10,2)) AS price,
           \`商品创建时间\`   AS createdAt,
           \`数据更新时间\`   AS updatedAt
         FROM \`sm_shangping\`.\`商品主档销售规格\`
         WHERE \`商品名称\` LIKE ?
            OR \`商品条码\` LIKE ?
            OR \`SKU编码\` LIKE ?
         LIMIT 10`,
        kw, kw, kw
      );
      return rows.map(r => this.mapDbRowToProduct(r));
    } catch (e) {
      const lowerKeyword = (keyword || '').toLowerCase();
      return this.products.filter(p =>
        p.productName.toLowerCase().includes(lowerKeyword) ||
        p.productCode.includes(keyword) ||
        p.skuCode.toLowerCase().includes(lowerKeyword) ||
        (p.spec && p.spec.toLowerCase().includes(lowerKeyword))
      );
    }
  }

  // 获取所有商品
  async findAll(): Promise<ProductSalesSpec[]> {
    return this.products;
  }

  // 根据ID获取商品
  async findById(id: number): Promise<ProductSalesSpec> {
    const product = this.products.find(p => p.id === id);
    if (!product) {
      throw new NotFoundException(`商品 ID ${id} 不存在`);
    }
    return product;
  }

  // 获取所有商品及其标签信息
  async findAllWithLabels(): Promise<ProductWithLabels[]> {
    return this.products.map(product => ({
      product,
      labels: this.productLabels.filter(label => label.productCode === product.productCode)
    }));
  }

  // 根据商品条码获取标签
  async getLabelsByProductCode(productCode: string): Promise<ProductLabel[]> {
    return this.productLabels.filter(label => label.productCode === productCode);
  }

  // 更新商品信息
  async updateProduct(id: number, updateData: Partial<ProductSalesSpec>): Promise<ProductSalesSpec> {
    const product = await this.findById(id);
    Object.assign(product, {
      ...updateData,
      updatedAt: new Date(),
    });
    return product;
  }

  // 创建商品标签
  async createLabel(labelData: Omit<ProductLabel, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductLabel> {
    const newLabel: ProductLabel = {
      id: this.nextLabelId++,
      ...labelData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.productLabels.push(newLabel);
    return newLabel;
  }

  // 更新商品标签
  async updateLabel(id: number, updateData: Partial<ProductLabel>): Promise<ProductLabel> {
    const label = this.productLabels.find(l => l.id === id);
    if (!label) {
      throw new NotFoundException(`标签 ID ${id} 不存在`);
    }
    Object.assign(label, {
      ...updateData,
      updatedAt: new Date(),
    });
    return label;
  }

  // 删除商品标签
  async deleteLabel(id: number): Promise<ProductLabel> {
    const index = this.productLabels.findIndex(l => l.id === id);
    if (index === -1) {
      throw new NotFoundException(`标签 ID ${id} 不存在`);
    }
    const deletedLabel = this.productLabels.splice(index, 1)[0];
    return deletedLabel;
  }
}
