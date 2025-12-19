"use client";

import { useEffect, useState } from 'react';

// 雪花组件
const Snowflake = ({ left, delay, duration }: { left: number; delay: number; duration: number }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: '-10px',
        color: '#ffffff',
        fontSize: '20px',
        animation: `fall ${duration}s linear ${delay}s infinite`,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      ❄
    </div>
  );
};

// 圣诞树组件
const ChristmasTree = () => {
  return (
    <svg
      width="200"
      height="250"
      viewBox="0 0 200 250"
      style={{ display: 'block', margin: '0 auto' }}
    >
      {/* 树干 */}
      <rect x="90" y="200" width="20" height="50" fill="#8B4513" />
      
      {/* 树层1 */}
      <polygon points="100,50 50,120 150,120" fill="#228B22" />
      <polygon points="100,50 60,120 140,120" fill="#32CD32" />
      
      {/* 树层2 */}
      <polygon points="100,80 40,150 160,150" fill="#228B22" />
      <polygon points="100,80 50,150 150,150" fill="#32CD32" />
      
      {/* 树层3 */}
      <polygon points="100,110 30,180 170,180" fill="#228B22" />
      <polygon points="100,110 40,180 160,180" fill="#32CD32" />
      
      {/* 星星 */}
      <polygon
        points="100,30 105,45 120,45 108,55 113,70 100,60 87,70 92,55 80,45 95,45"
        fill="#FFD700"
      />
      
      {/* 装饰球 */}
      <circle cx="70" cy="100" r="8" fill="#FF0000" />
      <circle cx="130" cy="100" r="8" fill="#FFD700" />
      <circle cx="85" cy="130" r="8" fill="#0000FF" />
      <circle cx="115" cy="130" r="8" fill="#FF00FF" />
      <circle cx="100" cy="160" r="8" fill="#FFA500" />
      <circle cx="75" cy="170" r="8" fill="#FF0000" />
      <circle cx="125" cy="170" r="8" fill="#00FF00" />
    </svg>
  );
};

// 礼物盒组件
const GiftBox = ({ left, top, color1, color2 }: { left: number; top: number; color1: string; color2: string }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: `${top}%`,
        width: '60px',
        height: '60px',
        transform: 'rotate(-15deg)',
        animation: 'bounce 2s ease-in-out infinite',
        animationDelay: `${left * 0.1}s`,
      }}
    >
      <svg width="60" height="60" viewBox="0 0 60 60">
        {/* 盒子 */}
        <rect x="10" y="20" width="40" height="30" fill={color1} />
        <rect x="10" y="20" width="40" height="15" fill={color2} />
        {/* 丝带 */}
        <rect x="28" y="10" width="4" height="50" fill="#FFD700" />
        <rect x="8" y="32" width="44" height="4" fill="#FFD700" />
        {/* 蝴蝶结 */}
        <circle cx="30" cy="10" r="8" fill="#FFD700" />
        <circle cx="30" cy="10" r="5" fill={color1} />
      </svg>
    </div>
  );
};

export default function HomePage() {
  const [snowflakes, setSnowflakes] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    // 检查URL参数中是否有钉钉回调的code（回调地址为/home时）
    const urlParams = new URLSearchParams(window.location.search);
    // 优先使用code参数（authCode是钉钉自动添加的冗余参数，值相同）
    const code = urlParams.get('code') || urlParams.get('authCode');
    const state = urlParams.get('state');

    if (code) {
      // 如果有code参数，立即重定向到登录页面处理钉钉回调
      // 只传递code参数，不传递authCode（避免冗余）
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('code', code);
      if (state) {
        loginUrl.searchParams.set('state', state);
      }
      // 使用replace而不是href，避免在历史记录中留下/home?code=xxx&authCode=xxx
      window.location.replace(loginUrl.toString());
      return;
    }

    // 检查登录状态（只有在没有code参数时才检查）
    const uid = localStorage.getItem('userId');
    if (!uid) {
      window.location.href = '/login';
      return;
    }

    // 生成雪花
    const newSnowflakes = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 5 + Math.random() * 5,
    }));
    setSnowflakes(newSnowflakes);
  }, []);

  return (
    <div
      style={{
        padding: 24,
        minHeight: 'calc(100vh - 200px)',
        background: 'linear-gradient(to bottom, #0a1929 0%, #1a3a5a 50%, #0a1929 100%)',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 雪花动画 */}
      <style>{`
        @keyframes fall {
          to {
            transform: translateY(calc(100vh + 20px)) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes bounce {
          0%, 100% {
            transform: rotate(-15deg) translateY(0);
          }
          50% {
            transform: rotate(-15deg) translateY(-10px);
          }
        }
        @keyframes twinkle {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }
      `}</style>

      {snowflakes.map((snow) => (
        <Snowflake key={snow.id} left={snow.left} delay={snow.delay} duration={snow.duration} />
      ))}

      {/* 主要内容区域 */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          paddingTop: '40px',
        }}
      >
        <h2
          style={{
            color: '#ffffff',
            fontSize: '36px',
            marginBottom: '20px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            animation: 'twinkle 3s ease-in-out infinite',
          }}
        >
          🎄 圣诞快乐 🎄
        </h2>
        <h3
          style={{
            color: '#FFD700',
            fontSize: '28px',
            marginBottom: '30px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          欢迎使用术木优选系统
        </h3>

        {/* 圣诞树 */}
        <div style={{ margin: '40px 0', animation: 'float 3s ease-in-out infinite' }}>
          <ChristmasTree />
        </div>

        {/* 礼物盒 */}
        <GiftBox left={10} top={60} color1="#FF0000" color2="#8B0000" />
        <GiftBox left={80} top={70} color1="#0000FF" color2="#00008B" />
        <GiftBox left={15} top={75} color1="#00FF00" color2="#006400" />
        <GiftBox left={75} top={60} color1="#FF00FF" color2="#8B008B" />

        {/* 提示文字 */}
        <p
          style={{
            color: '#ffffff',
            fontSize: '18px',
            marginTop: '50px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          请从左侧菜单选择功能模块
        </p>

        {/* 圣诞装饰文字 */}
        <div
          style={{
            marginTop: '40px',
            fontSize: '24px',
            color: '#FFD700',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          ✨ 祝您工作顺利，节日愉快！ ✨
        </div>
      </div>

      {/* 底部装饰 */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '20px',
          fontSize: '30px',
        }}
      >
        <span style={{ animation: 'twinkle 2s ease-in-out infinite' }}>🎁</span>
        <span style={{ animation: 'twinkle 2s ease-in-out infinite 0.5s' }}>🎄</span>
        <span style={{ animation: 'twinkle 2s ease-in-out infinite 1s' }}>❄️</span>
        <span style={{ animation: 'twinkle 2s ease-in-out infinite 1.5s' }}>🎅</span>
        <span style={{ animation: 'twinkle 2s ease-in-out infinite 2s' }}>🎁</span>
      </div>
    </div>
  );
}