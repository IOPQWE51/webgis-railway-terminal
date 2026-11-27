// src/components/ItineraryWorkbench.jsx
// 🧳 行程按天编排工作台 —— 按天分组、拖拽/按键排序、可选时段/交通耗时/汇率联动预算 + ICS 日历导出

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Plus, ArrowUp, ArrowDown, GripVertical,
  MapPin, Search, X, Route, Trash2, Edit3, SlidersHorizontal, Download, Clock, Wallet
} from 'lucide-react';
import {
  buildItineraryDays,
  assignPointToDay,
  reorderDayPoints,
  nextDayLabel,
  compareDayLabels,
  estimateLegDurationMin,
  formatDurationZh,
  summarizeBudgetCNY
} from '../utils/itinerary';
import { toICS, exportFileName, downloadTextFile } from '../utils/pointsExport';
import { getIconStyle } from '../utils/helpers';

const BEST_TIME_SHORT = {
  morning: '朝场',
  evening: '晚场',
  both: '朝晚',
  night: '夜景',
};

const TRANSIT_LABELS = {
  rail: '🚆 铁道',
  walk: '🚶 步行',
  drive: '🚗 自驾',
  ferry: '⛴️ 渡轮',
  flight: '✈️ 航班',
};

const CURRENCIES = ['CNY', 'JPY', 'USD', 'EUR', 'GBP', 'KRW', 'THB', 'HKD'];
const FALLBACK_RATES = { CNY: 1, JPY: 22.5, USD: 0.14, EUR: 0.13, GBP: 0.11, KRW: 195, THB: 4.8, HKD: 1.09 };

