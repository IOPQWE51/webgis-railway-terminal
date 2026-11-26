// src/components/TodayCard.jsx
// 🗓️ 今日光影与附近卡片 —— 优雅落位在地图下方三栏中和带，不再遮挡地图视野

import { Sun } from 'lucide-react';

const KIND_BADGE = {
  favorite: { emoji: '⭐', title: '我的收藏' },
  base: { emoji: '🚉', title: '铁道节点' },
  hanabi: { emoji: '🎆', title: '花火大会' }
};

export default function TodayCard({ snapshot, onFlyTo }) {
  if (!snapshot?.brief) {
    return (
      <div className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-center text-xs text-ink-3">
        正在载入当地光影与附近节点...
      </div>
    );
  }

  const { brief, card, trigger, now, tzLabel, gold, blue, isPolar, fmtTime } = snapshot;

  return (
    <section
      aria-label="今日光影与附近"
      className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-between gap-3.5 text-ink"
    >
      <div>
        {/* 卡片头 */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-kouchou" />
            今日光影与附近
          </h3>
          <span className="tnum font-mono text-[10px] font-bold text-ink-3 bg-paper-3 px-2 py-0.5 rounded-full border border-line/70">
            {brief.moon.emoji} {Math.round(brief.moon.fraction * 100)}% · {tzLabel}
          </span>
        </div>

        {/* 天文四要素紧凑矩阵 */}
        {isPolar ? (
          <div className="rounded-xl bg-paper-3/70 px-3 py-2 text-xs text-ink-2 mb-3">
            ❄️ 当前纬度处于极昼或极夜窗口
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div className="rounded-xl bg-paper-3/70 px-3 py-2 flex items-center justify-between">
              <span className="text-ink-3">🌅 日出</span>
              <span className="tnum font-mono font-bold text-ink">{fmtTime(brief.sunrise)}</span>
            </div>
            <div className="rounded-xl bg-paper-3/70 px-3 py-2 flex items-center justify-between">
              <span className="text-ink-3">🌇 日落</span>
              <span className="tnum font-mono font-bold text-ink">{fmtTime(brief.sunset)}</span>
            </div>
            <div className="rounded-xl bg-kouchou-soft/55 px-3 py-2 flex items-center justify-between">
              <span className="text-ink-2">✨ 黄金</span>
              <span className="tnum font-mono font-bold text-ink text-[11px]">{fmtTime(gold?.start)}–{fmtTime(gold?.end)}</span>
            </div>
            <div className="rounded-xl bg-sora-soft/55 px-3 py-2 flex items-center justify-between">
              <span className="text-ink-2">🌌 蓝调</span>
              <span className="tnum font-mono font-bold text-ink text-[11px]">{fmtTime(blue?.start)}–{fmtTime(blue?.end)}</span>
            </div>
          </div>
        )}

        {/* 稀有光影触发器 */}
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
                    onClick={() => onFlyTo?.(p.lat, p.lon)}
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
