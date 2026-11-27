// src/components/RailDirectoryModal.jsx
// 🚆 全球铁道骨架线路与站点列表视图 —— 按干线展开站点，点站即查看 25km 内你的收藏点位并一键定位

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Train, ChevronDown, ChevronRight, MapPin, Navigation, Search } from 'lucide-react';
import { REGION_REGISTRY } from '../config/regions';
import { filterNearby } from '../utils/todayCard';
import { getIconStyle } from '../utils/helpers';

const UPCOMING_REGIONS = [
  { id: 'eu', icon: '🇪🇺', name: '欧洲 Eurail', hint: '规划中 · 未接入' },
  { id: 'kr', icon: '🇰🇷', name: '韩国 KTX', hint: '规划中 · 未接入' },
];

export default function RailDirectoryModal({ open, initialRegionId = 'jp', customPoints = [], onClose, onSelectStation, onSelectFavorite }) {
  const [regionId, setRegionId] = useState(initialRegionId || REGION_REGISTRY[0]?.id || 'cn');
  const [query, setQuery] = useState('');
  const [expandedLineId, setExpandedLineId] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const activeRegion = useMemo(
    () => REGION_REGISTRY.find((r) => r.id === regionId) || REGION_REGISTRY[0],
    [regionId]
  );

  const stationById = useMemo(() => {
    const map = new Map();
    for (const s of activeRegion?.data?.STATIONS || []) {
      map.set(s.id, s);
    }
    return map;
  }, [activeRegion]);

  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rawLines = activeRegion?.data?.RAILWAY_LINES || [];
    return rawLines
      .map((line, idx) => {
        const lineId = line.id || `${activeRegion.id}_line_${idx}`;
        const stations = (line.points || []).map((id) => stationById.get(id)).filter(Boolean);
        return {
          id: lineId,
          name: line.name || `干线 ${idx + 1}`,
          badge: line.badge || '',
          color: line.color || '#22c55e',
          stations,
        };
      })
      .filter((line) => {
        if (!q) return true;
        return (
          line.name.toLowerCase().includes(q) ||
          line.stations.some((s) => s.name.toLowerCase().includes(q) || (s.desc || '').toLowerCase().includes(q))
        );
      });
  }, [activeRegion, stationById, query]);

  const selectedStation = selectedStationId ? stationById.get(selectedStationId) || null : null;

  const nearbyFavorites = useMemo(() => {
    if (!selectedStation || !Array.isArray(customPoints) || customPoints.length === 0) return [];
    return filterNearby({
      lat: selectedStation.lat,
      lon: selectedStation.lon,
      points: customPoints,
      radiusKm: 25,
      limit: 8,
    });
  }, [selectedStation, customPoints]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9400] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="铁道骨架线路与站点目录"
    >
      <div className="bg-paper-2 border border-line rounded-3xl shadow-2xl w-full max-w-3xl max-h-[84vh] flex flex-col overflow-hidden text-ink">
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-line/80 bg-paper-3/60 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-ink flex items-center gap-2">
              <Train className="w-4 h-4 text-wakaba" />
              铁道骨架 · 线路与站点目录
            </h3>
            <p className="text-[11px] text-ink-3 mt-0.5">
              按线路展开查看沿线枢纽，点选车站可检索 25km 内你收藏的点位与机位。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-ink-3 hover:text-ink hover:bg-paper-3 transition-colors"
            aria-label="关闭目录"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 区域切换 + 搜索 */}
        <div className="px-5 py-3 border-b border-line/70 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {REGION_REGISTRY.map((region) => {
              const active = region.id === activeRegion?.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => {
                    setRegionId(region.id);
                    setExpandedLineId(null);
                    setSelectedStationId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    active
                      ? 'bg-wakaba text-white border-wakaba shadow-sm'
                      : 'bg-paper-3/70 text-ink-2 border-line hover:bg-wakaba-soft/50'
                  }`}
                >
                  <span aria-hidden="true">{region.icon}</span>
                  <span>{region.name}</span>
                  <span className="opacity-75 font-mono text-[10px]">
                    {region.data?.STATIONS?.length || 0}站
                  </span>
                </button>
              );
            })}
            {UPCOMING_REGIONS.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-paper-3/50 text-ink-3 border border-dashed border-line/80 cursor-not-allowed"
                title={item.hint}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-2 text-ink-3 border border-line/60">未接入</span>
              </span>
            ))}
          </div>

          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="筛选线路或站名…"
              className="w-full bg-paper-3/80 border border-line rounded-xl pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-3 outline-none focus:border-sora"
            />
          </div>
        </div>

        {/* 主内容双栏：左干线手风琴 / 右选中车站与附近收藏 */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-7 overflow-y-auto p-4 space-y-2 border-b md:border-b-0 md:border-r border-line/70 custom-scrollbar">
            {lines.map((line) => {
              const isOpen = expandedLineId === line.id || Boolean(query.trim());
              return (
                <div key={line.id} className="rounded-2xl border border-line/80 bg-paper-3/45 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedLineId(expandedLineId === line.id ? null : line.id)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-paper-3/90 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-ink-3 shrink-0" /> : <ChevronRight className="w-4 h-4 text-ink-3 shrink-0" />}
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
                      <span className="text-xs font-bold text-ink truncate">{line.name}</span>
                      {line.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-paper-2 text-ink-3 border border-line/70 shrink-0">
                          {line.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-ink-3 shrink-0">{line.stations.length} 站</span>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-line/50 bg-paper-2/60">
                      {line.stations.map((st) => {
                        const active = selectedStationId === st.id;
                        return (
                          <button
                            key={`${line.id}-${st.id}`}
                            type="button"
                            onClick={() => setSelectedStationId(st.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                              active
                                ? 'bg-sora text-sora-ink border-sora shadow-sm'
                                : 'bg-paper-2 text-ink-2 border-line/80 hover:border-sora/50 hover:text-ink'
                            }`}
                          >
                            {st.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {lines.length === 0 && (
              <p className="text-xs text-ink-3 text-center py-8">没有匹配的线路或车站</p>
            )}
          </div>

          <div className="md:col-span-5 overflow-y-auto p-4 bg-paper-3/30 custom-scrollbar">
            {selectedStation ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-ink">{selectedStation.name}</h4>
                    <span className="font-mono text-[10px] text-ink-3">
                      {selectedStation.lat.toFixed(3)}, {selectedStation.lon.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">{selectedStation.desc}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStation?.(selectedStation);
                      onClose?.();
                    }}
                    className="mt-3 w-full py-2 rounded-xl bg-sora text-sora-ink text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-sora-deep transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" /> 在地图定位此站并看光影
                  </button>
                </div>

                <div className="pt-3 border-t border-line/70">
                  <div className="text-xs font-bold text-ink mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-sora" /> 附近 25km 我的收藏</span>
                    <span className="font-mono text-[10px] text-ink-3">{nearbyFavorites.length} 个</span>
                  </div>
                  {nearbyFavorites.length > 0 ? (
                    <div className="space-y-1.5">
                      {nearbyFavorites.map((pt) => {
                        const style = getIconStyle(pt.category, pt.source);
                        return (
                          <button
                            key={pt.id}
                            type="button"
                            onClick={() => {
                              onSelectFavorite?.(pt);
                              onClose?.();
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-xl bg-paper-2 border border-line/80 hover:border-sora/50 flex items-center justify-between gap-2 transition-colors"
                          >
                            <span className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                              <span>{style.icon}</span>
                              <span className="truncate">{pt.name}</span>
                            </span>
                            <span className="font-mono text-[11px] text-sora-deep shrink-0">
                              {pt.distanceKm.toFixed(1)} km
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-3 leading-relaxed">
                      该站周边 25km 内暂未匹配到收藏点位。导入 Google Maps 收藏或标记机位后会自动关联显示在这里。
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-4 text-ink-3">
                <Train className="w-7 h-7 mb-2 opacity-40" />
                <p className="text-xs font-bold text-ink-2">展开左侧任意线路并点选车站</p>
                <p className="text-[11px] mt-1">可一键飞到地图并自动列出该站 25km 内你的收藏点位与机位。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
