"use client";
import { useEffect } from 'react';

interface RedirectPageProps {
  targetPath: string;
}

export default function RedirectPage({ targetPath }: RedirectPageProps) {
  useEffect(() => {
    // 重定向到专属链接
    window.location.replace(targetPath);
  }, [targetPath]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontSize: '16px',
      color: '#666'
    }}>
      正在跳转到专属页面...
    </div>
  );
}

