// 蓝牙打印服务模拟
// 实际使用时需要根据打印机型号替换为真实的蓝牙打印库

export interface PrintData {
  productName: string;
  spec?: string;
  skuCode?: string;
  productCode?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  receiptNumber?: string;
}

import BluetoothPrinter from './BluetoothPrinter';
import TsplBuilder, { TsplLabelData } from './TsplBuilder';
// 为避免中文乱码：将最终 TSPL 文本转为 GBK 字节再写入
// eslint-disable-next-line @typescript-eslint/no-var-requires
const iconv = require('iconv-lite');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Buffer } = require('buffer');

export class PrintService {
  private static instance: PrintService;
  private isConnected = false;
  private printerName = '';

  static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  // 模拟蓝牙连接
  async connectPrinter(): Promise<boolean> {
    try {
      // 这里应该是真实的蓝牙连接逻辑
      // 例如: await BluetoothClassic.connect(deviceAddress)
      
      // 模拟连接延时
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isConnected = true;
      this.printerName = '标签打印机 (模拟)';
      console.log('蓝牙打印机连接成功');
      return true;
    } catch (error) {
      console.error('蓝牙打印机连接失败:', error);
      return false;
    }
  }

  // 断开连接
  async disconnectPrinter(): Promise<void> {
    this.isConnected = false;
    this.printerName = '';
    console.log('蓝牙打印机已断开');
  }

  // 检查连接状态
  isConnectedToPrinter(): boolean {
    return this.isConnected;
  }

  // 获取打印机名称
  getPrinterName(): string {
    return this.printerName;
  }

  // 打印标签
  async printLabel(data: PrintData, copies: number = 1): Promise<boolean> {
    try {
      // 优先走真实蓝牙：
      if (BluetoothPrinter.isSupported()) {
        if (!BluetoothPrinter.getConnectedDevice()) {
          // 如果未连接，尝试自动连接第一个已配对设备
          const devices = await BluetoothPrinter.getPairedDevices();
          const target = devices?.[0];
          if (target?.address) await BluetoothPrinter.connect(target.address);
        }
        const tspl = TsplBuilder.buildDefault(this.mapTsplData(data), copies);
        return await BluetoothPrinter.writeRaw(tspl);
      }

      // 回退：模拟打印
      const printContent = this.generatePrintContent(data);
      console.log('[模拟打印]\n', printContent);
      return true;
    } catch (error) {
      console.error('打印失败:', error);
      return false;
    }
  }

