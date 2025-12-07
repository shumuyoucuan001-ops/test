// 将后台 HTML 模板（默认标签模板）转换为 TSPL（40mm x 30mm）
// 仅针对你提供的布局：
// - 顶部居中规格（top:1.5mm; left:2mm; right:2mm; font-size:12px; font-weight:600）
// - 中间二维码（top:6.5mm; left:12.5mm; width:15mm; height:15mm）
// - 底部居中 6 位尾号（bottom:2.5mm; left:7.5mm; width:25mm; font-size:4.5mm）

export interface DefaultTemplateData {
  spec?: string;
  qrDataUrl?: string; // SKU
  barcodeTail?: string; // 6 位
}

const mmToDots = (mm: number): number => Math.round(mm * 8); // 203dpi ≈ 8dots/mm

export function renderDefaultHtmlToTspl(templateHtml: string, data: DefaultTemplateData, copies = 1): string {
  // 解析关键位置信息，若解析失败则使用默认值
  const pick = (re: RegExp, dflt: number): number => {
    const m = templateHtml.match(re);
    return m ? parseFloat(m[1]) : dflt;
  };

  // 规格文本
  const specTopMm = pick(/top:\s*([\d.]+)mm[^;]*;\s*left:\s*([\d.]+)mm[^;]*;\s*right:\s*([\d.]+)mm/mi, 1.5);
  // 中间二维码
  const qrTopMm = pick(/<img\s+[^>]*top:\s*([\d.]+)mm/mi, 6.5);
  const qrLeftMm = pick(/<img\s+[^>]*left:\s*([\d.]+)mm/mi, 12.5);
  const qrWidthMm = pick(/<img\s+[^>]*width:\s*([\d.]+)mm/mi, 15);
  // 底部尾号
  const bottomMm = pick(/bottom:\s*([\d.]+)mm/mi, 2.5);
  const bottomLeftMm = pick(/left:\s*([\d.]+)mm[^;]*;\s*width:\s*([\d.]+)mm/mi, 7.5);

  const lines: string[] = [];
  lines.push('SIZE 40 mm,30 mm');
  lines.push('GAP 2 mm,0');
  lines.push('CODEPAGE 936');
  lines.push('SET CHINESE GB18030');
  lines.push('SET FONTPATH "G:/"');
  lines.push('REFERENCE 0,0');
  lines.push('DIRECTION 1');
  lines.push('DENSITY 12');
  lines.push('CLS');
  lines.push('SET FONT "SIMSUN.TTF"');

  // 规格：居中（近似）
  const xCenterDots = mmToDots(20);
  const specY = mmToDots(specTopMm);
  const spec = (data.spec || '').trim();
  lines.push(`TEXT ${xCenterDots},${specY},"SIMSUN.TTF",0,1,1,"${spec}"`);

  // 二维码：SKU
  const qrx = mmToDots(qrLeftMm);
  const qry = mmToDots(qrTopMm);
  // QR 单元格大小：近似 width/3 mm → dots cell ≈ width(mm)*8/3/ (大致经验)。这里用 6 更稳定
  const qrCell = Math.max(4, Math.min(10, Math.round(qrWidthMm / 2.5)));
  const qrContent = String(data.qrDataUrl || '');
  lines.push(`QRCODE ${qrx},${qry},L,${qrCell},A,0,M2,S7,"${qrContent}"`);

  // 底部尾号：y = 高度 30mm - bottom - 行高(约 4.5mm)
  const tail = String(data.barcodeTail || '');
  const tailY = mmToDots(30 - bottomMm - 4.5);
  const tailX = mmToDots(bottomLeftMm + 12.5); // 居中到 25mm 宽度的大致中点
  lines.push(`TEXT ${tailX},${tailY},"TSS24.BF2",0,1,1,"${tail}"`);

  lines.push(`PRINT ${Math.max(1, copies)}`);
  return lines.join('\n');
}