export default function ItineraryWorkbench({ customPoints = [], onPointsUpdate, onLocatePoint }) {
  const [extraDays, setExtraDays] = useState(['Day 1']);
  const [targetDay, setTargetDay] = useState('Day 1');
  const [poolQuery, setPoolQuery] = useState('');
  const [poolCategory, setPoolCategory] = useState('all');
  const [dragState, setDragState] = useState(null); // { day, index }
  const [editingPointId, setEditingPointId] = useState(null);
  const [tripStartDate, setTripStartDate] = useState('');
  const [ratesFromCNY, setRatesFromCNY] = useState(FALLBACK_RATES);

  useEffect(() => {
    let cancelled = false;
    fetch('https://open.er-api.com/v6/latest/CNY')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.rates) setRatesFromCNY(data.rates);
      })
      .catch(() => { /* 离线或超时时沿用内置参考汇率兜底 */ });
    return () => { cancelled = true; };
  }, []);

  const itinerary = useMemo(() => buildItineraryDays(customPoints), [customPoints]);

  const allDayNames = useMemo(() => {
    const set = new Set(itinerary.days.map((d) => d.day));
    extraDays.forEach((d) => set.add(d));
    if (set.size === 0) set.add('Day 1');
    return [...set].sort(compareDayLabels);
  }, [itinerary.days, extraDays]);

  const effectiveTargetDay = allDayNames.includes(targetDay) ? targetDay : allDayNames[0];

  const dayCards = useMemo(() => {
    const byName = new Map(itinerary.days.map((d) => [d.day, d]));
    return allDayNames.map((day) => byName.get(day) || { day, stops: [], totalDistanceKm: 0 });
  }, [allDayNames, itinerary.days]);

  const grandBudget = useMemo(
    () => summarizeBudgetCNY(itinerary.days.flatMap((d) => d.stops), ratesFromCNY),
    [itinerary.days, ratesFromCNY]
  );

  const filteredPool = useMemo(() => {
    const q = poolQuery.trim().toLowerCase();
    return itinerary.unassigned.filter((pt) => {
      if (poolCategory !== 'all' && pt.category !== poolCategory) return false;
      if (!q) return true;
      return (
        String(pt.name || '').toLowerCase().includes(q) ||
        String(pt.group || '').toLowerCase().includes(q) ||
        String(pt.source || '').toLowerCase().includes(q)
      );
    });
  }, [itinerary.unassigned, poolQuery, poolCategory]);

  const handleAddDay = () => {
    const next = nextDayLabel(allDayNames);
    setExtraDays((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setTargetDay(next);
  };

  const handleRenameDay = (oldDay) => {
    const next = window.prompt('修改天数名称（如 Day 1 · 关西 或 04-02 京都）', oldDay);
    if (!next) return;
    const trimmed = next.trim().slice(0, 16);
    if (!trimmed || trimmed === oldDay) return;
    setExtraDays((prev) => prev.map((d) => (d === oldDay ? trimmed : d)));
    if (targetDay === oldDay) setTargetDay(trimmed);
    onPointsUpdate(
      customPoints.map((p) => ((p.day || '').trim() === oldDay ? { ...p, day: trimmed } : p))
    );
  };

  const handleClearDay = (dayName) => {
    setExtraDays((prev) => prev.filter((d) => d !== dayName));
    onPointsUpdate(
      customPoints.map((p) => {
        if ((p.day || '').trim() !== dayName) return p;
        const rest = { ...p };
        delete rest.day;
        delete rest.dayOrder;
        return rest;
      })
    );
  };

  const handleAssign = (pointId, dayName) => {
    onPointsUpdate(assignPointToDay(customPoints, pointId, dayName));
  };

  const handleMove = (dayName, fromIdx, toIdx) => {
    onPointsUpdate(reorderDayPoints(customPoints, dayName, fromIdx, toIdx));
  };

  const handlePatchPoint = (pointId, patch) => {
    onPointsUpdate(
      customPoints.map((p) => {
        if (String(p.id) !== String(pointId)) return p;
        const next = { ...p, ...patch };
        if (next.budget === '' || next.budget === null || Number.isNaN(Number(next.budget))) {
          delete next.budget;
        } else {
          next.budget = Math.max(0, Math.round(Number(next.budget) * 100) / 100);
        }
        return next;
      })
    );
  };

  const handleExportICS = () => {
    if (itinerary.days.length === 0) return;
    const ics = toICS(itinerary.days, tripStartDate);
    downloadTextFile(ics, exportFileName('earth-terminal-itinerary', 'ics'), 'text/calendar;charset=utf-8');
  };

  return (
    <div className="space-y-5">
      {/* 顶部行程总览条 */}
      <div className="bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-ink flex items-center gap-2">
            <Route className="w-5 h-5 text-sora" />
            行程按天编排
          </h3>
          <p className="text-xs text-ink-3 mt-1">
            支持拖拽或上下调序、点开单站补充时段/交通耗时/多币种预算与备注，一键导出 .ics 日历。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-paper-3/80 border border-line/80 text-xs">
            <span><strong className="font-mono text-ink">{itinerary.days.length}</strong> 天</span>
            <span className="text-line">|</span>
            <span><strong className="font-mono text-ink">{itinerary.scheduledCount}</strong> 站</span>
            <span className="text-line">|</span>
            <span>里程 <strong className="font-mono text-sora-deep">{itinerary.grandTotalKm.toFixed(1)} km</strong></span>
            {grandBudget.count > 0 && (
              <>
                <span className="text-line">|</span>
                <span className="inline-flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-wakaba" />
                  <strong className="font-mono text-ink">≈ ¥{grandBudget.totalCNY.toLocaleString()}</strong>
                </span>
              </>
            )}
          </div>

          {itinerary.scheduledCount > 0 && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={tripStartDate}
                onChange={(e) => setTripStartDate(e.target.value)}
                title="可选：设置 Day 1 出发日期用于导出日历"
                aria-label="行程出发日期"
                className="bg-paper-3/80 border border-line rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-ink outline-none focus:border-sora"
              />
              <button
                type="button"
                onClick={handleExportICS}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-paper-3 hover:bg-sora-soft text-ink-2 hover:text-sora-deep border border-line text-xs font-bold transition-colors"
                title="导出为 .ics 日历文件，导入苹果/谷歌日历"
              >
                <Download className="w-3.5 h-3.5" /> 导出 ICS
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddDay}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sora text-sora-ink hover:bg-sora-deep text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 新增一天
          </button>
        </div>
      </div>

      {/* 主工作区：左按天日程 / 右待编排点位池 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-4">
          {dayCards.map((card) => {
            const dayBudget = summarizeBudgetCNY(card.stops, ratesFromCNY);
            return (
              <section
                key={card.day}
                className="bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-line/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-sora" />
                    <h4 className="text-sm font-black text-ink">{card.day}</h4>
                    <button
                      type="button"
                      onClick={() => handleRenameDay(card.day)}
                      className="p-1 rounded-lg text-ink-3 hover:text-sora-deep hover:bg-sora-soft/50 transition-colors"
                      title="重命名这一天"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono text-ink-3 bg-paper-3 px-2 py-0.5 rounded-full">
                      {card.stops.length} 站 · {card.totalDistanceKm.toFixed(1)} km
                    </span>
                    {dayBudget.count > 0 && (
                      <span className="text-[11px] font-mono font-bold text-wakaba bg-wakaba-soft/70 px-2 py-0.5 rounded-full">
                        ≈ ¥{dayBudget.totalCNY.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {allDayNames.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleClearDay(card.day)}
                      className="text-[11px] font-bold text-ink-3 hover:text-koi inline-flex items-center gap-1 transition-colors"
                      title="移除该天并退回待编排池"
                    >
                      <Trash2 className="w-3 h-3" /> 移除此天
                    </button>
                  )}
                </div>

                {card.stops.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line bg-paper-3/40 py-7 px-4 text-center text-xs text-ink-3">
                    这一天还没有安排点位，从右侧收藏池点击「+ {card.day}」即可开始编排。
                  </div>
                ) : (
                  <div className="space-y-1">
                    {card.stops.map((pt, idx) => {
                      const style = getIconStyle(pt.category, pt.source);
                      const isDragging = dragState?.day === card.day && dragState?.index === idx;
                      const isEditing = editingPointId === pt.id;
                      const mode = pt.transitMode || 'rail';
                      const estMin = idx > 0 && pt.legFromPrevKm !== null
                        ? estimateLegDurationMin(pt.legFromPrevKm, mode)
                        : null;

                      return (
                        <div key={pt.id}>
                          {/* 相邻两站之间的里程 + 参考耗时标尺 */}
                          {idx > 0 && pt.legFromPrevKm !== null && (
                            <div className="flex flex-wrap items-center gap-2 py-1 pl-7 text-[11px] font-mono text-ink-3">
                              <span className="w-px h-3.5 bg-sora/40 inline-block" aria-hidden="true" />
                              <span>↓ 直线约 {pt.legFromPrevKm.toFixed(1)} km</span>
                              {estMin && (
                                <span className="text-sora-deep font-sans text-[10px] font-bold bg-sora-soft/60 px-2 py-0.5 rounded-full">
                                  {TRANSIT_LABELS[mode] || '🚆 铁道'} {formatDurationZh(estMin)}
                                </span>
                              )}
                            </div>
                          )}

                          <div
                            draggable
                            onDragStart={() => setDragState({ day: card.day, index: idx })}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragState && dragState.day === card.day && dragState.index !== idx) {
                                handleMove(card.day, dragState.index, idx);
                              }
                              setDragState(null);
                            }}
                            onDragEnd={() => setDragState(null)}
                            className={`rounded-2xl border transition-all ${
                              isDragging
                                ? 'opacity-50 border-sora bg-sora-soft/40'
                                : 'bg-paper-3/55 border-line/80 hover:border-sora/45'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 p-2.5">
                              <span className="cursor-grab text-ink-3 hover:text-ink shrink-0" title="拖动排序">
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <span className="w-5 h-5 rounded-full bg-sora text-sora-ink text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>

                              <button
                                type="button"
                                onClick={() => onLocatePoint?.(pt)}
                                className="flex-1 min-w-0 text-left group"
                                title="在地图上查看此点位与光影"
                              >
                                <div className="text-xs font-bold text-ink group-hover:text-sora-deep truncate flex flex-wrap items-center gap-1.5">
                                  <span>{style.icon}</span>
                                  {pt.timeSlot && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-sora-soft/80 text-sora-deep shrink-0">
                                      <Clock className="w-2.5 h-2.5" /> {pt.timeSlot}
                                    </span>
                                  )}
                                  <span className="truncate">{pt.name}</span>
                                  {pt.category === 'camera' && pt.bestTime && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                                      {BEST_TIME_SHORT[pt.bestTime] || '机位'}
                                    </span>
                                  )}
                                  {Number.isFinite(pt.budget) && pt.budget > 0 && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-wakaba-soft/80 text-ink shrink-0">
                                      {pt.budget} {pt.currency || 'CNY'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-ink-3 truncate mt-0.5">
                                  {pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}
                                  {pt.focalLength ? ` · ${pt.focalLength}` : ''}
                                  {pt.notes ? ` · ${pt.notes}` : ''}
                                </div>
                              </button>

                              {/* 快捷操作：详情/换天/上移/下移/移出 */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setEditingPointId(isEditing ? null : pt.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isEditing
                                      ? 'bg-sora text-sora-ink'
                                      : 'text-ink-3 hover:text-sora-deep hover:bg-paper-2'
                                  }`}
                                  title="编辑时段、交通方式、预算与备注"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>
                                {allDayNames.length > 1 && (
                                  <select
                                    aria-label="切换所属天数"
                                    value={card.day}
                                    onChange={(e) => handleAssign(pt.id, e.target.value)}
                                    className="text-[11px] font-bold bg-paper-2 border border-line rounded-lg px-1.5 py-1 text-ink-2 outline-none cursor-pointer"
                                  >
                                    {allDayNames.map((d) => (
                                      <option key={d} value={d}>{d}</option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMove(card.day, idx, idx - 1)}
                                  className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-paper-2 disabled:opacity-30 transition-colors"
                                  title="上移"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === card.stops.length - 1}
                                  onClick={() => handleMove(card.day, idx, idx + 1)}
                                  className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-paper-2 disabled:opacity-30 transition-colors"
                                  title="下移"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAssign(pt.id, '')}
                                  className="p-1 rounded-lg text-ink-3 hover:text-koi hover:bg-koi-soft/60 transition-colors"
                                  title="移出行程"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* 可选折叠表单：时段 / 交通方式 / 预算+币种 / 备注 */}
                            {isEditing && (
                              <div className="px-3 pb-3 pt-2.5 border-t border-line/60 bg-paper-2/70 rounded-b-2xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <input
                                  type="text"
                                  value={pt.timeSlot || ''}
                                  onChange={(e) => handlePatchPoint(pt.id, { timeSlot: e.target.value.slice(0, 16) })}
                                  placeholder="时段 如 06:30"
                                  className="bg-paper-3/80 border border-line rounded-xl px-2.5 py-1.5 text-xs text-ink outline-none focus:border-sora"
                                />
                                <select
                                  value={pt.transitMode || 'rail'}
                                  onChange={(e) => handlePatchPoint(pt.id, { transitMode: e.target.value })}
                                  className="bg-paper-3/80 border border-line rounded-xl px-2 py-1.5 text-xs font-bold text-ink outline-none"
                                >
                                  {Object.entries(TRANSIT_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>{label}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={pt.budget ?? ''}
                                  onChange={(e) => handlePatchPoint(pt.id, { budget: e.target.value })}
                                  placeholder="预算金额"
                                  className="bg-paper-3/80 border border-line rounded-xl px-2.5 py-1.5 text-xs text-ink outline-none focus:border-sora"
                                />
                                <select
                                  value={pt.currency || 'CNY'}
                                  onChange={(e) => handlePatchPoint(pt.id, { currency: e.target.value })}
                                  className="bg-paper-3/80 border border-line rounded-xl px-2 py-1.5 text-xs font-bold text-ink outline-none"
                                >
                                  {CURRENCIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={pt.notes || ''}
                                  onChange={(e) => handlePatchPoint(pt.id, { notes: e.target.value.slice(0, 240) })}
                                  placeholder="自定义备注（如：2号站台尽头机位 / 需提前预约）"
                                  className="col-span-2 sm:col-span-4 bg-paper-3/80 border border-line rounded-xl px-2.5 py-1.5 text-xs text-ink outline-none focus:border-sora"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* 右栏：待编排收藏点位池 */}
        <aside className="lg:col-span-5 bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-black text-ink flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-sora" />
              待编排点位池 ({itinerary.unassigned.length})
            </h4>
            <select
              aria-label="选择加入的目标天"
              value={effectiveTargetDay}
              onChange={(e) => setTargetDay(e.target.value)}
              className="text-xs font-bold bg-sora-soft/70 text-sora-deep border border-sora/30 rounded-xl px-2.5 py-1 outline-none cursor-pointer"
            >
              {allDayNames.map((d) => (
                <option key={d} value={d}>加入 → {d}</option>
              ))}
            </select>
          </div>

          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={poolQuery}
              onChange={(e) => setPoolQuery(e.target.value)}
              placeholder="搜名称或分组（如 京都 / 尾道 / 机位）…"
              className="w-full bg-paper-3/80 border border-line rounded-xl pl-8 pr-3 py-2 text-xs text-ink placeholder-ink-3 outline-none focus:border-sora"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { id: 'all', label: '全部' },
              { id: 'camera', label: '📷 机位' },
              { id: 'spot', label: '📍 地标' },
              { id: 'station', label: '🚉 车站' },
              { id: 'anime', label: '🌸 巡礼' },
              { id: 'hotel', label: '🏨 住宿' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setPoolCategory(chip.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  poolCategory === chip.id
                    ? 'bg-sora text-sora-ink border-sora'
                    : 'bg-paper-3/70 text-ink-2 border-line/70 hover:bg-sora-soft/50'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {filteredPool.slice(0, 50).map((pt) => {
              const style = getIconStyle(pt.category, pt.source);
              return (
                <div
                  key={pt.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-paper-3/55 border border-line/70 hover:border-sora/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onLocatePoint?.(pt)}
                    className="min-w-0 flex-1 text-left"
                    title="在地图上查看"
                  >
                    <div className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                      <span>{style.icon}</span>
                      <span className="truncate">{pt.name}</span>
                    </div>
                    <div className="text-[10px] text-ink-3 truncate mt-0.5">
                      {(pt.group || pt.source || '未分组').replace(/\.csv$/i, '')}
                      {pt.focalLength ? ` · ${pt.focalLength}` : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssign(pt.id, effectiveTargetDay)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-paper-2 hover:bg-sora hover:text-sora-ink text-sora-deep border border-sora/30 text-[11px] font-bold transition-colors"
                  >
                    + {effectiveTargetDay}
                  </button>
                </div>
              );
            })}

            {filteredPool.length === 0 && (
              <p className="text-xs text-ink-3 text-center py-8">
                {customPoints.length === 0
                  ? '还没有收藏点位，先去「点位库与导入」拖入 CSV 或在地图收藏点位吧。'
                  : '当前筛选下没有待编排点位。'}
              </p>
            )}
            {filteredPool.length > 50 && (
              <p className="text-[11px] text-ink-3 text-center py-2">
                仅展示前 50 条（共 {filteredPool.length} 条），输入关键词可快速缩小范围。
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
