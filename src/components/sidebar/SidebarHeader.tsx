import React from 'react';

export const SidebarHeader: React.FC = () => (
  <div className="flex-shrink-0 px-4 py-3.5 flex items-center border-b border-white/6">
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <div
          className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #6d28d9 100%)',
            boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 4px 16px rgba(29,78,216,0.5)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M13 7 C10 6 7 6.5 5 7.5 L5 20 C7 19 10 18.5 13 19.5 Z" fill="white" opacity="0.55"/>
            <path d="M13 7 C16 6 19 6.5 21 7.5 L21 20 C19 19 16 18.5 13 19.5 Z" fill="white" opacity="0.75"/>
            <line x1="13" y1="7" x2="13" y2="19.5" stroke="white" strokeWidth="1.2" opacity="0.9"/>
            <path d="M13 3.5 L4.5 7 L13 10.5 L21.5 7 Z" fill="white" opacity="0.9"/>
            <circle cx="21.5" cy="7" r="1.3" fill="#a78bfa"/>
            <path d="M20 2.5 L20.5 4 L22 4.5 L20.5 5 L20 6.5 L19.5 5 L18 4.5 L19.5 4 Z" fill="#c4b5fd" opacity="0.9"/>
          </svg>
        </div>
        <div className="absolute -bottom-[3px] -right-[3px] w-[10px] h-[10px] bg-emerald-400 rounded-full border-2 border-[#0b1120]">
          <div className="w-full h-full rounded-full bg-emerald-400 animate-ping opacity-60" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <h1
            className="text-[15px] font-black tracking-tight leading-none"
            style={{ background: 'linear-gradient(90deg, #fff 0%, #c7d2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Professor
          </h1>
          <span
            className="text-[15px] font-black tracking-tight leading-none"
            style={{ background: 'linear-gradient(90deg, #818cf8 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            UPSC
          </span>
        </div>
        <p className="text-[9.5px] font-semibold tracking-[0.18em] text-slate-500 uppercase mt-[3px] flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-blue-500/60 inline-block" />
          AI Book Writer
          <span className="w-1 h-1 rounded-full bg-violet-500/60 inline-block" />
        </p>
      </div>
    </div>
  </div>
);
