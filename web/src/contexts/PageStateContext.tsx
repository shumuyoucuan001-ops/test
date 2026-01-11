"use client";

import { createContext, ReactNode, useCallback, useContext } from 'react';

// 页面状态存储接口
export interface PageState {
    [key: string]: any;
}

// Context 接口
interface PageStateContextType {
    savePageState: (pageKey: string, state: PageState) => void;
    getPageState: (pageKey: string) => PageState | null;
    clearPageState: (pageKey: string) => void;
    clearAllPageStates: () => void;
}

const PageStateContext = createContext<PageStateContextType | undefined>(undefined);

// Provider 组件
export function PageStateProvider({ children }: { children: ReactNode }) {
    // 使用 localStorage 持久化存储页面状态
    const STORAGE_KEY = 'pageStates';

    // 从 localStorage 读取所有页面状态
    const loadAllStates = useCallback((): Record<string, PageState> => {
        if (typeof window === 'undefined') return {};

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('[PageState] Failed to load states from localStorage:', error);
            return {};
        }
    }, []);

    // 保存所有页面状态到 localStorage
    const saveAllStates = useCallback((states: Record<string, PageState>) => {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
        } catch (error) {
            console.error('[PageState] Failed to save states to localStorage:', error);
            // localStorage 可能已满，尝试清理旧数据
            try {
                const currentStates = loadAllStates();
                // 保留最近使用的 30 个页面状态
                const entries = Object.entries(currentStates);
                if (entries.length > 30) {
                    const recentStates = entries.slice(-30).reduce((acc, [key, value]) => {
                        acc[key] = value;
                        return acc;
                    }, {} as Record<string, PageState>);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentStates));
                }
            } catch (e) {
                console.error('[PageState] Failed to cleanup old states:', e);
            }
        }
    }, [loadAllStates]);

    // 保存页面状态
    const savePageState = useCallback((pageKey: string, state: PageState) => {
        const allStates = loadAllStates();
        allStates[pageKey] = state;
        saveAllStates(allStates);
    }, [loadAllStates, saveAllStates]);

    // 获取页面状态
    const getPageState = useCallback((pageKey: string): PageState | null => {
        const allStates = loadAllStates();
        return allStates[pageKey] || null;
    }, [loadAllStates]);

    // 清除指定页面状态
    const clearPageState = useCallback((pageKey: string) => {
        const allStates = loadAllStates();
        delete allStates[pageKey];
        saveAllStates(allStates);
    }, [loadAllStates, saveAllStates]);

    // 清除所有页面状态
    const clearAllPageStates = useCallback(() => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return (
        <PageStateContext.Provider
            value={{
                savePageState,
                getPageState,
                clearPageState,
                clearAllPageStates,
            }}
        >
            {children}
        </PageStateContext.Provider>
    );
}

// Hook 用于获取页面状态管理函数
export function usePageStateManager() {
    const context = useContext(PageStateContext);
    if (!context) {
        throw new Error('usePageStateManager must be used within PageStateProvider');
    }
    return context;
}

