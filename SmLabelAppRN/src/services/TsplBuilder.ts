/*
  TSPL 指令构建器（常见条码标签打印机协议）。
  - 统一生成两类模板：默认标签、合格证标签
  - 可按需扩展
*/

export interface TsplLabelData {
  productName: string;
  spec?: string;
  skuCode?: string;
  productCode?: string; // 条码
  price?: number;
  unit?: string;
  // 额外字段
  headerInfo?: string;
  factoryName?: string;
  executeStandard?: string;
  addressInfo?: string;
  material?: string;
  otherInfo?: string;
  prevMonth?: string; // YYYY.MM
}

export default class TsplBuilder {
  static header(width = 40, height = 30): string {
    // 以 mm 为单位的常见设置：60x40 标签，GAP 2mm
    return [
      'SIZE ' + width + ' mm,' + height + ' mm',
      'GAP 2 mm,0',
      // 默认使用 936/GBK 系列，兼容性更好
      'CODEPAGE 936',
      'SET CHINESE GB18030',
      // 若设备内置 TrueType 字体路径为 G:/ 或 F:/，下面一行会被忽略也不影响
      'SET FONTPATH "G:/"',
      'REFERENCE 0,0',
      'DIRECTION 1',
      'DENSITY 12',
      'CLS',
    ].join('\n');
  }

  static footer(quantity = 1): string {
    return ['PRINT ' + quantity, ''] .join('\n');
  }

  static text(x: number, y: number, text: string, font = 'TSS24.BF2', xmul = 1, ymul = 1): string {
    const safe = (text || '').replace(/\n/g, ' ');
    // 检测是否包含非 ASCII 字符，若包含则优先尝试常见中文 TTF 名称
    const hasNonAscii = /[^\x00-\x7F]/.test(safe);
    const chosenFont = hasNonAscii ? 'SIMSUN.TTF' : font;
    return `TEXT ${x},${y},"${chosenFont}",0,${xmul},${ymul},"${safe}"`;
  }

  static barcode128(x: number, y: number, code: string, height = 50): string {
    const safe = (code || '').replace(/\s/g, '');
    return [
      `BARCODE 128 ${x},${y},${height},1,0,2,2,"${safe}"`,
    ].join('\n');
  }

  static qrcode(x: number, y: number, data: string, cell = 6): string {
    const safe = (data || '').replace(/"/g, '');
    // 常见兼容写法：纠错 M2，放大单元 cell
    return `QRCODE ${x},${y},L,${cell},A,0,M2,S7,"${safe}"`;
  }

  private static computeBarcodeTail8(productCode?: string): string {
    const raw = String(productCode || '');
    if (raw.includes(',')) {
      // 包含逗号：取第一个逗号前面的8个字符
      return raw.split(',')[0].slice(0, 8);
    } else {
      // 不包含逗号：取最后8个数字字符
      const digits = raw.replace(/\D/g, '');
      return digits.slice(-8);
    }
  }

  // 默认商品标签
  static buildDefault(data: TsplLabelData, copies = 1): string {
    const lines: string[] = [];
    lines.push(this.header());
    lines.push(this.text(20, 30, data.productName || ''));
    if (data.spec) lines.push(this.text(20, 70, `规格: ${data.spec}`));
    if (data.skuCode) lines.push(this.text(20, 105, `SKU: ${data.skuCode}`));
    if (data.productCode) {
      lines.push(this.barcode128(20, 140, data.productCode));
    }
    if (data.price) lines.push(this.text(20, 210, `￥${data.price}/${data.unit || ''}`));
    lines.push(this.footer(copies));
    return lines.join('\n');
  }

  // 合格证标签（示例字段）
  static buildCertificate(data: TsplLabelData, copies = 1): string {
    const lines: string[] = [];
    lines.push(this.header(40, 30));
    lines.push(this.text(20, 20, data.headerInfo || '合格证', 'TSS24.BF2', 1, 1));
    lines.push(this.text(20, 55, `产品名称: ${data.productName || ''}`));
    if (data.spec) lines.push(this.text(20, 90, `产品规格: ${data.spec}`));
    if (data.executeStandard) lines.push(this.text(20, 125, `执行标准: ${data.executeStandard}`));
    if (data.factoryName) lines.push(this.text(20, 160, `厂家名称: ${data.factoryName}`));
    if (data.addressInfo) lines.push(this.text(20, 195, `地址: ${data.addressInfo}`));
    if (data.material) lines.push(this.text(20, 230, `材质: ${data.material}`));
    if (data.otherInfo) lines.push(this.text(20, 265, `${data.otherInfo}`));
    if (data.prevMonth) lines.push(this.text(20, 300, `生产日期: ${data.prevMonth}`));
    lines.push(this.footer(copies));
    return lines.join('\n');
  }

  // 仿 Web 后台“默认标签模板”：上方居中规格、中间二维码、底部条码尾号
  static buildBackendDefault(data: TsplLabelData, copies = 1): string {
    const lines: string[] = [];
    lines.push(this.header(40, 30));
    // 顶部规格：1.5mm 顶边，居中显示（近似居中）
    const specText = data.spec || '';
    lines.push(this.text(80, 25, specText, 'SIMSUN.TTF', 1, 1));
    // 中间二维码：内容=SKU
    const qrContent = String(data.skuCode || '');
    lines.push(this.qrcode(100, 60, qrContent, 6));
    // 底部数字：条码尾号8位；若包含逗号，取第一个逗号之前的8个字符；否则取最后8个数字
    const tail8 = this.computeBarcodeTail8(data.productCode);
    lines.push(this.text(60, 210, tail8, 'TSS24.BF2', 1, 1));
    lines.push(this.footer(copies));
    return lines.join('\n');
  }

  // ASCII 简化模板（仅英文与数字，避免乱码用于联调）
  static buildAsciiSimple(data: TsplLabelData, copies = 1): string {
    const lines: string[] = [];
    lines.push(this.header(40, 30));
    lines.push(this.text(20, 30, 'LABEL TEST', 'TSS24.BF2', 1, 1));
    if (data.skuCode) lines.push(this.text(20, 70, `SKU: ${String(data.skuCode).replace(/[^\x00-\x7F]/g, '')}`, 'TSS24.BF2', 1, 1));
    if (data.productCode) {
      lines.push(this.text(20, 110, 'BARCODE:', 'TSS24.BF2', 1, 1));
      lines.push(this.barcode128(20, 140, String(data.productCode).replace(/\D/g, '')));
    }
    if (data.unit || data.price) {
      lines.push(this.text(20, 210, `UNIT: ${data.unit || ''}  PRICE: ${data.price ?? ''}`, 'TSS24.BF2', 1, 1));
    }
    lines.push(this.footer(copies));
    return lines.join('\n');
  }
}



