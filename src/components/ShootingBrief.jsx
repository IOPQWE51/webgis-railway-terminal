// src/components/ShootingBrief.jsx
// 🌅 今日拍摄简报胶囊 —— 收起时是一枚小圆钮，展开是五要素横条
// 数据来自 utils/shootingBrief.js 纯本地计算，跟随地图中心（1.1km 内缓存）

import { useState, useMemo } from 'react';
import { computeShootingBrief } from '../utils/shootingBrief';

const fmtTime = (d) =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '—';

/** 取"当前正在进行或最近一段"，无则取最早段 */
function pickRelevant(intervals) {
  if (!intervals || intervals.length === 0) return null;
  const now = Date.now();
  return intervals.find((i) => i.end.getTime() >= now) || intervals[0];
}

export default function ShootingBrief({ lat, lng }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('earth_terminal_brief_collapsed') === '1'; }
    catch { return false; }
  });

  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem('earth_terminal_brief_collapsed', c ? '0' : '1'); }
    catch { /* 隐私模式等场景静默降级 */ }
    return !c;
  });

  const latKey = Math.round(lat * 100) / 100;
  const lngKey = Math.round(lng * 100) / 100;

  const brief = useMemo(() => {
    try {
      return computeShootingBrief({ lat: latKey, lon: lngKey, date: new Date() });
    } catch (e) {
      console.warn('拍摄简报计算失败:', e.message);
      return null;
    }
  }, [latKey, lngKey]);

  if (!brief) return null;

  const gold = pickRelevant(brief.goldenHours);
  const blue = pickRelevant(brief.blueHours);
  const isPolar = brief.sunrise === null && brief.sunset === null;

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        aria-label="展开今日拍摄简报"
        className="absolute top-4 left-1/2 -translate-x-1/2 z-[1500] w-9 h-9 rounded-full bg-zinc-900/85 backdrop-blur-md border border-cyan-500/30 text-lg leading-none hover:border-cyan-400 transition-colors"
      >
        🌅
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-label="今日拍摄简报"
      className="absolute top-14 left-1/2 -translate-x-1/2 z-[1500] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-zinc-900/90 backdrop-blur-md rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.35)] border border-cyan-500/30 px-4 py-2 text-xs font-mono text-cyan-50 whitespace-nowrap"
    >
      {isPolar ? (
        <span title="极地天象">❄️ 极昼或极夜，太阳今天不上班</span>
      ) : (
        <>
          <span title="日出">🌅 {fmtTime(brief.sunrise)}</span>
          <span title="日落">🌇 {fmtTime(brief.sunset)}</span>
          <span title="黄金时刻">✨ {fmtTime(gold?.start)}–{fmtTime(gold?.end)}</span>
          <span title="蓝调时刻">🌌 {fmtTime(blue?.start)}–{fmtTime(blue?.end)}</span>
        </>
      )}
      <span title={`月相：${brief.moon.phaseName}`}>
        {brief.moon.emoji} {Math.round(brief.moon.fraction * 100)}%
      </span>
      <button
        onClick={toggle}
        className="ml-1 text-zinc-400 hover:text-cyan-300 transition-colors"
        aria-label="收起拍摄简报"
      >
        ×
      </button>
    </div>
  );
}
