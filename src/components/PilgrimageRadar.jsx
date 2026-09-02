import { useEffect, useRef, useState } from 'react';
import {
  Camera, ExternalLink, HeartHandshake, MapPin, Search,
  ArrowLeft, Send, Layers, Loader2, AlertTriangle,
} from 'lucide-react';
import { PILGRIMAGE_PICKS } from '../config/pilgrimagePicks';
import {
  mapLiteToViewModel,
  mapPointCommon,
  mergePilgrimagePoints,
  toCustomPoint,
} from '../utils/pilgrimageData';

// ===== 数据访问（全走自家代理，见 api/anitabi.js / api/bangumi.js）=====
async function fetchLite(id) {
    const res = await fetch(`/api/anitabi?type=bangumi&id=${id}`);
    if (res.status === 404) throw new Error('NO_DATA');
    if (!res.ok) throw new Error('UPSTREAM');
    return mapLiteToViewModel(await res.json());
}

async function fetchAllPoints(id) {
    const res = await fetch(`/api/anitabi?type=points&id=${id}`);
    if (!res.ok) throw new Error('UPSTREAM');
    const raw = await res.json();
    return (Array.isArray(raw) ? raw : []).map(mapPointCommon);
}

async function searchBangumi(q) {
    const res = await fetch(`/api/bangumi?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('SEARCH_FAIL');
    const json = await res.json();
    return json.list || [];
}

const PilgrimageRadar = ({ isActive, customPoints = [], onPointsUpdate }) => {
    const [view, setView] = useState('discover'); // discover | detail
    const [selected, setSelected] = useState(null); // 详情卡视图模型
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(null); // null | 'NO_DATA' | 'UPSTREAM'

    const [pickCovers, setPickCovers] = useState({}); // { [id]: { cover, color } }
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null | []
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);

    const [allPoints, setAllPoints] = useState(null); // null=前10 | 数组=已加载全量
    const [loadingMore, setLoadingMore] = useState(false);
    const [pushFeedback, setPushFeedback] = useState(null); // { added, skipped, capped }

    const openSeqRef = useRef(0);      // 请求序号：丢弃过期响应，防慢请求覆盖新视图
    const [lastOpenedId, setLastOpenedId] = useState(null); // 供错误态"重试"使用

    // 精选墙封面预热（各自独立失败不互相拖垮；生产命中边缘缓存）
    useEffect(() => {
        PILGRIMAGE_PICKS.forEach((p) => {
            fetchLite(p.id)
                .then((vm) => setPickCovers((prev) => ({ ...prev, [p.id]: { cover: vm.cover, color: vm.color } })))
                .catch(() => {});
        });
    }, []);

    const openDetail = async (id) => {
        const seq = ++openSeqRef.current;
        setLastOpenedId(id);
        setView('detail');
        setDetailLoading(true);
        setDetailError(null);
        setAllPoints(null);
        setPushFeedback(null);
        setSearchResults(null);
        setLoadingMore(false);
        try {
            const vm = await fetchLite(id);
            if (seq !== openSeqRef.current) return; // 已被更新的点击取代
            setSelected(vm);
        } catch (e) {
            if (seq !== openSeqRef.current) return;
            setSelected(null);
            setDetailError(e.message === 'NO_DATA' ? 'NO_DATA' : 'UPSTREAM');
        } finally {
            if (seq === openSeqRef.current) setDetailLoading(false);
        }
    };

    const handleSearch = async () => {
        const q = searchQuery.trim();
        if (!q || searching) return;
        setSearching(true);
        setSearchError(false);
        try {
            setSearchResults(await searchBangumi(q));
        } catch {
            setSearchResults(null);
            setSearchError(true);
        } finally {
            setSearching(false);
        }
    };

    const loadAllPoints = async () => {
        if (!selected || loadingMore) return;
        const seq = openSeqRef.current;
        setLoadingMore(true);
        try {
            const pts = await fetchAllPoints(selected.id);
            if (seq !== openSeqRef.current) return; // 期间切换了番剧，丢弃
            setAllPoints(pts);
        } catch {
            // 全量加载失败保持前 10 展示，不打断
        } finally {
            if (seq === openSeqRef.current) setLoadingMore(false);
        }
    };

    // 执行变更注：Task 1 质量审查发现精选总量 2763 > 服务端 MAX_POINTS=2000
    //（api/validation.js 整库硬上限），故推送层增加容量守卫，超限部分计入反馈。
    const MAX_POINTS = 2000; // 与 api/validation.js 的 MAX_POINTS 对齐（整库硬上限）

    const pushPoints = (vmPoints) => {
        if (!selected || !onPointsUpdate) return;
        const incoming = vmPoints
            .filter((p) => p.lat !== null && p.lon !== null)
            .map((p) => toCustomPoint(selected.id, p));
        const capacity = Math.max(0, MAX_POINTS - customPoints.length);
        const capped = incoming.slice(0, capacity);
        const { merged, added, skipped } = mergePilgrimagePoints(customPoints, capped);
        if (added.length > 0) onPointsUpdate(merged);
        setPushFeedback({
            added: added.length,
            skipped,
            capped: incoming.length - capped.length,
        });
    };

    const displayedPoints = allPoints || selected?.points || [];

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto`}>
            <div className="bg-white border border-gray-200 rounded-[2rem] p-6 md:p-8 shadow-xl relative overflow-hidden">

                {/* ===== 标题栏 ===== */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="font-black text-2xl text-gray-900 flex items-center">
                            <Camera className="w-6 h-6 mr-2 text-pink-500" />
                            次元边界：圣地巡礼工作台
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest uppercase">Anime Pilgrimage Workbench</p>
                    </div>
                    {view === 'detail' && (
                        <button
                            onClick={() => { setView('discover'); setSelected(null); setSearchResults(null); }}
                            className="flex items-center text-sm font-bold text-gray-600 hover:text-pink-600 transition-colors active:scale-95"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" /> 返回发现区
                        </button>
                    )}
                </div>

                {view === 'discover' && (
                    <>
                        {/* ===== 搜索 ===== */}
                        <div className="flex gap-2 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="搜索番剧名（如：孤独摇滚、摇曳露营）"
                                    className="w-full pl-9 pr-3 py-2.5 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition-all"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={searching || !searchQuery.trim()}
                                className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold px-5 rounded-xl shadow-md transition-all active:scale-95 flex items-center"
                            >
                                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : '检索'}
                            </button>
                        </div>

                        {searchError && (
                            <div className="mb-6 flex items-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                                搜索服务暂时不可用（本地网络可能无法访问 Bangumi，部署到 Vercel 后正常），请稍后重试。
                            </div>
                        )}
                        {searchResults && searchResults.length === 0 && (
                            <div className="mb-6 text-sm text-gray-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                没有找到相关动画条目，换个关键词试试。
                            </div>
                        )}
                        {searchResults && searchResults.length > 0 && (
                            <div className="mb-8">
                                <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">Search Results</p>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {searchResults.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => openDetail(s.id)}
                                            className="shrink-0 w-32 text-left group"
                                        >
                                            <div className="w-32 h-44 rounded-xl overflow-hidden border border-slate-200 shadow-sm group-hover:border-pink-300 group-hover:shadow-lg transition-all bg-slate-100">
                                                {s.cover ? (
                                                    <img src={s.cover} alt={s.titleCn} loading="lazy" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-3xl">🌸</div>
                                                )}
                                            </div>
                                            <p className="mt-1.5 text-xs font-bold text-gray-800 truncate">{s.titleCn}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">{s.date} · {s.titleOriginal || '动画'}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ===== 精选番剧墙 ===== */}
                        <div className="mb-8">
                            <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">Featured Pilgrimage · 精选巡礼</p>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {PILGRIMAGE_PICKS.map((p) => {
                                    const meta = pickCovers[p.id];
                                    return (
                                        <button key={p.id} onClick={() => openDetail(p.id)} className="shrink-0 w-40 text-left group">
                                            <div
                                                className="w-40 h-56 rounded-xl overflow-hidden border border-slate-200 shadow-sm group-hover:border-pink-300 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all"
                                                style={!meta ? { background: `linear-gradient(135deg, ${p.color}22, ${p.color}55)` } : undefined}
                                            >
                                                {meta?.cover ? (
                                                    <img src={meta.cover} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                                        <Camera className="w-8 h-8 opacity-40" style={{ color: p.color }} />
                                                        <span className="text-[10px] font-bold text-gray-500">巡礼加载中…</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-1.5 text-sm font-black text-gray-900 truncate">{p.name}</p>
                                            <p className="text-[10px] text-gray-500 font-bold flex items-center">
                                                <MapPin className="w-3 h-3 mr-0.5 text-pink-500" />{p.city} · {p.points} 圣地
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {view === 'detail' && (
                    <>
                        {detailLoading && (
                            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin text-pink-400 mb-3" />
                                <p className="text-sm font-bold">正在跨越次元边界…</p>
                            </div>
                        )}

                        {!detailLoading && detailError === 'NO_DATA' && (
                            <div className="py-12 text-center border border-dashed border-slate-300 rounded-2xl mb-6">
                                <p className="text-4xl mb-3">🗺️</p>
                                <p className="font-bold text-gray-700 mb-1">该作品暂无巡礼数据</p>
                                <p className="text-xs text-gray-400 mb-4">anitabi 还没有收录这部作品的圣地坐标</p>
                                <a href="https://anitabi.cn/map" target="_blank" rel="noreferrer"
                                    className="inline-flex items-center text-sm font-bold text-pink-600 hover:text-pink-700">
                                    去 anitabi 官方地图看看 <ExternalLink className="w-3.5 h-3.5 ml-1" />
                                </a>
                            </div>
                        )}

                        {!detailLoading && detailError === 'UPSTREAM' && (
                            <div className="py-12 text-center border border-dashed border-red-200 bg-red-50/50 rounded-2xl mb-6">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
                                <p className="font-bold text-gray-700 mb-4">巡礼数据加载失败</p>
                                <button
                                    onClick={() => lastOpenedId && openDetail(lastOpenedId)}
                                    className="bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold py-2 px-5 rounded-xl transition-all active:scale-95"
                                >
                                    重试
                                </button>
                            </div>
                        )}

                        {!detailLoading && selected && (
                            <>
                                {/* ===== 番剧头卡（主题色渐变） ===== */}
                                <div className="relative rounded-2xl overflow-hidden border border-slate-200 mb-5">
                                    <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${selected.color}26, transparent 60%)` }} />
                                    <div className="relative flex gap-4 p-4">
                                        <div className="shrink-0 w-28 h-40 rounded-xl overflow-hidden shadow-md bg-slate-100">
                                            {selected.cover ? (
                                                <img src={selected.cover} alt={selected.titleCn} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-4xl">🌸</div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1 py-1">
                                            <h4 className="font-black text-lg text-gray-900 leading-snug">{selected.titleCn}</h4>
                                            {selected.titleOriginal && <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{selected.titleOriginal}</p>}
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {selected.city && (
                                                    <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2.5 py-1 rounded-lg flex items-center">
                                                        <MapPin className="w-3 h-3 mr-1" />{selected.city}
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                    📍 {selected.pointsLength} 巡礼点
                                                </span>
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                    🖼️ {selected.imagesLength} 截图
                                                </span>
                                            </div>
                                            <a href={selected.mapUrl} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center mt-3 text-xs font-bold text-gray-500 hover:text-pink-600 transition-colors">
                                                anitabi 官方巡礼地图 <ExternalLink className="w-3 h-3 ml-1" />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${selected.color}, ${selected.color}44)` }} />
                                </div>

                                {/* ===== 推送控制条 ===== */}
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">
                                        Sacred Spots · 已加载 {displayedPoints.length} / {selected.pointsLength}
                                    </p>
                                    <button
                                        onClick={() => pushPoints(displayedPoints)}
                                        className="bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold py-2 px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center"
                                    >
                                        <Send className="w-4 h-4 mr-1.5" /> 全部推送到战术地图
                                    </button>
                                </div>

                                {pushFeedback && (
                                    <div className="mb-4 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                                        ✅ 已推送 {pushFeedback.added} 个圣地到点位库{pushFeedback.skipped > 0 ? `，跳过 ${pushFeedback.skipped} 个重复` : ''}{pushFeedback.capped > 0 ? `；点位库已达 2000 上限，${pushFeedback.capped} 个未推送` : ''}。切换到「战术地图」页即可查看。
                                    </div>
                                )}

                                {/* ===== 圣地列表 ===== */}
                                <div className="space-y-2.5 mb-5">
                                    {displayedPoints.map((p) => (
                                        <div key={p.id} className="flex items-center gap-3 bg-slate-50 hover:bg-pink-50/50 border border-slate-200 hover:border-pink-200 rounded-xl px-3 py-2.5 transition-colors">
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} loading="lazy" className="shrink-0 w-14 h-14 rounded-lg object-cover border border-slate-200" />
                                            ) : (
                                                <div className="shrink-0 w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">🌸</div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                                                <p className="text-[11px] text-gray-500 font-medium truncate">
                                                    {p.nameOriginal && <span className="mr-1.5">{p.nameOriginal}</span>}
                                                    {p.ep !== null && <span className="mr-1.5 text-pink-600 font-bold">EP{p.ep}</span>}
                                                    {p.s !== null && <span className="mr-1.5 text-pink-600 font-bold">S{p.s}</span>}
                                                    <span className="font-mono">{p.lat?.toFixed(4)}, {p.lon?.toFixed(4)}</span>
                                                    {p.origin && (
                                                        <> · 截图 <a href={p.originURL || 'https://anitabi.cn/'} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-pink-600">{p.origin}</a></>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => pushPoints([p])}
                                                className="shrink-0 text-xs font-bold text-pink-600 bg-pink-100 hover:bg-pink-500 hover:text-white px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center"
                                            >
                                                <Send className="w-3 h-3 mr-1" />推送
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {allPoints === null && selected.pointsLength > selected.points.length && (
                                    <button
                                        onClick={loadAllPoints}
                                        disabled={loadingMore}
                                        className="w-full py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-[0.99] flex items-center justify-center"
                                    >
                                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Layers className="w-4 h-4 mr-1.5" />}
                                        查看全部 {selected.pointsLength} 个圣地
                                    </button>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ===== 巡礼生存法则 ===== */}
                <div className="border-t border-gray-100 pt-6 mt-8">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                        <HeartHandshake className="w-4 h-4 mr-2 text-rose-500" />
                        次元交汇法则 (巡礼潜规则)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-pink-200 transition-colors">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs mr-2">禁忌</span>
                                <span className="font-bold text-gray-900 text-sm">校园与住宅区的结界</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                绝大部分校园背景**禁止外部人员入内**。上课期间严禁在校门外徘徊拍照（极易被报警）。在住宅区取景时，请保持绝对安静，**绝对不可将相机镜头对准私人住宅的窗户或当地居民**。
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-pink-200 transition-colors">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs mr-2">守则</span>
                                <span className="font-bold text-gray-900 text-sm">微小的在地回馈</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                如果巡礼点在当地的神社、商店或自动贩卖机附近，尽可能在当地**消费一点点**（买瓶水、投个赛钱、买个护身符）。这能极大地改善当地居民对阿宅群体的包容度，保护圣地不被封闭。
                            </p>
                        </div>
                    </div>
                </div>

                {/* ===== 署名条（CC BY-NC-SA 4.0 许可证义务） ===== */}
                <p className="mt-6 pt-4 border-t border-gray-100 text-[11px] text-gray-400 font-medium">
                    圣地点位与截图数据 ©{' '}
                    <a href="https://www.anitabi.cn/" target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-pink-500">anitabi.cn 巡礼之途</a>
                    {' '}· CC BY-NC-SA 4.0
                </p>
            </div>
        </div>
    );
};

export default PilgrimageRadar;
