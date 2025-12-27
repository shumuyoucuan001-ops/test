/**
 * 时间格式化工具函数
 * 将ISO格式时间转换为数据库格式，不做任何时区转换
 */

/**
 * 格式化时间字符串显示
 * 如果输入是ISO格式（如 2025-12-27T11:47:18.000Z），转换为普通格式（2025-12-27 11:47:18）
 * 如果输入已经是普通格式，直接返回
 * 不做任何时区转换，只是格式转换
 * 
 * @param timeString 时间字符串，可能是ISO格式或普通格式
 * @returns 格式化后的时间字符串（YYYY-MM-DD HH:mm:ss），如果输入为空则返回 '-'
 */
export function formatDateTime(timeString: string | null | undefined): string {
  if (!timeString) {
    return '-';
  }

  // 如果是ISO格式（包含 'T' 和 'Z' 或时区信息），转换为普通格式
  if (timeString.includes('T')) {
    // 提取日期和时间部分，去掉时区信息
    // 例如：2025-12-27T11:47:18.000Z -> 2025-12-27 11:47:18
    const match = timeString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
  }

  // 如果已经是普通格式，直接返回
  return timeString;
}

/**
 * 格式化时间为中文本地化字符串
 * 将ISO格式时间转换为数据库格式，不做任何时区转换
 * @param timeString 时间字符串，可能是ISO格式或普通格式
 * @returns 格式化后的时间字符串（YYYY-MM-DD HH:mm:ss），如果输入为空则返回 '-'
 */
export function formatDateTimeCN(timeString: string | null | undefined): string {
  if (!timeString) {
    return '-';
  }

  // 如果是ISO格式，转换为普通格式
  if (timeString.includes('T')) {
    const match = timeString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
  }

  // 如果已经是普通格式，直接返回
  return timeString;
}

