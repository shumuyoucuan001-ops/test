// CPCL (Common Printing Command Language) 转换器
// 用于便携打印机的指令生成

export interface CpclLabelData {
  spec?: string;
  qrDataUrl?: string;
  barcodeTail?: string;
  skuCode?: string;
  productName?: string;
}

export class CpclConverter {
  
  /**
   * 将位图数据转换为CPCL位图指令
   * @param bitmapData 1bpp位图数据（十六进制字符串）
   * @param widthDots 宽度（点）
   * @param heightDots 高度（点）
   * @param copies 打印份数
   * @returns CPCL位图指令字符串
   */
  static convertBitmapToCpcl(bitmapData: string, widthDots: number = 320, heightDots: number = 240, copies: number = 1): string {
    const cpcl: string[] = [];
    
    // 处理位图数据格式
    // TSPL格式: 0xFF,0xFF,0xFF... -> CPCL格式: FFFFFF...
    let cpclBitmapData = bitmapData;
    if (bitmapData.includes(',')) {
      // 移除逗号和0x前缀，转换为连续的十六进制字符串
      cpclBitmapData = bitmapData
        .split(',')
        .map(hex => hex.replace('0x', '').replace('0X', ''))
        .join('');
    }
    
    // CPCL需要反转黑白逻辑 (1=黑, 0=白 vs 0=黑, 1=白)
    console.log('[CPCL] Inverting bitmap colors for CPCL compatibility');
    cpclBitmapData = cpclBitmapData.replace(/./g, (char) => {
      const nibble = parseInt(char, 16);
      return (15 - nibble).toString(16).toUpperCase();
    });
    
    // CPCL头部设置和内容
    // ! offset dpi_horizontal dpi_vertical height quantity
    cpcl.push(`! 0 203 203 240 ${copies}`); // 偏移量, DPI水平, DPI垂直, 高度, 数量
    cpcl.push('PAGE-WIDTH 320'); // 页面宽度
    
    // 标签设置 - 确保正确的标签尺寸和间距
    cpcl.push('LABEL'); // 使用标签模式
    cpcl.push('GAP-SENSE'); // 启用间隙检测
    cpcl.push('SPEED 2'); // 设置打印速度
    cpcl.push('TONE 0'); // 设置打印浓度
    cpcl.push('JOURNAL'); // 启用日志模式，确保正确的标签定位
    
    // 位图指令
    // EG 命令：EG widthBytes heightDots x y data
    const widthBytes = Math.ceil(widthDots / 8);
    const xOffset = 0; // 默认位置，无偏移
    console.log(`[CPCL] Converting bitmap: ${widthBytes} bytes x ${heightDots} dots, X offset: ${xOffset}, data length: ${cpclBitmapData.length}`);
    cpcl.push(`EG ${widthBytes} ${heightDots} ${xOffset} 0 ${cpclBitmapData}`);
    
    // CPCL结束指令
    cpcl.push('FORM'); // 结束表单定义
    cpcl.push('PRINT'); // 打印指令
    
    return cpcl.join('\r\n') + '\r\n';
  }

  
  /**
   * 将HTML模板数据转换为CPCL指令（简单文本版本，已废弃）
   * @param data 标签数据
   * @param widthMm 标签宽度(mm)
   * @param heightMm 标签高度(mm)
   * @returns CPCL指令字符串
   */
  static convertToCpcl(data: CpclLabelData, widthMm: number = 40, heightMm: number = 30): string {
    // CPCL使用点为单位，203 DPI: 1mm ≈ 8 dots
    const dotsPerMm = 8;
    const widthDots = Math.round(widthMm * dotsPerMm); // 320 dots
    const heightDots = Math.round(heightMm * dotsPerMm); // 240 dots
    
    const cpcl: string[] = [];
    
    // CPCL头部设置
    cpcl.push('! 0 200 200 240 1'); // 偏移量, DPI水平, DPI垂直, 高度, 数量
    cpcl.push('PAGE-WIDTH 320'); // 页面宽度
    cpcl.push('ENCODING UTF-8'); // 字符编码
    
    // 规格文字 (顶部居中)
    if (data.spec) {
      cpcl.push(`TEXT 4 0 160 12 ${data.spec}`); // 字体4, 旋转0, X居中, Y位置, 文本
    }
    
    // 二维码 (中间位置)
    if (data.qrDataUrl && !data.qrDataUrl.startsWith('data:image/')) {
      // 使用SKU代码生成二维码
      const qrData = data.qrDataUrl || data.skuCode || 'NO_DATA';
      cpcl.push(`BARCODE QR 100 52 M 2 U 6`); // QR码, X位置, Y位置, 纠错级别, 放大倍数, 旋转, 模块大小
      cpcl.push(`MA,${qrData}`); // 二维码数据
      cpcl.push('ENDQR'); // 结束二维码
    }
    
    // 条码尾号 (底部居中)
    if (data.barcodeTail) {
      cpcl.push(`TEXT 4 0 160 180 ${data.barcodeTail}`); // 底部文字
    }
    
    // CPCL结束指令
    cpcl.push('PRINT'); // 打印指令
    
    return cpcl.join('\r\n') + '\r\n';
  }
  
  /**
   * 从HTML模板渲染CPCL指令（简化版本）
   * 解析HTML中的变量并转换为CPCL
   */
  static htmlToCpcl(html: string, data: CpclLabelData): string {
    // 替换HTML模板变量
    let processedHtml = html;
    if (data.spec) {
      processedHtml = processedHtml.replace(/\{\{spec\}\}/g, data.spec);
    }
    if (data.qrDataUrl) {
      processedHtml = processedHtml.replace(/\{\{qrDataUrl\}\}/g, data.qrDataUrl);
    }
    if (data.barcodeTail) {
      processedHtml = processedHtml.replace(/\{\{barcodeTail\}\}/g, data.barcodeTail);
    }
    
    // 提取文本内容（简化处理）
    const extractedData: CpclLabelData = {
      spec: data.spec,
      qrDataUrl: data.qrDataUrl,
      barcodeTail: data.barcodeTail,
      skuCode: data.skuCode,
      productName: data.productName
    };
    
    return this.convertToCpcl(extractedData);
  }
  
  /**
   * 生成测试CPCL指令
   */
  static generateTestCpcl(): string {
    const testData: CpclLabelData = {
      spec: '测试规格',
      qrDataUrl: 'TEST123',
      barcodeTail: '12345678'
    };
    
    return this.convertToCpcl(testData);
  }
}

export default CpclConverter;
