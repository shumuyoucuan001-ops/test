/**
 * 时间格式化工具函数
 * 用于正确处理时区问题，将后端返回的时间字符串转换为本地时间显示
 */

/**
 * 格式化时间字符串为本地时间显示
 * 如果后端返回的时间字符串不包含时区信息，假设它是UTC时间，需要转换为本地时间
 * 如果后端返回的时间字符串包含时区信息（如ISO格式），则直接解析
 * 
 * @param timeString 时间字符串，可能是 'YYYY-MM-DD HH:mm:ss' 格式（无时区）或 ISO 格式
 * @param format 可选的自定义格式，默认使用 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的时间字符串，如果输入为空则返回 '-'
 */
export function formatDateTime(timeString: string | null | undefined): string {
  if (!timeString) {
    return '-';
  }

  try {
    // 如果时间字符串不包含时区信息（格式为 'YYYY-MM-DD HH:mm:ss'），
    // 需要将其作为UTC时间解析，然后转换为本地时间
    let date: Date;
    
    // 检查是否是ISO格式（包含 'T' 或时区信息）
    if (timeString.includes('T') || timeString.includes('Z') || timeString.includes('+') || timeString.match(/-\d{2}:\d{2}$/)) {
      // ISO格式，直接解析
      date = new Date(timeString);
    } else {
      // 假设是 'YYYY-MM-DD HH:mm:ss' 格式，不包含时区信息
      // 如果数据库存储的是UTC时间，后端返回的字符串也是UTC时间
      // 需要将其作为UTC时间解析
      // 方法：在字符串末尾添加 'Z' 表示UTC，或者手动解析
      const utcString = timeString.replace(' ', 'T') + 'Z';
      date = new Date(utcString);
    }

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return timeString; // 如果解析失败，返回原始字符串
    }

    // 格式化为本地时间字符串 'YYYY-MM-DD HH:mm:ss'
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('时间格式化错误:', error, timeString);
    return timeString; // 出错时返回原始字符串
  }
}

/**
 * 格式化时间为中文本地化字符串
 * @param timeString 时间字符串
 * @returns 格式化后的时间字符串，格式：'YYYY年MM月DD日 HH:mm:ss'
 */
export function formatDateTimeCN(timeString: string | null | undefined): string {
  if (!timeString) {
    return '-';
  }

  try {
    let date: Date;
    
    if (timeString.includes('T') || timeString.includes('Z') || timeString.includes('+') || timeString.match(/-\d{2}:\d{2}$/)) {
      date = new Date(timeString);
    } else {
      const utcString = timeString.replace(' ', 'T') + 'Z';
      date = new Date(utcString);
    }

    if (isNaN(date.getTime())) {
      return timeString;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('时间格式化错误:', error, timeString);
    return timeString;
  }
}

