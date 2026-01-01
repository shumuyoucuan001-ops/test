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
 * 
 * 注意：由于使用了 App.useApp()，这些函数需要在 React 组件内部调用
 */

/**
 * 从错误对象中提取错误消息
 * 支持多种错误响应格式：
 * - NestJS BadRequestException: error.response.data.message
 * - 通用错误: error.response.data.error
 * - Axios 错误: error.message
 */
export function extractErrorMessage(error: any): string {
    console.log('[extractErrorMessage] 错误对象:', {
        hasResponse: !!error?.response,
        hasData: !!error?.response?.data,
        responseStatus: error?.response?.status,
        responseDataType: typeof error?.response?.data,
        dataContent: error?.response?.data,
        errorMessage: error?.message,
    });

    // 尝试多种错误响应格式
    if (error?.response?.data) {
        const data = error.response.data;

        // 如果 data 是字符串，尝试解析为 JSON（Next.js API route 可能返回文本）
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (parsed?.message) return parsed.message;
                if (parsed?.error) return parsed.error;
                if (parsed?.errorMessage) return parsed.errorMessage;
            } catch (e) {
                // 解析失败，使用原始字符串
                if (data && data !== '') return data;
            }
        }

        // data 是对象
        if (typeof data === 'object') {
            if (data.message) return data.message;
            if (data.error) return data.error;
            if (data.errorMessage) return data.errorMessage;
            // NestJS 标准格式
            if (data.statusCode && data.message) return data.message;
        }
    }

    // 尝试从 message 字段获取
    if (error?.message) {
        // 如果是 Axios 错误，message 可能是 "Request failed with status code 400"
        // 这种情况下应该尝试从 response.data 获取
        if (error.message.includes('status code')) {
            const data = error?.response?.data;
            if (typeof data === 'string') {
                try {
                    const parsed = JSON.parse(data);
                    return parsed?.message || parsed?.error || '请求失败';
                } catch (e) {
                    return data || '请求失败';
                }
            }
            return data?.message || data?.error || '请求失败';
        }
        return error.message;
    }

    console.warn('[extractErrorMessage] 无法提取错误消息，使用默认消息');
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
    // 先销毁所有现有的 Modal
    Modal.destroyAll();
    Modal.error({
        title: '⚠️ 操作失败',
        content: errorMessage || defaultMessage,
        okText: '我知道了',
        width: 480,
        centered: true,
        maskClosable: false,
        zIndex: 10000,
        getContainer: () => document.body,
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
 * 
 * 注意：此函数需要在 React 组件内部调用，因为它使用了 App.useApp()
 */
export function showErrorBoth(error: any, defaultMessage: string = '操作失败'): void {
    console.log('[showErrorBoth] 开始显示错误提示');
    const errorMessage = extractErrorMessage(error);
    const finalMessage = errorMessage || defaultMessage;

    console.log('[showErrorBoth] 提取的错误消息:', finalMessage);

    // 先显示顶部提示（快速反馈）
    try {
        message.error(finalMessage, 3);
        console.log('[showErrorBoth] 顶部消息提示已显示');
    } catch (e) {
        console.error('[showErrorBoth] 显示顶部消息失败:', e);
    }

    // 然后显示弹框（确保用户看到）
    // 使用静态方法，但添加 getContainer 确保正确显示
    setTimeout(() => {
        try {
            // 先销毁所有现有的 Modal，避免冲突
            Modal.destroyAll();

            Modal.error({
                title: '⚠️ 操作失败',
                content: finalMessage,
                okText: '我知道了',
                width: 480,
                centered: true,
                maskClosable: false, // 不允许点击遮罩关闭，确保用户看到
                zIndex: 10000, // 确保在最上层
                getContainer: () => document.body, // 明确指定容器
            });
            console.log('[showErrorBoth] Modal 弹框已显示');
        } catch (e) {
            console.error('[showErrorBoth] 显示 Modal 失败:', e);
            // 如果 Modal 失败，使用 notification 作为备用
            try {
                notification.error({
                    message: '⚠️ 操作失败',
                    description: finalMessage,
                    placement: 'top',
                    duration: 0, // 不自动关闭
                    style: { zIndex: 10000 },
                });
            } catch (e2) {
                // 最后的备用方案：使用原生 alert
                alert('操作失败: ' + finalMessage);
            }
        }
    }, 300);
}

