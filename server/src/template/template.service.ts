import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

export interface LabelTemplate {
  id: number;
  name: string;
  content: string;
  contentTspl?: string;
  isDefault: boolean;
  productCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TemplateService {

  constructor(private prisma: PrismaService) {}

  private dbName: string | null = null;
  private async getDbName(): Promise<string> {
    if (this.dbName) return this.dbName;
    // 强制使用 sm_xitongkaifa 数据库
    this.dbName = 'sm_xitongkaifa';
    return this.dbName;
  }

  private async ensureTable() {
    const db = await this.getDbName();
    await this.prisma.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${db}\`.\`label_templates\` (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(128) NOT NULL,
        content MEDIUMTEXT NOT NULL,
        content_tspl LONGTEXT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        product_code VARCHAR(128) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 兼容旧表：缺少列时自动补齐
    try {
      const colTspl: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(1) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='label_templates' AND COLUMN_NAME='content_tspl'`
      );
      if (Number(colTspl?.[0]?.c || 0) === 0) {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE \`${db}\`.\`label_templates\` ADD COLUMN \`content_tspl\` LONGTEXT NULL AFTER \`content\``
        );
      }
    } catch {}
    try {
      const colProduct: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(1) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='label_templates' AND COLUMN_NAME='product_code'`
      );
      if (Number(colProduct?.[0]?.c || 0) === 0) {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE \`${db}\`.\`label_templates\` ADD COLUMN \`product_code\` VARCHAR(128) NULL AFTER \`is_default\``
        );
      }
    } catch {}
    try { await this.prisma.$executeRawUnsafe(`CREATE INDEX \`idx_label_templates_name\` ON \`${db}\`.\`label_templates\`(name)`); } catch {}
    try { await this.prisma.$executeRawUnsafe(`CREATE INDEX \`idx_label_templates_product\` ON \`${db}\`.\`label_templates\`(product_code)`); } catch {}
    await this.seedDefaultsIfEmpty();
  }

  private mapRow(row: any): LabelTemplate {
    return {
      id: Number(row.id),
      name: String(row.name),
      content: String(row.content || ''),
      contentTspl: row.content_tspl ? String(row.content_tspl) : '',
      isDefault: Number(row.is_default) === 1,
      productCode: row.product_code ? String(row.product_code) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private async seedDefaultsIfEmpty() {
    const db = await this.getDbName();
    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT COUNT(1) AS c FROM \`${db}\`.\`label_templates\``);
    const count = Number(rows?.[0]?.c || 0);
    if (count > 0) return;

    const defaultContent = `<div style=\"width: 40mm; height: 30mm; border: 1px dashed #000; position: relative; font-family: var(--font-alibaba), 'Alibaba PuHuiTi', Arial, 'PingFang SC', 'Microsoft YaHei'; box-sizing: border-box;\"><div style=\"position: absolute; top: 2mm; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: 700;\">{{spec}}</div><div style=\"position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 2mm;\"><img alt=\"QR\" style=\"width: 16mm; height: 16mm;\" src=\"{{qrDataUrl}}\" /><div style=\"writing-mode: vertical-rl; text-orientation: upright; font-size: 2.4mm; line-height: 1.1; letter-spacing: 0.3mm; font-weight: 700;\">内部管理码</div></div><div style=\"position: absolute; bottom: 2mm; left: 50%; transform: translateX(-50%); width: 20mm; text-align: center; font-size: 3.2mm; font-weight: 800; font-family: 'AlibabaPuHuiTi','Alibaba PuHuiTi', Arial, 'PingFang SC', 'Microsoft YaHei'; letter-spacing: 0.2mm;\">{{barcodeTail}}</div></div>`;
    const certContent = `<div style=\"width: 40mm; height: 30mm; border: 1px dashed #000; position: relative; padding: 2mm; font-family: var(--font-alibaba), 'Alibaba PuHuiTi', Arial, 'PingFang SC', 'Microsoft YaHei'; box-sizing: border-box;\"><div style=\"position: absolute; left: 2mm; top: 2mm; right: 20mm; bottom: 2mm;\"><div style=\"text-align: center; font-size: 3mm; font-weight: 700;\">{{headerInfo}}</div><div style=\"text-align: center; font-size: 2.6mm; margin-top: 0.6mm;\">{{productSpec}}</div><div style=\"font-size: 2.4mm; margin-top: 0.6mm;\">{{executeStandard}}</div><div style=\"font-size: 2.6mm; margin-top: 0.6mm; font-weight: 700;\">{{productName}}</div><div style=\"font-size: 2.4mm; margin-top: 0.6mm; line-height: 3.2mm; height: 6.4mm; overflow: hidden;\">{{factoryName}}</div><div style=\"font-size: 2.4mm; margin-top: 0.6mm; line-height: 3.2mm; height: 6.4mm; overflow: hidden;\">{{addressInfo}}</div><div style=\"font-size: 2.4mm; margin-top: 0.6mm;\">{{material}}</div><div style=\"font-size: 2.4mm; margin-top: 0.6mm;\">{{otherInfo}}</div></div><div style=\"position: absolute; right: 2mm; bottom: 2mm; width: 16mm; text-align: center;\"><div style=\"font-size: 2.6mm; margin-bottom: 0.6mm;\">{{prevMonth}}</div><img alt=\"QR\" style=\"width: 16mm; height: 16mm;\" src=\"{{qrDataUrl}}\" /><div style=\"font-size: 3.2mm; font-weight: 800; margin-top: 0.6mm; font-family: 'AlibabaPuHuiTi','Alibaba PuHuiTi', Arial, 'PingFang SC', 'Microsoft YaHei';\">{{barcodeTail}}</div></div></div>`;
    await this.prisma.$executeRawUnsafe(`INSERT INTO \`${db}\`.\`label_templates\` (name, content, content_tspl, is_default) VALUES (?, ?, ?, 1)`, '默认标签模板', defaultContent, null);
    await this.prisma.$executeRawUnsafe(`INSERT INTO \`${db}\`.\`label_templates\` (name, content, content_tspl, is_default) VALUES (?, ?, ?, 0)`, '合格证标签', certContent, null);
  }
  private initDefaultTemplate() {}

  // 创建默认模板（如果不存在）
  async ensureDefaultTemplate() {
    await this.ensureTable();
    const db = await this.getDbName();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`${db}\`.\`label_templates\` WHERE is_default=1 ORDER BY id DESC LIMIT 1`
    );
    if (rows && rows.length > 0) return this.mapRow(rows[0]);
    await this.seedDefaultsIfEmpty();
    const rows2: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`${db}\`.\`label_templates\` ORDER BY id ASC LIMIT 1`
    );
    if (rows2 && rows2.length > 0) return this.mapRow(rows2[0]);
    throw new NotFoundException('未找到默认模板');
  }

  // 获取所有模板
  async findAll() {
    await this.ensureTable();
    const db = await this.getDbName();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`${db}\`.\`label_templates\` ORDER BY is_default DESC, updated_at DESC, id DESC`
    );
    return (rows || []).map(r => this.mapRow(r));
  }

  // 根据ID获取模板
  async findOne(id: number) {
    await this.ensureTable();
    const db = await this.getDbName();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`${db}\`.\`label_templates\` WHERE id=? LIMIT 1`, id
    );
    if (!rows || rows.length === 0) throw new NotFoundException(`模板 ID ${id} 不存在`);
    return this.mapRow(rows[0]);
  }

  // 根据商品编码获取模板（优先使用专用模板，否则使用默认模板）
  async findByProductCode(productCode: string) {
    await this.ensureTable();
    const db = await this.getDbName();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`${db}\`.\`label_templates\` WHERE product_code=? ORDER BY updated_at DESC, id DESC LIMIT 1`,
      productCode,
    );
    if (rows && rows.length > 0) return this.mapRow(rows[0]);
    return this.ensureDefaultTemplate();
  }

  // 创建模板
  async create(createTemplateDto: CreateTemplateDto) {
    await this.ensureTable();
    const db = await this.getDbName();
    if (createTemplateDto.isDefault) {
      await this.prisma.$executeRawUnsafe(`UPDATE \`${db}\`.\`label_templates\` SET is_default=0`);
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO \`${db}\`.\`label_templates\` (name, content, content_tspl, is_default, product_code) VALUES (?, ?, ?, ?, ?)`,
      createTemplateDto.name,
      createTemplateDto.content,
      (createTemplateDto as any).contentTspl || '',
      createTemplateDto.isDefault ? 1 : 0,
      createTemplateDto.productCode || null,
    );
    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM \`${db}\`.\`label_templates\` WHERE id=LAST_INSERT_ID()`);
    return this.mapRow(rows[0]);
  }

  // 更新模板
  async update(id: number, updateTemplateDto: UpdateTemplateDto) {
    await this.ensureTable();
    await this.findOne(id);
    const db = await this.getDbName();
    if (updateTemplateDto.isDefault) {
      await this.prisma.$executeRawUnsafe(`UPDATE \`${db}\`.\`label_templates\` SET is_default=0 WHERE id<>?`, id);
    }
    const sets: string[] = [];
    const vals: any[] = [];
    if (updateTemplateDto.name !== undefined) { sets.push('name=?'); vals.push(updateTemplateDto.name); }
    if (updateTemplateDto.content !== undefined) { sets.push('content=?'); vals.push(updateTemplateDto.content); }
    if ((updateTemplateDto as any).contentTspl !== undefined) { sets.push('content_tspl=?'); vals.push((updateTemplateDto as any).contentTspl); }
    if (updateTemplateDto.isDefault !== undefined) { sets.push('is_default=?'); vals.push(updateTemplateDto.isDefault ? 1 : 0); }
    if ((updateTemplateDto as any).productCode !== undefined) { sets.push('product_code=?'); vals.push((updateTemplateDto as any).productCode || null); }
    if (sets.length) {
      vals.push(id);
      await this.prisma.$executeRawUnsafe(
        `UPDATE \`${db}\`.\`label_templates\` SET ${sets.join(', ')} WHERE id=?`,
        ...vals,
      );
    }
    return this.findOne(id);
  }

  // 删除模板
  async remove(id: number) {
    await this.ensureTable();
    const db = await this.getDbName();
    const template = await this.findOne(id);
    if (template.isDefault) {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT COUNT(1) AS c FROM \`${db}\`.\`label_templates\` WHERE is_default=1 AND id<>?`, id);
      const others = Number(rows?.[0]?.c || 0);
      if (others === 0) throw new NotFoundException('不能删除唯一的默认模板');
    }
    await this.prisma.$executeRawUnsafe(`DELETE FROM \`${db}\`.\`label_templates\` WHERE id=?`, id);
    return template;
  }

  // 渲染模板（将变量替换为实际值）
  renderTemplate(template: string, data: any): string {
    let rendered = template;
    const safeData = { ...(data || {}) };
    // 兜底：若未传 prevMonth，则计算为本月上一月，格式 YYYY.MM（两位月份）
    if (!safeData.prevMonth) {
      const now = new Date();
      const m = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      safeData.prevMonth = `${m.getFullYear()}.${String(m.getMonth() + 1).padStart(2, '0')}`;
    }
    
    // 替换模板变量
    Object.keys(safeData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, safeData[key] || '');
    });

    return rendered;
  }

  /**
   * 使用 Playwright 将 HTML 渲染为位图数据
   * @param html 完整的 HTML 字符串
   * @param width 宽度（像素）
   * @param height 高度（像素）
   * @returns 二进制位图数据的 Buffer
   */
  async renderHtmlToBitmap(html: string, width: number, height: number): Promise<Buffer> {
    const playwright = await import('playwright');
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });

    // 设置 HTML 内容
    await page.setContent(html, { waitUntil: 'networkidle' });

    // 截图为 PNG
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    await browser.close();

    // 将 PNG 转换为单色位图
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(screenshot);
    image.greyscale().contrast(0.5);

    const bitmapData: number[] = [];
    const bytesPerRow = Math.ceil(width / 8);

    for (let y = 0; y < height; y++) {
      for (let byteX = 0; byteX < bytesPerRow; byteX++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = byteX * 8 + bit;
          if (x < width) {
            const pixelColor = image.getPixelColor(x, y);
            const r = (pixelColor >> 24) & 0xff;
            const g = (pixelColor >> 16) & 0xff;
            const b = (pixelColor >> 8) & 0xff;
            const brightness = (r + g + b) / 3;
            if (brightness < 128) {
              byte |= (1 << (7 - bit));
            }
          }
        }
        bitmapData.push(byte);
      }
    }

    return Buffer.from(bitmapData);
  }
}
