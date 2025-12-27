/**
 * 时间格式化工具函数
 * 直接显示数据库返回的原始时间字符串，不做任何时区转换
 */

/**
 * 格式化时间字符串显示
 * 直接返回数据库中的原始时间字符串，不做任何修改
 * 
 * @param timeString 时间字符串，直接显示数据库返回的值
 * @returns 原始时间字符串，如果输入为空则返回 '-'
 */
export function formatDateTime(timeString: string | null | undefined): string {
  if (!timeString) {
    return '-';
  }

  // 直接返回原始字符串，不做任何转换
  return timeString;
}

/**
 * 格式化时间为中文本地化字符串
 * 直接返回数据库中的原始时间字符串，不做任何修改
 * @param timeString 时间字符串
 * @returns 原始时间字符串，如果输入为空则返回 '-'
 */
export function formatDateTimeCN(timeString: string | null | undefined): string {
  if (!timeString) {
    return '-';
  }

  // 直接返回原始字符串，不做任何转换
  return timeString;
}

