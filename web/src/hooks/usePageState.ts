"use client";

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PageState, usePageStateManager } from '../contexts/PageStateContext';

/**
 * Hook 用于在页面组件中保存和恢复状态
 * 
 * 使用示例：
 * ```tsx
 * const [searchText, setSearchText] = useState('');
 * const [currentPage, setCurrentPage] = useState(1);
 * 
 * // 恢复状态
 * const restoredState = usePageStateRestore('supplier-management', {
 *   searchText: '',
 *   currentPage: 1,
 * });
 * 
 * // 在组件挂载时恢复状态
 * useEffect(() => {
 *   if (restoredState) {
 *     if (restoredState.searchText !== undefined) setSearchText(restoredState.searchText);
 *     if (restoredState.currentPage !== undefined) setCurrentPage(restoredState.currentPage);
 *   }
 * }, []);
 * 
 * // 保存状态
 * usePageStateSave('supplier-management', {
 *   searchText,
 *   currentPage,
 * });
 * ```
 */

/**
 * 恢复页面状态
 * @param pageKey 页面唯一标识符（通常使用路径或功能名称）
 * @param defaultState 默认状态对象
 * @returns 恢复的状态对象，如果没有保存的状态则返回 null
 */
export function usePageStateRestore<T extends PageState>(
    pageKey: string,
    defaultState: T
): Partial<T> | null {
    const { getPageState } = usePageStateManager();
    const restoredStateRef = useRef<Partial<T> | null | undefined>(undefined);

    // 只在组件挂载时恢复一次
    if (restoredStateRef.current === undefined) {
        const saved = getPageState(pageKey);
        if (saved) {
            // 合并保存的状态和默认状态
            restoredStateRef.current = { ...defaultState, ...saved } as Partial<T>;
        } else {
            restoredStateRef.current = null;
        }
    }

    return restoredStateRef.current;
}

/**
 * 保存页面状态
 * @param pageKey 页面唯一标识符（通常使用路径或功能名称）
 * @param stateToSave 需要保存的状态对象
 * @param options 选项配置
 */
export function usePageStateSave<T extends PageState>(
    pageKey: string,
    stateToSave: T,
    options?: {
        // 保存防抖延迟（毫秒，默认 300）
        saveDebounce?: number;
        // 是否启用自动保存（默认 true）
        enabled?: boolean;
        // 需要保存的状态键名数组（默认保存所有）
        keysToSave?: string[];
    }
) {
    const { savePageState } = usePageStateManager();
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const stateToSaveRef = useRef<T>(stateToSave);
    const enabled = options?.enabled !== false;
    const saveDebounce = options?.saveDebounce || 300;
    const keysToSave = options?.keysToSave;

    // 更新 ref 以保持最新值（用于卸载时保存）
    useEffect(() => {
        stateToSaveRef.current = stateToSave;
    }, [stateToSave]);

    // 提取需要保存的状态
    const stateToSaveMemo = useMemo(() => {
        const state = keysToSave
            ? keysToSave.reduce((acc, key) => {
                acc[key] = stateToSave[key];
                return acc;
            }, {} as PageState)
            : stateToSave;
        return state;
    }, [stateToSave, keysToSave]);

    // 序列化状态对象用于比较（避免对象引用变化导致不必要的保存）
    // 使用 JSON.stringify 来稳定比较，即使对象引用变化
    const stateKey = useMemo(() => {
        try {
            return JSON.stringify(stateToSaveMemo);
        } catch (e) {
            // 如果序列化失败，使用对象引用作为 fallback
            return String(stateToSaveMemo);
        }
    }, [stateToSaveMemo]);

    // 当 stateToSave 变化时自动保存（防抖）
    useEffect(() => {
        if (!enabled) return;

        // 清除之前的保存定时器
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // 设置新的保存定时器（防抖）
        saveTimeoutRef.current = setTimeout(() => {
            savePageState(pageKey, stateToSaveMemo);
        }, saveDebounce);

        // 清理函数
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [pageKey, stateKey, saveDebounce, enabled, stateToSaveMemo, savePageState]);

    // 组件卸载时立即保存状态
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (enabled) {
                // 使用 ref 获取最新值，避免闭包问题
                const latestState = keysToSave
                    ? keysToSave.reduce((acc, key) => {
                        acc[key] = stateToSaveRef.current[key];
                        return acc;
                    }, {} as PageState)
                    : stateToSaveRef.current;
                savePageState(pageKey, latestState);
            }
        };
    }, [enabled, pageKey, keysToSave, savePageState]);

    // 手动保存函数
    const saveNow = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        const state = keysToSave
            ? keysToSave.reduce((acc, key) => {
                acc[key] = stateToSaveRef.current[key];
                return acc;
            }, {} as PageState)
            : stateToSaveRef.current;
        savePageState(pageKey, state);
    }, [pageKey, keysToSave, savePageState]);

    return { saveNow };
}

/**
 * 清除页面状态
 * @param pageKey 页面唯一标识符
 */
export function usePageStateClear(pageKey: string) {
    const { clearPageState } = usePageStateManager();

    const clear = useCallback(() => {
        clearPageState(pageKey);
    }, [pageKey, clearPageState]);

    return { clear };
}