  // 直接打印 TSPL 原文（与 Web 模板保持一致）
  async printTsplRaw(tsplRaw: string): Promise<boolean> {
    try {
      if (!BluetoothPrinter.isSupported()) {
        console.error('当前环境不支持蓝牙打印');
        return false;
      }
      // 简单判断是否为 TSPL 指令（避免误把 HTML 发送到打印机）
      let raw = (tsplRaw || '').trim();
      // 去除以 # 开头的注释行，避免被打印机当作未知指令
      raw = raw
        .split(/\r?\n/)
        .filter((l) => !/^\s*#/.test(l))
        .join('\n');
      // 检查是否为TSPL或CPCL指令
      const looksLikeTspl = /\bSIZE\b|\bCLS\b|\bPRINT\b|\bBARCODE\b/i.test(raw);
      const looksLikeCpcl = /^!\s*\d+|\bPAGE-WIDTH\b|\bEG\s+\d+|\bFORM\b|\bLABEL\b/i.test(raw);
      if (!looksLikeTspl && !looksLikeCpcl) {
        console.warn('[PrintService] 渲染结果不是 TSPL 或 CPCL，跳过直打');
        return false;
      }
      // TSPL规范化（仅对TSPL指令进行处理，CPCL指令保持原样）
      if (looksLikeTspl) {
        // 1) 如果已有 SIZE 行，则将其替换为 40x30；否则补上
        if (/^\s*SIZE\b/i.test(raw) || /\n\s*SIZE\b/i.test(raw)) {
          raw = raw.replace(/SIZE\s+[^\r\n]+/i, 'SIZE 40 mm,30 mm');
        } else {
          raw = ['SIZE 40 mm,30 mm', raw].join('\n');
        }
        // 2) GAP/REFERENCE/DIRECTION/DENSITY 如无则补
        if (!/\bGAP\b/i.test(raw)) raw = raw.replace(/SIZE[^\n]*\n/i, (m) => m + 'GAP 2 mm,0\n');
        // 优先使用 GB18030（兼容性更好），若调用方已指定则保留
        if (!/\bCODEPAGE\b/i.test(raw)) raw = raw.replace(/SIZE[^\n]*\n/i, (m) => m + 'CODEPAGE 936\n');
        if (!/\bSET\s+CHINESE\b/i.test(raw)) raw = raw.replace(/SIZE[^\n]*\n/i, (m) => m + 'SET CHINESE GB18030\n');
        if (!/\bREFERENCE\b/i.test(raw)) raw = raw.replace(/SIZE[^\n]*\n/i, (m) => m + 'REFERENCE 0,0\n');
        if (!/\bDIRECTION\b/i.test(raw)) raw = raw.replace(/SIZE[^\n]*\n/i, (m) => m + 'DIRECTION 1\n');
        if (!/\bDENSITY\b/i.test(raw)) raw = raw.replace(/SIZE[^\n]*\n/i, (m) => m + 'DENSITY 12\n');
        // 3) CLS：若已有则不重复；若无则放在头部设置后
        if (!/\bCLS\b/i.test(raw)) raw = raw.replace(/DENSITY[^\n]*\n/i, (m) => m + 'CLS\n');
        // 4) 字体选择：优先中文 TTF（Simsun/Simhei），否则退回 TSS24.BF2
        if (!/\bSET\s+FONT\b/i.test(raw)) {
          raw = raw.replace(/CLS\n/i, (m) => m + 'SET FONT "SIMSUN.TTF"\n');
        }
        // 5) mm 单位转点阵（203dpi≈8点/mm），兼容部分机型不识别"mm"
        raw = raw.replace(/(\b(?:TEXT|BARCODE|QRCODE|LINE|BOX)\s+)([^\r\n]+)/gi, (all, head, rest) => {
          const mmToDot = (val: string): string => {
            const m = val.match(/^([0-9]+(?:\.[0-9]+)?)mm$/i);
            if (!m) return val;
            const dots = Math.round(parseFloat(m[1]) * 8);
            return String(dots);
          };
          const parts = rest.split(',').map((s: string) => s.trim());
          for (let i = 0; i < Math.min(2, parts.length); i++) {
            parts[i] = mmToDot(parts[i]);
          }
          return head + parts.join(',');
        });

        // 6) PRINT：避免重复，只保留最后一个；若完全没有则追加 PRINT 1
        const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const filtered = lines.filter((l) => !/^\s*PRINT\b/i.test(l));
        raw = filtered.join('\n');
        raw = [raw, 'PRINT 1'].join('\n');
        // 空模板保护：如无任何绘制指令，插入占位文本避免空白纸
        if (!/\b(TEXT|QRCODE|BARCODE|LINE|BOX)\b/i.test(raw)) {
          raw = raw.replace(/CLS\n/i, (m) => m + 'TEXT 20,20,"TSS24.BF2",0,1,1,"EMPTY"\n');
        }
      }
      // 构建最终发送的数据
      const buildPayload = (): Uint8Array => {
        if (looksLikeCpcl) {
          // CPCL：直接使用ASCII编码，EG命令中的位图数据已经是十六进制字符串
          try {
            return iconv.encode(raw, 'ascii');
          } catch {
            return Buffer.from(raw, 'utf8');
          }
        } else {
          // TSPL：处理特殊的Base64编码格式或传统十六进制格式
          // 检查是否包含 __BINARY_DATA_BASE64__ 标记
          if (raw.includes('__BINARY_DATA_BASE64__')) {
            console.log('[PrintService] Detected Base64 encoded bitmap data');
            // 解析格式: TSPL头部 + __BINARY_DATA_BASE64__ + Base64数据 + __END_BINARY__ + TSPL尾部
            const base64Match = raw.match(/__BINARY_DATA_BASE64__(.+?)__END_BINARY__/s);
            if (base64Match) {
              const base64Data = base64Match[1];
              const beforeBase64 = raw.substring(0, raw.indexOf('__BINARY_DATA_BASE64__'));
              const afterBinary = raw.substring(raw.indexOf('__END_BINARY__') + '__END_BINARY__'.length);
              
              console.log(`[PrintService] Decoding ${base64Data.length} chars of Base64 data`);
              
              // 解码Base64为二进制
              const binaryData = Buffer.from(base64Data, 'base64');
              console.log(`[PrintService] Decoded to ${binaryData.length} bytes of binary data`);
              
              // 构建最终数据：头部(ASCII) + 二进制数据 + 尾部(ASCII)
              const chunks: Uint8Array[] = [];
              try {
                chunks.push(iconv.encode(beforeBase64, 'gbk'));
              } catch {
                chunks.push(Buffer.from(beforeBase64, 'utf8'));
              }
              chunks.push(binaryData);
              try {
                chunks.push(iconv.encode(afterBinary, 'gbk'));
              } catch {
                chunks.push(Buffer.from(afterBinary, 'utf8'));
              }
              
              // 合并所有chunks
              const totalLen = chunks.reduce((s, c) => s + c.length, 0);
              const merged = new Uint8Array(totalLen);
              let offset = 0;
              for (const chunk of chunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
              }
              console.log(`[PrintService] Final payload size: ${merged.length} bytes`);
              return merged;
            }
          }
          
          // 传统处理：BITMAP行需要特殊处理，将十六进制数据转为二进制
          const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
          const chunks: Uint8Array[] = [];
          const pushAscii = (text: string) => {
            try { chunks.push(iconv.encode(text, 'gbk')); } catch { chunks.push(Buffer.from(text, 'utf8')); }
          };
          for (const line of lines) {
            const m = line.match(/^\s*BITMAP\s+(\d+),(\d+),(\d+),(\d+),(\d+),(.*)$/i);
            if (!m) {
              pushAscii(line + '\r\n');
              continue;
            }
            const [ , x, y, wBytes, hDots, mode, dataStrRaw ] = m;
            // 写入头部（不包含位图数据）
            const head = `BITMAP ${x},${y},${wBytes},${hDots},${mode},`;
            pushAscii(head);
            // 解析位图数据：兼容 0xNN,0xNN,... 或连续十六进制字符串
            const dataStr = dataStrRaw.trim();
            let bytes: number[] = [];
            if (/^0x[0-9a-fA-F]{2}(\s*,\s*0x[0-9a-fA-F]{2})*\s*$/i.test(dataStr)) {
              bytes = dataStr.split(',').map(s => parseInt(s.trim().replace(/0x/i, ''), 16));
            } else {
              const hex = dataStr.replace(/[^0-9a-fA-F]/g, '');
              for (let i = 0; i + 1 < hex.length; i += 2) {
                bytes.push(parseInt(hex.substr(i, 2), 16));
              }
            }
            chunks.push(Uint8Array.from(bytes));
            // 行结束
            pushAscii('\r\n');
          }
          // 合并
          const totalLen = chunks.reduce((s, c) => s + c.length, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) { merged.set(c, offset); offset += c.length; }
          return merged;
        }
      };
      const payloadBytes = buildPayload();
      const instructionType = looksLikeCpcl ? 'CPCL' : 'TSPL';
      console.log(`[PrintService] Instruction detection: TSPL=${looksLikeTspl}, CPCL=${looksLikeCpcl}`);
      console.log(`[PrintService][${instructionType} preview]\n` + raw.split(/\r?\n/).slice(0, 10).join('\n'));
      console.log(`[PrintService] Raw input length: ${raw.length} chars`);
      if (!BluetoothPrinter.getConnectedDevice()) {
        const devices = await BluetoothPrinter.getPairedDevices();
        const target = devices?.[0];
        if (target?.address) await BluetoothPrinter.connect(target.address);
      }
      // 直接写入最终二进制（BITMAP 已是二进制），其余部分使用 GBK 编码
      return await BluetoothPrinter.writeRaw(payloadBytes as any);
    } catch (e) {
      console.error('TSPL 直打失败:', e);
      return false;
    }
  }

  // 批量打印标签
  async printBatchLabels(dataList: PrintData[]): Promise<boolean> {
    try {
      if (!this.isConnected) {
        const connected = await this.connectPrinter();
        if (!connected) {
          throw new Error('打印机未连接');
        }
      }

      console.log(`开始批量打印 ${dataList.length} 个标签:`);
      
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        const printContent = this.generatePrintContent(data);
        
        console.log(`打印第 ${i + 1} 个标签:`, data.productName);
        console.log('打印内容:', printContent);
        
        // 模拟打印延时
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      console.log(`批量打印完成，共 ${dataList.length} 个标签`);
      return true;
    } catch (error) {
      console.error('批量打印失败:', error);
      return false;
    }
  }

  // 生成打印内容 (ESC/POS 或 TSPL 格式)
  private generatePrintContent(data: PrintData): string {
    // 这里应该根据实际打印机协议生成指令
    // 例如 ESC/POS 或 TSPL 格式
    
    const content = `
========== 商品标签 ==========
商品名称: ${data.productName || ''}
规格: ${data.spec || ''}
SKU: ${data.skuCode || ''}
条码: ${data.productCode || ''}
${data.quantity ? `数量: ${data.quantity} ${data.unit || ''}` : ''}
${data.price ? `价格: ¥${data.price}` : ''}
${data.receiptNumber ? `收货单: ${data.receiptNumber}` : ''}
============================
    `.trim();

    return content;
  }

  private mapTsplData(data: PrintData): TsplLabelData {
    return {
      productName: data.productName,
      spec: data.spec,
      skuCode: data.skuCode,
      productCode: data.productCode,
      price: data.price,
      unit: data.unit,
    };
  }

  // 测试打印
  async testPrint(): Promise<boolean> {
    const testData: PrintData = {
      productName: '测试商品',
      spec: '测试规格',
      skuCode: 'TEST123',
      productCode: '1234567890123',
      quantity: 1,
      unit: '件',
      price: 9.99,
    };

    return await this.printLabel(testData, 1);
  }
}

export default PrintService.getInstance();
