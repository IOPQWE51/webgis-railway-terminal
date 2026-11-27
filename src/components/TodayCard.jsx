// src/components/TodayCard.jsx
// 🗓️ 光影时刻与附近卡片 —— 支持任意未来/历史日期切换，统一展示朝/晚双场黄金与蓝调时刻

import { useState } from 'react';
import { Sun, Calendar, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const KIND_BADGE = {
  favorite: { emoji: '⭐', title: '我的收藏' },
  base: { emoji: '🚉', title: '铁道节点' },
  hanabi: { emoji: '🎆', title: '花火大会' }
};

function fmtSeg(seg, fmtTime) {
  if (!seg?.start || !seg?.end) return '—';
  return `${fmtTime(seg.start)}–${fmtTime(seg.end)}`;
}

function isValidPlanDate(val) {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function shiftDateKey(dateKey, deltaDays) {
  if (!isValidPlanDate(dateKey)) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export default function TodayCard({ snapshot, selectedDate = '', onDateChange, onFlyTo }) {
  // 本地草稿：防止键盘逐位输年份时中途空串把日期框强行弹回今日，仅在完整合法日期（1900-2100）时提交
  const [draftDate, setDraftDate] = useState(null);

  if (!snapshot?.brief) {
    return (
      <div className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-center text-xs text-ink-3">
        正在载入当地光影与附近节点...
      </div>
    );
  }

  const {
    brief,
    card,
    trigger,
    now,
    tzLabel,
    activeDateKey,
    isCustomDate,
    morningGolden,
    eveningGolden,
    morningBlue,
    eveningBlue,
    isPolar,
    fmtTime
  } = snapshot;

  const committedDate = selectedDate || activeDateKey;
  const inputValue = draftDate !== null ? draftDate : committedDate;

  const handleStepDay = (delta) => {
    const next = shiftDateKey(committedDate, delta);
    if (next) {
      setDraftDate(null);
      onDateChange?.(next);
    }
  };

  return (
    <section
      aria-label="光影时刻与附近"
      className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-between gap-3.5 text-ink"
    >
      <div>
        {/* 卡片头 + 日期切换器 */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-kouchou" />
            {isCustomDate ? '规划日历光影' : '今日光影与附近'}
          </h3>
          <span className="tnum font-mono text-[10px] font-bold text-ink-3 bg-paper-3 px-2 py-0.5 rounded-full border border-line/70">
            {brief.moon.emoji} {Math.round(brief.moon.fraction * 100)}% · {tzLabel}
          </span>
        </div>

        {/* 纯前端天文日期切换（含前/后一天微调按钮，且键盘逐位输入不回弹打乱年份） */}
        {onDateChange && (
          <div className="flex items-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => handleStepDay(-1)}
              className="p-1.5 rounded-xl bg-paper-3/80 border border-line/80 text-ink-2 hover:text-sora-deep hover:border-sora/40 transition-colors shrink-0"
              title="前一天"
              aria-label="前一天"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <label className="flex-1 flex items-center gap-1.5 rounded-xl bg-paper-3/80 border border-line/80 px-2.5 py-1.5 text-xs focus-within:border-sora transition-colors min-w-0">
              <Calendar className="w-3.5 h-3.5 text-sora shrink-0" />
              <input
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                aria-label="切换光影查询日期"
                value={inputValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftDate(v);
                  if (isValidPlanDate(v)) {
                    onDateChange(v);
                  }
                }}
                onBlur={() => {
                  if (draftDate !== null) {
                    if (isValidPlanDate(draftDate)) onDateChange(draftDate);
                    setDraftDate(null);
                  }
                }}
                className="w-full bg-transparent text-xs font-mono font-bold text-ink outline-none cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() => handleStepDay(1)}
              className="p-1.5 rounded-xl bg-paper-3/80 border border-line/80 text-ink-2 hover:text-sora-deep hover:border-sora/40 transition-colors shrink-0"
              title="后一天"
              aria-label="后一天"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {isCustomDate && (
              <button
                type="button"
                onClick={() => { setDraftDate(null); onDateChange(''); }}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold bg-sora-soft/80 text-sora-deep hover:bg-sora-soft transition-colors shrink-0"
                title="回到当地今天"
              >
                <RotateCcw className="w-3 h-3" /> 今天
              </button>
            )}
          </div>
        )}

        {/* 天文四要素矩阵：日出/日落 + 黄金/蓝调朝晚双场（与地点详情弹窗 100% 同源） */}
        {isPolar ? (
          <div className="rounded-xl bg-paper-3/70 px-3 py-2 text-xs text-ink-2 mb-3">
            ❄️ 当前纬度在该日期处于极昼或极夜窗口
          </div>
        ) : (
          <div className="space-y-2 mb-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-paper-3/70 px-3 py-2 flex items-center justify-between">
                <span className="text-ink-3">🌅 日出</span>
                <span className="tnum font-mono font-bold text-ink">{fmtTime(brief.sunrise)}</span>
              </div>
              <div className="rounded-xl bg-paper-3/70 px-3 py-2 flex items-center justify-between">
                <span className="text-ink-3">🌇 日落</span>
                <span className="tnum font-mono font-bold text-ink">{fmtTime(brief.sunset)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-kouchou-soft/55 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-ink-2 font-medium shrink-0">✨ 黄金</span>
              <div className="tnum font-mono text-[11px] font-bold text-ink flex flex-wrap justify-end gap-x-2.5 gap-y-0.5">
                <span><em className="not-italic text-ink-3 font-sans font-normal mr-0.5">朝</em>{fmtSeg(morningGolden, fmtTime)}</span>
                <span><em className="not-italic text-ink-3 font-sans font-normal mr-0.5">晚</em>{fmtSeg(eveningGolden, fmtTime)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-sora-soft/55 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-ink-2 font-medium shrink-0">🌌 蓝调</span>
              <div className="tnum font-mono text-[11px] font-bold text-ink flex flex-wrap justify-end gap-x-2.5 gap-y-0.5">
                <span><em className="not-italic text-ink-3 font-sans font-normal mr-0.5">朝</em>{fmtSeg(morningBlue, fmtTime)}</span>
                <span><em className="not-italic text-ink-3 font-sans font-normal mr-0.5">晚</em>{fmtSeg(eveningBlue, fmtTime)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 稀有光影触发器（仅查询当日实时天气时展示） */}
        {trigger && (
          <div
            className="mb-3 rounded-xl bg-koi-soft/70 border border-koi/20 px-3 py-2 text-xs text-ink leading-relaxed"
            title={trigger.output}
          >
            {trigger.output.split('|')[0].trim()}
            <span className="ml-1 opacity-75">{'⭐'.repeat(trigger.rarity || 3)}</span>
          </div>
        )}
      </div>

      {/* 附近 50km 节点 */}
      <div className="pt-2.5 border-t border-line/70">
        {card?.nearby?.length > 0 ? (
          <ul className="space-y-1">
            {card.nearby.slice(0, 3).map((p) => {
              const badge = KIND_BADGE[p.kind] || KIND_BADGE.base;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onFlyTo?.(p.lat, p.lon, p.name)}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 text-left text-xs hover:bg-sora-soft/50 transition-colors"
                    title={`${badge.title} · 点击定位`}
                  >
                    <span aria-hidden="true">{badge.emoji}</span>
                    <span className="truncate text-ink font-medium">{p.name}</span>
                    {p.date && p.date !== now.toISOString().slice(0, 10) && (
                      <span className="font-mono text-[10px] text-koi">{p.date}</span>
                    )}
                    <span className="ml-auto shrink-0 tnum font-mono text-sora-deep">
                      {p.distanceKm.toFixed(1)} km
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-ink-3 leading-relaxed">
            当前视野 50km 内暂无已收录节点，点击地图任意处可看光影评估或收藏。
          </p>
        )}
      </div>
    </section>
  );
}
