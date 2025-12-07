import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { CpclConverter } from './CpclConverter';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { LabelTemplate, TemplateService } from './template.service';

@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  create(@Body() createTemplateDto: CreateTemplateDto): Promise<LabelTemplate> {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  findAll(): Promise<LabelTemplate[]> {
    return this.templateService.findAll();
  }

  @Get('default')
  async ensureDefaultTemplate(): Promise<LabelTemplate> {
    return this.templateService.ensureDefaultTemplate();
  }

  @Get('by-product')
  findByProductCode(@Query('productCode') productCode: string): Promise<LabelTemplate> {
    return this.templateService.findByProductCode(productCode);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LabelTemplate> {
    return this.templateService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto): Promise<LabelTemplate> {
    return this.templateService.update(+id, updateTemplateDto);
  }

  // 禁止删除模板：保持接口占位返回 400
  @Delete(':id')
  remove(): Promise<LabelTemplate> {
    throw new Error('标签模板禁止删除');
  }

  // 测试二维码生成
  @Post('test-qr')
  async testQr(@Body() data: any) {
    console.log('[Template] Testing QR code generation');
    
    try {
      const QRCodeLib = require('qrcode');
      const testData = data.text || 'TEST123';
      
      console.log('[Template] Generating QR for:', testData);
      
      const qrDataUrl = await QRCodeLib.toDataURL(testData, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 1.0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      console.log('[Template] QR generated, length:', qrDataUrl.length);
      
      return { 
        success: true,
        qrDataUrl: qrDataUrl,
        length: qrDataUrl.length,
        preview: qrDataUrl.substring(0, 50) + '...'
      };
    } catch (error) {
      console.error('[Template] QR generation failed:', error);
      return { 
        success: false,
        error: error.message 
      };
    }
  }

  // 测试CPCL指令传输
  @Post('test-cpcl')
  async testCpcl(@Body() data: any) {
    console.log('[Template] Testing CPCL transmission');
    
    const testCpcl = `! 0 203 203 240 1\r
PAGE-WIDTH 320\r
LABEL\r
GAP-SENSE\r
SPEED 2\r
TONE 0\r
JOURNAL\r
TEXT 4 0 0 0 测试CPCL\r
TEXT 4 0 0 30 ${data.testText || 'Hello World'}\r
FORM\r
PRINT\r
`;
    
    return { rendered: testCpcl };
  }

  // 渲染模板为HTML (用于web端打印预览) - 必须在 :id/render 之前
  @Post(':id/render-html')
  async renderTemplateAsHtml(@Param('id') id: string, @Body() data: any) {
    console.log('[Template] Rendering template as HTML:', id, 'with data:', JSON.stringify(data, null, 2));
    
    try {
      const template = await this.templateService.findOne(+id);
      if (!template) {
        throw new Error('模板不存在');
      }

      // 对于HTML渲染，优先使用mm单位的HTML模板，这样在浏览器中显示更合适
      let html = template.content || template.contentTspl || '';
      console.log(`[Template] Using ${template.content ? 'HTML (mm)' : 'TSPL (px)'} template for HTML rendering`);
      
      // 先处理二维码生成，再替换其他模板变量
      if (data.qrDataUrl) {
        let qrImageUrl = data.qrDataUrl;
        
        try {
          console.log('[Template] Generating QR code for:', data.qrDataUrl);
          
          // 强制生成二维码，不检查是否已经是data URL
          const QRCodeLib = require('qrcode');
          
          qrImageUrl = await QRCodeLib.toDataURL(String(data.qrDataUrl), {
            width: 300,
            margin: 2,
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 1.0,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          console.log('[Template] QR code generated successfully!');
          console.log('[Template] QR code length:', qrImageUrl.length);
          console.log('[Template] QR code starts with:', qrImageUrl.substring(0, 30));
          
        } catch (error) {
          console.error('[Template] QR code generation failed:', error);
          console.error('[Template] Error stack:', error.stack);
          // 如果生成失败，保持原始值
          console.log('[Template] Keeping original value as fallback');
        }
        
        // 替换模板中的二维码占位符
        const beforeReplace = html.includes('{{qrDataUrl}}');
        html = html.replace(/\{\{qrDataUrl\}\}/g, qrImageUrl);
        const afterReplace = html.includes('{{qrDataUrl}}');
        
        console.log('[Template] QR replacement - before:', beforeReplace, 'after:', afterReplace);
        console.log('[Template] Final QR src preview:', qrImageUrl.substring(0, 50) + '...');
      }

      // 替换其他模板变量（除了qrDataUrl，已经处理过了）
      Object.keys(data).forEach(key => {
        if (key !== 'qrDataUrl') {
          const value = data[key];
          if (value !== undefined && value !== null) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            html = html.replace(regex, String(value));
          }
        }
      });

      console.log('[Template] HTML rendering completed');
      return { rendered: html };
    } catch (error) {
      console.error('[Template] HTML rendering failed:', error);
      throw new Error(`HTML模板渲染失败: ${error.message}`);
    }
  }

  // 渲染模板为打印指令 (TSPL/CPCL)
  @Post(':id/render')
  async renderTemplate(@Param('id') id: string, @Body() data: any) {
    console.log('[Template] Rendering template:', id, 'with data:', JSON.stringify(data, null, 2));
    
    try {
      const template = await this.templateService.findOne(+id);
      if (!template) {
        throw new Error('模板不存在');
      }

      // 检查打印机类型
      const printerType = data.printerType || 'desktop'; // 'desktop' | 'portable'
      console.log(`[Template] Printer type: ${printerType} (from data.printerType: ${data.printerType})`);

      // 固定使用contentTspl字段的模板代码，如果是HTML则转换为TSPL位图
      let html = template.contentTspl || '';
      console.log(`[Template] Using contentTspl template (length: ${html.length})`);
      
      // 检查contentTspl是否为HTML内容（包含<标签）
      const isHtmlContent = html.includes('<') && html.includes('>');
      console.log(`[Template] ContentTspl is HTML: ${isHtmlContent}`);
      
      // 替换模板变量 - 先处理特殊的qrDataUrl(需要生成二维码图片)
      if (data.qrDataUrl) {
        // 如果qrDataUrl不是data URL格式，则生成二维码
        let qrImageUrl = data.qrDataUrl;
        if (!qrImageUrl.startsWith('data:image/')) {
        try {
          // 生成高质量二维码，匹配web端的精度设置
          qrImageUrl = await QRCode.toDataURL(data.qrDataUrl || data.skuCode, {
            width: 300,  // 更高分辨率
            margin: 2,   // 适当边距
            errorCorrectionLevel: 'H',  // 最高纠错级别，匹配web端
            type: 'image/png',
            quality: 1.0,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          } catch (error) {
            console.error('[Template] QR code generation failed:', error);
            // 使用原始值作为fallback
          }
        }
        html = html.replace(/\{\{qrDataUrl\}\}/g, qrImageUrl);
      }
      
      // 替换所有其他模板变量(通用处理)
      Object.keys(data).forEach(key => {
        if (key !== 'qrDataUrl' && key !== 'testBitmap' && key !== 'simpleText' && key !== 'renderAsBitmap' && key !== 'printerType' && key !== 'copies') {
          const value = data[key];
          if (value !== undefined && value !== null) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            html = html.replace(regex, String(value));
            console.log(`[Template] Replaced {{${key}}} with: ${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}`);
          }
        }
      });

      console.log('[Template] Processed HTML:', html.substring(0, 200) + '...');

      // 检查是否请求测试位图模式（用于诊断）- 重新启用进行BITMAP格式调试
      if (data.testBitmap === true) {
        console.log('[Template] Generating BITMAP test TSPL for diagnosis');
        const copies = data.copies || 1;
        
        // 使用五种大尺寸明显图案循环打印 (32x32像素)，包括字母A
        // 根据传入的patternIndex参数决定使用哪种图案，如果没有则使用时间戳
        const patternIndex = data.patternIndex !== undefined ? data.patternIndex % 5 : Math.floor(Date.now() / 2000) % 5;
        
        let testTspl;
        if (patternIndex === 0) {
          // 第一种图案：回到最初有效的8x8格式 - 0x前缀逗号分隔
          console.log('[Template] Using pattern 1: Back to basic 8x8 with 0x prefix (known working)');
          testTspl = `SIZE 40 mm,30 mm
GAP 2 mm,0
DENSITY 8
SPEED 2
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET TEAR OFF
CODEPAGE 1252
CLS
BITMAP 50,50,1,8,0,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF
PRINT ${copies},1
`;
        } else if (patternIndex === 1) {
          // 第二种图案：回到最初有效的8x8格式 - 十进制逗号分隔
          console.log('[Template] Using pattern 2: Back to basic 8x8 with decimal (known working)');
          testTspl = `SIZE 40 mm,30 mm
GAP 2 mm,0
DENSITY 8
SPEED 2
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET TEAR OFF
CODEPAGE 1252
CLS
BITMAP 50,50,1,8,0,255,255,255,255,255,255,255,255
PRINT ${copies},1
`;
        } else if (patternIndex === 2) {
          // 第三种图案：简单的16x16全黑 - 0x前缀逗号分隔
          console.log('[Template] Using pattern 3: Simple 16x16 black square with 0x prefix');
          testTspl = `SIZE 40 mm,30 mm
GAP 2 mm,0
DENSITY 8
SPEED 2
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET TEAR OFF
CODEPAGE 1252
CLS
BITMAP 50,50,2,16,0,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF
PRINT ${copies},1
`;
        } else if (patternIndex === 3) {
          // 第四种图案：简单的16x16全黑 - 十进制逗号分隔
          console.log('[Template] Using pattern 4: Simple 16x16 black square with decimal');
          testTspl = `SIZE 40 mm,30 mm
GAP 2 mm,0
DENSITY 8
SPEED 2
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET TEAR OFF
CODEPAGE 1252
CLS
BITMAP 50,50,2,16,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255
PRINT ${copies},1
`;
        } else {
          // 第五种图案：最简单的4x4全黑 - 十进制逗号分隔
          console.log('[Template] Using pattern 5: Simplest 4x4 black square with decimal');
          testTspl = `SIZE 40 mm,30 mm
GAP 2 mm,0
DENSITY 8
SPEED 2
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET TEAR OFF
CODEPAGE 1252
CLS
BITMAP 50,50,1,4,0,255,255,255,255
PRINT ${copies},1
`;
        }
        
        console.log('[Template] Generated alternating BITMAP test TSPL');
        console.log('[Template] TSPL content:', testTspl);
        return { rendered: testTspl };
      }
      
      // 检查是否请求简单文本模式（用于蓝牙打印机）
      if (data.simpleText === true) {
        console.log('[Template] Generating simple text TSPL for Bluetooth printer');
        const copies = data.copies || 1;
        const simpleTspl = this.generateSimpleTextTspl(data, copies);
        return { rendered: simpleTspl };
      }
      
      // 强制使用HTML转位图的方式（无论contentTspl是HTML还是其他内容）
      if (data.renderAsBitmap === true || isHtmlContent) {
        console.log(`[Template] Rendering as bitmap for ${printerType} printer`);
        try {
          // 恢复使用HTML渲染成位图的方式
          console.log('[Template] Rendering HTML to bitmap and converting to TSPL');
          const copies = data.copies || 1;
          // 使用标准尺寸: 40mm x 30mm @ 200dpi
          const bitmapResult = await this.htmlToTsplBitmapViaHeadless(html, 40, 30, copies);
          console.log('[Template] Bitmap rendering successful');
          return { rendered: bitmapResult };
        } catch (bitmapError) {
          console.error('[Template] Bitmap rendering failed, falling back to manual rendering:', bitmapError);
          // 回退到手工位图渲染
          const copies = data.copies || 1; // 获取打印份数
          const fallbackTspl = await this.htmlToTsplBitmap(html, 40, 30, copies);
          return { rendered: fallbackTspl };
        }
      } else {
        // 传统渲染（已废弃，但保留兼容性）
        console.log(`[Template] Using legacy rendering for ${printerType} printer`);
        if (printerType === 'portable') {
          const cpcl = CpclConverter.htmlToCpcl(html, {
            spec: data.spec,
            qrDataUrl: data.qrDataUrl,
            barcodeTail: data.barcodeTail,
            skuCode: data.skuCode,
            productName: data.productName
          });
          return { rendered: cpcl };
        } else {
          const tspl = await this.htmlToTspl(html, data);
          return { rendered: tspl };
        }
      }
    } catch (error) {
      console.error('[Template] Rendering failed:', error);
      throw new Error(`模板渲染失败: ${error.message}`);
    }
  }

  private generateSimpleTspl(data: any): string {
    const copies = data.copies || 1;
    const tspl: string[] = [];
    
    // 基本设置
    tspl.push('SIZE 40 mm,30 mm');
    tspl.push('CLS');
    
    // 产品规格 - 居中显示
    if (data.spec) {
      const specText = this.convertToAscii(data.spec) || 'SPEC';
      tspl.push(`TEXT 80,30,"TSS24.BF2",0,1,1,"${specText}"`);
    }
    
    // 条码信息
    if (data.barcodeTail) {
      tspl.push(`TEXT 50,80,"TSS24.BF2",0,1,1,"CODE: ${data.barcodeTail}"`);
    }
    
    // 产品名称
    if (data.productName) {
      const productText = this.convertToAscii(data.productName) || 'PRODUCT';
      tspl.push(`TEXT 50,130,"TSS24.BF2",0,1,1,"${productText}"`);
    }
    
    // SKU信息
    if (data.skuCode) {
      tspl.push(`TEXT 50,180,"TSS24.BF2",0,1,1,"SKU: ${data.skuCode}"`);
    }
    
    // 添加二维码（如果支持）
    if (data.qrDataUrl) {
      tspl.push(`QRCODE 250,30,H,4,A,0,M2,S7,"${data.qrDataUrl}"`);
    }
    
    // 打印指令
    tspl.push(`PRINT ${copies},1`);
    
    return tspl.join('\r\n') + '\r\n';
  }

  // 生成简单文本TSPL（用于蓝牙打印机）
  private generateSimpleTextTspl(data: any, copies: number = 1): string {
    console.log('[Template] Generating simple text TSPL for Bluetooth printer');
    
    const tspl = `SIZE 40 mm,30 mm
GAP 2 mm,0
DENSITY 8
SPEED 2
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET TEAR OFF
CODEPAGE 1252
CLS
TEXT 20,30,"TSS24.BF2",0,1,1,"${this.convertToAscii(data.productName || 'Product')}"
TEXT 20,80,"TSS24.BF2",0,1,1,"SKU: ${data.skuCode || 'N/A'}"
TEXT 20,130,"TSS24.BF2",0,1,1,"${this.convertToAscii(data.spec || 'Spec')}"
TEXT 20,180,"TSS24.BF2",0,1,1,"Code: ${data.barcodeTail || 'N/A'}"
PRINT ${copies}
`;
    
    console.log('[Template] Generated simple text TSPL:', tspl);
    return tspl;
  }

  // 生成简单测试图案的BITMAP TSPL（用于诊断）
  private generateTestBitmapTspl(copies: number = 1): string {
    console.log('[Template] Generating test bitmap pattern for diagnosis');
    
    // 创建一个更简单的8x8像素测试图案
    const width = 8; // 像素宽度
    const height = 8; // 像素高度
    const bytesPerRow = Math.ceil(width / 8); // 每行字节数 = 1
    
    // 手动创建一个简单的图案：对角线
    const bitmap: number[] = [
      0b10000000, // 第1行：左上角一个点
      0b01000000, // 第2行：向右移一位
      0b00100000, // 第3行：向右移一位
      0b00010000, // 第4行：向右移一位
      0b00001000, // 第5行：向右移一位
      0b00000100, // 第6行：向右移一位
      0b00000010, // 第7行：向右移一位
      0b00000001, // 第8行：右下角一个点
    ];
    
    // 转换为十六进制字符串，每个字节用两位十六进制表示
    const hexData = bitmap.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
    
    console.log(`[Template] Test bitmap: ${width}x${height} pixels, ${bytesPerRow} bytes per row`);
    console.log(`[Template] Bitmap data (${bitmap.length} bytes):`, hexData);
    console.log(`[Template] Binary pattern:`);
    bitmap.forEach((byte, i) => {
      console.log(`[Template] Row ${i+1}: ${byte.toString(2).padStart(8, '0')} (0x${byte.toString(16).padStart(2, '0').toUpperCase()})`);
    });
    
    const tspl = `SIZE 40 mm,30 mm
GAP 2 mm,0
DENSITY 8
SPEED 2
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET TEAR OFF
CODEPAGE 1252
CLS
TEXT 50,50,"TSS24.BF2",0,1,1,"TEST BITMAP"
BITMAP 50,100,${bytesPerRow},${height},0,${hexData}
PRINT ${copies}
`;
    
    console.log('[Template] Generated test bitmap TSPL with diagonal pattern');
    return tspl;
  }

  private convertToAscii(text: string): string {
    // 简单的中文到拼音转换，或者返回英文描述
    const chineseToEnglish: Record<string, string> = {
      '测试规格': 'TEST SPEC',
      '测试产品': 'TEST PRODUCT',
      '规格': 'SPEC',
      '测试': 'TEST',
      '条码': 'BARCODE',
      '打印': 'PRINT',
      '产品': 'PRODUCT',
      '商品': 'ITEM',
      '食品': 'FOOD',
      '饮料': 'DRINK',
      '零食': 'SNACK'
    };
    
    // 如果有直接映射，使用映射
    if (chineseToEnglish[text]) {
      return chineseToEnglish[text];
    }
    
    // 检查是否包含中文字符
    const hasChinese = /[\u4e00-\u9fff]/.test(text);
    if (hasChinese) {
      // 如果包含中文但没有映射，返回通用名称
      return 'PRODUCT';
    }
    
    // 如果是纯英文/数字，直接返回
    return text || 'N/A';
  }

  // 从TSPL指令中提取位图数据
  private extractBitmapDataFromTspl(tspl: string): string {
    try {
      // 查找BITMAP指令行
      const lines = tspl.split('\n');
      for (const line of lines) {
        const match = line.match(/^BITMAP\s+\d+,\d+,\d+,\d+,\d+,(.*)$/);
        if (match) {
          return match[1].trim(); // 返回位图数据部分
        }
      }
      console.warn('[Template] No bitmap data found in TSPL');
      return '';
    } catch (error) {
      console.error('[Template] Failed to extract bitmap data:', error);
      return '';
    }
  }

  // 使用 Playwright 将 HTML 渲染为位图 TSPL
  private async htmlToTsplBitmapViaHeadless(html: string, widthMm: number, heightMm: number, copies: number = 1): Promise<string> {
    console.log('[Template] Converting HTML to BITMAP via headless browser:', html.substring(0, 200) + '...');
    console.log(`[Template] Print copies requested: ${copies}`);
    
    // 使用200dpi分辨率的固定像素尺寸
    // 40mm = 1.575英寸 * 200dpi = 315px (取320对齐到8的倍数)
    // 30mm = 1.181英寸 * 200dpi = 236px (取240对齐到8的倍数)
    const W = 320; // 40mm @ 200dpi ≈ 315px, 向上对齐到320
    const H = 240; // 30mm @ 200dpi ≈ 236px, 向上对齐到240
    console.log(`[Template] Using fixed pixel size for 200dpi printer: ${W}x${H}px`);
    
    try {
      // 保存copies参数到局部变量，避免作用域问题
      const printCopies = copies;
      const { chromium } = require('playwright');
      
      // 使用固定的px单位HTML结构
      const fullHtml = `<!doctype html><html><head><meta charset="utf-8" />
        <meta name="viewport" content="width=${W}, height=${H}, initial-scale=1.0">
        <style>
          * { 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body { 
            margin: 0; 
            padding: 0; 
            width: ${W}px; 
            height: ${H}px; 
            font-family: Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          .label { 
            width: ${W}px; 
            height: ${H}px; 
            overflow: hidden;
            position: relative;
          }
          .label * { 
            font-family: Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif !important; 
          }
        </style>
      </head><body><div class="label">${html}</div></body></html>`;
      
      console.log('[Template] Launching Playwright browser...');
      console.log('[Template] Using px units template for direct pixel rendering');
      console.log('[Template] Full HTML for browser:', fullHtml.substring(0, 500) + '...');
      
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--force-device-scale-factor=1',
          '--disable-web-security',
          '--disable-font-subpixel-positioning',
          '--disable-features=VizDisplayCompositor',
          '--run-all-compositor-stages-before-draw',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows'
        ]
      });
      
      const page = await browser.newPage();
      
      // 使用简化的屏幕模式设置
      await page.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ 
        width: W, 
        height: H,
        deviceScaleFactor: 1
      });
      console.log(`[Template] Viewport set to ${W}x${H}px, screen media`);
      
      await page.setContent(fullHtml, { waitUntil: 'networkidle' });
      
      // 截图为PNG buffer - 直接使用目标分辨率
      const screenshot = await page.screenshot({ 
        type: 'png', 
        fullPage: false, 
        clip: { x: 0, y: 0, width: W, height: H } 
      });
      
      await browser.close();
      console.log('[Template] Browser screenshot completed, size:', screenshot.length, 'bytes');

      // 使用 Jimp 处理截图
      const Jimp = require('jimp');
      let img = await Jimp.read(screenshot);
      console.log('[Template] Original screenshot size:', img.bitmap.width, 'x', img.bitmap.height);

      // 第4.5步：调整图片尺寸到目标大小（320x240）
      if (img.bitmap.width !== W || img.bitmap.height !== H) {
        console.log(`[Template] Resizing image from ${img.bitmap.width}x${img.bitmap.height} to ${W}x${H}`);
        img = img.resize(W, H, Jimp.RESIZE_BILINEAR);
        console.log('[Template] Image resized to target dimensions:', W, 'x', H);
      } else {
        console.log('[Template] Image already at target size, no resizing needed');
      }

      console.log(`[Template] Final image size: ${img.bitmap.width}x${img.bitmap.height} pixels`);
      console.log(`[Template] Target physical size: ${widthMm}x${heightMm}mm at 203 DPI`);
      
      // 验证渲染尺寸是否正确
      if (img.bitmap.width !== W || img.bitmap.height !== H) {
        console.log(`[Template] WARNING: Rendered size mismatch! Expected ${W}x${H}, got ${img.bitmap.width}x${img.bitmap.height}`);
      }

      // 确保图像是黑白的
      img.greyscale().contrast(1).dither565(); // 灰度，增加对比度，抖动

      // 将 Jimp 图像转换为 1bpp 位图数据
      const tspl = await this.convertJimpToBitmap(img, W, H, copies);
      return tspl;
    } catch (playwrightError) {
      console.error('[Template] Playwright rendering failed, falling back to manual Jimp rendering:', playwrightError);
      // Fallback to manual Jimp rendering if Playwright fails
      return this.htmlToTsplBitmap(html, widthMm, heightMm, copies);
    }
  }

  // 将 Jimp 图像转换为 TSPL BITMAP 指令
  private convertJimpToBitmap(img: any, W: number, H: number, copies: number = 1): string {
    // 使用200dpi打印机分辨率
    const dpi = 200;
    const dotsPerMm = dpi / 25.4;
    
    console.log('[Template] Using 200dpi resolution image:', W, 'x', H, 'for printer');
    
    const finalW = W;
    const finalH = H;
    const bytesPerRow = Math.ceil(finalW / 8);
    
    // 创建1位位图数据
    const bitmap = new Uint8Array(bytesPerRow * finalH);
    bitmap.fill(0x00); // 全白初始化 (TSPL中: 1=黑色, 0=白色)
    
    let blackPixelCount = 0;
    
    // 将图像数据转换为1位位图
    for (let y = 0; y < finalH; y++) {
      for (let x = 0; x < finalW; x++) {
        if (x < img.bitmap.width && y < img.bitmap.height) {
          const pixelColor = img.getPixelColor(x, y);
          const Jimp = require('jimp');
          const { r, g, b } = Jimp.intToRGBA(pixelColor);
          
          // 简单的灰度阈值判断
          const gray = (r + g + b) / 3;
          const isBlack = gray < 128; // 暗色判断为黑色
          
          if (isBlack) {
            const byteIndex = y * bytesPerRow + Math.floor(x / 8);
            const bitIndex = 7 - (x % 8); // MSB first
            bitmap[byteIndex] |= (1 << bitIndex); // 设置为黑色 (1)
            blackPixelCount++;
          }
        }
      }
    }
    
    console.log('[Template] Processing bitmap, finalW:', finalW, 'finalH:', finalH, 'bytesPerRow:', bytesPerRow, 'totalBytes:', bitmap.length);
    console.log('[Template] Total black pixels (approx):', blackPixelCount, 'out of', finalW * finalH);
    
    // *** 对位图数据进行黑白反转 (按位取反) ***
    console.log('[Template] Inverting bitmap colors...');
    for (let i = 0; i < bitmap.length; i++) {
      bitmap[i] = ~bitmap[i] & 0xFF; // 按位取反,并确保保持在字节范围内
    }
    
    // 转换为十六进制字符串（不带0x前缀，符合TSPL格式）
    const hexList = Array.from(bitmap, byte => byte.toString(16).padStart(2, '0').toUpperCase());
    
    // 调试：输出第一行的位图数据
    const firstRowHex = hexList.slice(0, bytesPerRow).join('');
    console.log('[Template] First row bitmap (hex) after inversion:', firstRowHex);
    
    console.log(`[Template] BITMAP parameters: width=${bytesPerRow} bytes (${finalW} dots), height=${finalH} dots`);
    console.log(`[Template] Physical size should be: ${(finalW/dotsPerMm).toFixed(1)}mm x ${(finalH/dotsPerMm).toFixed(1)}mm`);
    
    // 将位图数据转换为Base64编码,便于JSON传输
    // 前端将Base64解码为原始二进制字节后发送给打印机
    const bitmapDataBase64 = Buffer.from(bitmap).toString('base64');
    
    console.log(`[Template] Bitmap data: ${bitmap.length} bytes -> ${bitmapDataBase64.length} base64 chars`);
    console.log(`[Template] First 80 bytes as hex: ${Array.from(bitmap.slice(0, 40)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('')}`);
    
    // 使用特殊格式: TSPL头部 + __BINARY_DATA_BASE64__ + Base64数据 + __END_BINARY__
    // 前端需要解析这个格式,将Base64部分转换为原始字节后插入BITMAP命令
    const tsplHeader = [
      'SIZE 40 mm,30 mm',
      'GAP 2 mm,0 mm',
      'DIRECTION 0',
      'CLS',
      `BITMAP 0,0,${bytesPerRow},${finalH},1,`  // 注意这里最后的逗号,后面跟二进制数据, mode=1 (OR)
    ].join('\r\n');
    
    const tsplFooter = `\r\nPRINT ${copies}\r\n`;
    
    // 返回特殊格式的TSPL命令
    const tspl = `${tsplHeader}__BINARY_DATA_BASE64__${bitmapDataBase64}__END_BINARY__${tsplFooter}`;
    
    console.log(`[Template] TSPL header length: ${tsplHeader.length}, footer length: ${tsplFooter.length}`);
    console.log(`[Template] Total TSPL length: ${tspl.length} bytes`);
    
    console.log(`[Template] Using test BITMAP: 16x16 arrow at (100,150)`);
    
    console.log(`[Template] Generated TSPL with PRINT ${copies} command`);
    
    console.log(`[Template] BITMAP TSPL: width=${bytesPerRow} bytes (${finalW} dots), height=${finalH} dots, data=${bitmap.length} bytes`);
    return tspl;
  }

  // 手工位图渲染（回退方案）
  private async htmlToTsplBitmap(html: string, widthMm: number, heightMm: number, copies: number = 1): Promise<string> {
    console.log('[Template] Manual bitmap rendering (fallback)...');
    console.log(`[Template] Fallback print copies requested: ${copies}`);
    
    // 使用200dpi分辨率计算像素
    const dpi = 200;
    const dotsPerMm = dpi / 25.4;
    // 40mm @ 200dpi = 315px, 30mm @ 200dpi = 236px
    // 向上对齐到8的倍数
    const W = Math.ceil((widthMm * dotsPerMm) / 8) * 8;  // 320
    const H = Math.ceil((heightMm * dotsPerMm) / 8) * 8;  // 240
    console.log(`[Template] Fallback image size: ${W}x${H}px @ ${dpi}dpi`);
    
    const Jimp = require('jimp');
    const img = new Jimp(W, H, 0xFFFFFFFF); // 白底
    
    try {
      // 简单的文字和边框渲染
      const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      
      // 绘制边框
      for (let i = 0; i < 4; i++) {
        img.scan(i, 0, W - 2*i, 1, function (x, y, idx) { this.bitmap.data[idx] = 0; this.bitmap.data[idx+1] = 0; this.bitmap.data[idx+2] = 0; });
        img.scan(i, H-1-i, W - 2*i, 1, function (x, y, idx) { this.bitmap.data[idx] = 0; this.bitmap.data[idx+1] = 0; this.bitmap.data[idx+2] = 0; });
        img.scan(i, i, 1, H - 2*i, function (x, y, idx) { this.bitmap.data[idx] = 0; this.bitmap.data[idx+1] = 0; this.bitmap.data[idx+2] = 0; });
        img.scan(W-1-i, i, 1, H - 2*i, function (x, y, idx) { this.bitmap.data[idx] = 0; this.bitmap.data[idx+1] = 0; this.bitmap.data[idx+2] = 0; });
      }
      
      // 添加文字
      img.print(font, 10, 10, 'FALLBACK');
      img.print(font, 10, H-30, `${W}x${H}`);
      
    } catch (error) {
      console.error('[Template] Manual rendering error:', error);
    }
    
    return this.convertJimpToBitmap(img, W, H);
  }

  // 传统 TSPL 渲染（已废弃，保留兼容性）
  private async htmlToTspl(html: string, data: any): Promise<string> {
    console.log('[Template] Legacy TSPL rendering (deprecated)...');
    
    // 简单的 TSPL 生成
    const tspl = [
      'SIZE 40 mm,30 mm',
      'GAP 2 mm,0',
      'DENSITY 8',
      'SPEED 2',
      'CLS',
      `TEXT 160,12,"4",0,1,1,"${data?.spec || '规格'}"`,
      `TEXT 60,200,"5",0,2,2,"${data?.barcodeTail || '条码'}"`,
      'PRINT 1',
    ].join('\n');
    
    return tspl;
  }

  /**
   * 公开的 Playwright HTML 渲染接口 - 用于 APP 和测试
   */
  @Post('render-html-to-bitmap')
  async renderHtmlToBitmap(@Body() body: {
    html: string;
    width: number;
    height: number;
    copies?: number;
  }) {
    try {
      console.log('[Template] Public API: render-html-to-bitmap called');
      console.log('[Template] HTML length:', body.html?.length);
      console.log('[Template] Size:', body.width, 'x', body.height);
      console.log('[Template] Copies:', body.copies || 1);

      if (!body.html || !body.width || !body.height) {
        throw new Error('Missing required parameters: html, width, height');
      }

      // 转换 px 为 mm (假设 200dpi: 1mm ≈ 7.87px)
      const widthMm = Math.round(body.width / 7.87);
      const heightMm = Math.round(body.height / 7.87);

      const tspl = await this.htmlToTsplBitmapViaHeadless(
        body.html,
        widthMm,
        heightMm,
        body.copies || 1
      );

      console.log('[Template] TSPL generated, length:', tspl.length);

      return { rendered: tspl };
    } catch (error) {
      console.error('[Template] render-html-to-bitmap error:', error);
      throw error;
    }
  }

  /**
   * 批量生成TSPL打印指令 - 用于app标签机批量打印优化
   */
  @Post('batch-tspl')
  async generateBatchTspl(@Body() body: { 
    items: Array<{
      templateId: number;
      data: any;
      copies: number;
    }>;
  }) {
    try {
      console.log(`[Template] 开始批量生成TSPL，共${body.items.length}个标签`);
      
      if (!body.items || body.items.length === 0) {
        throw new Error('没有提供标签数据');
      }

      const tsplCommands: string[] = [];
      let totalLabels = 0;

      // 生成批量TSPL头部设置（只需要一次）
      const batchHeader = [
        'SIZE 40 mm,30 mm',
        'GAP 2 mm,0', 
        'DENSITY 8',
        'SPEED 2',
        'DIRECTION 1,0',
        'REFERENCE 0,0',
        'OFFSET 0 mm',
        'SET TEAR OFF',
        'CODEPAGE 1252'
      ];
      
      tsplCommands.push(...batchHeader);

      // 为每个标签生成内容和打印指令
      for (const item of body.items) {
        const template = await this.templateService.findOne(item.templateId);
        if (!template) {
          console.warn(`[Template] 模板ID ${item.templateId} 不存在，跳过`);
          continue;
        }

        // 渲染HTML内容
        const htmlContent = this.templateService.renderTemplate(template.contentTspl || template.content, item.data);
        
        // 转换为TSPL位图指令（不包含头部设置和PRINT指令）
        const labelTspl = await this.htmlToTsplBitmapContent(htmlContent, 40, 30);
        
        // 为每份副本添加标签内容
        const copies = Math.max(1, item.copies || 1);
        for (let i = 0; i < copies; i++) {
          tsplCommands.push('CLS'); // 清除缓冲区
          tsplCommands.push(labelTspl); // 添加标签内容
          totalLabels++;
        }
      }

      // 添加批量打印指令
      tsplCommands.push(`PRINT ${totalLabels}`);
      
      const batchTspl = tsplCommands.join('\n');
      
      console.log(`[Template] 批量TSPL生成完成，总计${totalLabels}个标签`);
      
      return {
        success: true,
        tspl: batchTspl,
        totalLabels,
        message: `批量TSPL生成成功，共${totalLabels}个标签`
      };
      
    } catch (error) {
      console.error('[Template] 批量TSPL生成失败:', error);
      return {
        success: false,
        error: error.message,
        message: '批量TSPL生成失败'
      };
    }
  }

  /**
   * 生成单个标签的TSPL内容（不包含头部设置和PRINT指令）
   */
  private async htmlToTsplBitmapContent(html: string, widthMm: number, heightMm: number): Promise<string> {
    try {
      // 使用现有的HTML到位图转换逻辑
      const fullTspl = await this.htmlToTsplBitmap(html, widthMm, heightMm, 1);
      
      // 提取BITMAP指令部分（去掉头部设置和PRINT指令）
      const lines = fullTspl.split('\n');
      const bitmapLine = lines.find(line => line.startsWith('BITMAP'));
      
      if (!bitmapLine) {
        throw new Error('无法生成BITMAP指令');
      }
      
      return bitmapLine;
      
    } catch (error) {
      console.error('[Template] 生成标签内容失败:', error);
      throw error;
    }
  }
}
