import { Modal, message, notification } from 'antd';

/**
 * 错误处理工具函数
 * 
 * 提供4种错误提示方式：
 * 1. showErrorMessage() - 顶部消息提示（自动消失）
 * 2. showErrorModal() - Modal 弹框（需要点击确认）
 * 3. showErrorNotification() - 右上角通知（带关闭按钮）
 * 4. showErrorBoth() - 组合方式：先显示消息，再弹出 Modal（最明显，默认使用）
 * 
 * 使用方法：
 * import { showErrorBoth, showErrorModal, showErrorMessage, showErrorNotification } from '@/lib/errorUtils';
 * 
 * catch (error: any) {
 *   showErrorBoth(error, '保存失败');  // 当前默认方式：最明显
 *   // 或者切换为其他方式：
 *   // showErrorModal(error, '保存失败');      // 方式2：仅弹框
 *   // showErrorMessage(error, '保存失败');    // 方式3：仅顶部提示
 *   // showErrorNotification(error, '保存失败'); // 方式4：仅通知
 * }
 */

/**
 * 从错误对象中提取错误消息
 * 支持多种错误响应格式：
 * - NestJS BadRequestException: error.response.data.message
 * - 通用错误: error.response.data.error
 * - Axios 错误: error.message
 */
export function extractErrorMessage(error: any): string {
    // 尝试多种错误响应格式
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }
    if (error?.response?.data?.error) {
        return error.response.data.error;
    }
    if (error?.response?.data?.errorMessage) {
        return error.response.data.errorMessage;
    }
    if (error?.message) {
        // 如果是 Axios 错误，message 可能是 "Request failed with status code 400"
        // 这种情况下应该尝试从 response.data 获取
        if (error.message.includes('status code')) {
            return error?.response?.data?.message || error?.response?.data?.error || '请求失败';
        }
        return error.message;
    }
    return '操作失败';
}

/**
 * 显示错误提示 - 方式1：使用 message（顶部提示，自动消失）
 */
export function showErrorMessage(error: any, defaultMessage: string = '操作失败'): void {
    const errorMessage = extractErrorMessage(error);
    message.error(errorMessage || defaultMessage, 5); // 5秒后自动消失
}

/**
 * 显示错误提示 - 方式2：使用 Modal（弹框，需要用户点击确认）
 */
export function showErrorModal(error: any, defaultMessage: string = '操作失败'): void {
    const errorMessage = extractErrorMessage(error);
    Modal.error({
        title: '操作失败',
        content: errorMessage || defaultMessage,
        okText: '我知道了',
        width: 480,
    });
}

/**
 * 显示错误提示 - 方式3：使用 notification（右上角通知，带关闭按钮）
 */
export function showErrorNotification(error: any, defaultMessage: string = '操作失败'): void {
    const errorMessage = extractErrorMessage(error);
    notification.error({
        message: '操作失败',
        description: errorMessage || defaultMessage,
        placement: 'topRight',
        duration: 6, // 6秒后自动关闭
    });
}

/**
 * 组合提示：同时使用 message 和 Modal（最明显，默认使用）
 * 先显示顶部提示（3秒），然后弹出 Modal 弹框（需要用户点击确认）
 */
export function showErrorBoth(error: any, defaultMessage: string = '操作失败'): void {
    const errorMessage = extractErrorMessage(error);
    const finalMessage = errorMessage || defaultMessage;

    // 先显示顶部提示（快速反馈）
    message.error(finalMessage, 3);

    // 然后显示弹框（确保用户看到）
    setTimeout(() => {
        Modal.error({
            title: '⚠️ 操作失败',
            content: finalMessage,
            okText: '我知道了',
            width: 480,
            centered: true,
        });
    }, 300);
}

