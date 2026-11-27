import { useMemo, useState } from 'react';
import { Ticket, Plus, Trash2, Compass, AlertTriangle, CheckCircle2, Sparkles, RotateCcw } from 'lucide-react';
import {
    PASS_SYSTEMS,
    evaluatePassComparison,
    buildLegsFromItinerary,
} from '../utils/railPassCalc';

const SYSTEM_LIST = [PASS_SYSTEMS.jp, PASS_SYSTEMS.eu];

const RailPassCalculator = ({ customPoints = [] }) => {
    const [systemId, setSystemId] = useState('jp');
    const [selectedPassId, setSelectedPassId] = useState(PASS_SYSTEMS.jp.passes[0].id);
    const [legs, setLegs] = useState([]);
    const [importNotice, setImportNotice] = useState('');

    const system = PASS_SYSTEMS[systemId] || PASS_SYSTEMS.jp;
    const selectedPass = useMemo(
        () => system.passes.find((p) => p.id === selectedPassId) || system.passes[0],
        [system, selectedPassId]
    );

    const comparison = useMemo(
        () => evaluatePassComparison(selectedPass, legs),
        [selectedPass, legs]
    );

    const handleSwitchSystem = (nextId) => {
        if (nextId === systemId) return;
        const nextSys = PASS_SYSTEMS[nextId] || PASS_SYSTEMS.jp;
        setSystemId(nextSys.id);
        setSelectedPassId(nextSys.passes[0].id);
        setLegs([]);
        setImportNotice('');
    };

    const handleAddPreset = (preset) => {
        setImportNotice('');
        setLegs((prev) => {
            const existing = prev.find((l) => l.presetId === preset.id);
            if (existing) {
                return prev.map((l) =>
                    l.presetId === preset.id ? { ...l, count: Math.min(10, l.count + 1) } : l
                );
            }
            return [
                ...prev,
                {
                    id: `leg_${preset.id}_${Date.now()}`,
                    presetId: preset.id,
                    label: preset.label,
                    fare: preset.fare,
                    count: 1,
                },
            ];
        });
    };

    const handleAddCustomLeg = () => {
        setImportNotice('');
        setLegs((prev) => [
            ...prev,
            {
                id: `custom_${Date.now()}_${prev.length}`,
                label: systemId === 'jp' ? '自定义区间（例：京都 ↔ 金泽）' : '自定义区间（例：巴黎 ↔ 里昂）',
                fare: systemId === 'jp' ? 7000 : 75,
                count: 1,
            },
        ]);
    };

    const handleImportFromItinerary = () => {
        const imported = buildLegsFromItinerary(customPoints, systemId);
        if (imported.length === 0) {
            setImportNotice('行程中暂未检测到 ≥5 km 的铁道跨城段。请先在「收藏与导入 → 行程按天编排」中安排站点，或直接点击下方热门线路快速添加。');
            return;
        }
        setLegs(imported);
        setImportNotice(`已从当前行程导入 ${imported.length} 段跨城铁道并按距离预填参考票价，可在下方逐项微调。`);
    };

    const handleUpdateLeg = (id, patch) => {
        setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    };

    const handleRemoveLeg = (id) => {
        setLegs((prev) => prev.filter((l) => l.id !== id));
    };

    const fmtMoney = (val) => `${system.symbol}${Math.round(val).toLocaleString()}`;
    const progressWidth = Math.min(100, Math.max(0, comparison.ratio));

    return (
        <div className="space-y-5">
            {/* 顶部体系切换与定位声明 */}
            <section className="bg-paper-2/92 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-display text-2xl text-ink flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-sora" />
                            铁路通票回本估算器
                        </h3>
                        <p className="text-xs text-ink-3 mt-1">
                            聚焦规则最清晰、最常被问到的日本 JR 与欧洲 Eurail：参考价预填 + 手动微调，快速判断是否值得买通票。
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink bg-kouchou-soft/75 border border-kouchou/35 px-3 py-1.5 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5 text-kouchou" />
                        参考估算 · 不含早鸟折扣与订座费
                    </span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {SYSTEM_LIST.map((sys) => {
                        const active = sys.id === systemId;
                        return (
                            <button
                                key={sys.id}
                                type="button"
                                onClick={() => handleSwitchSystem(sys.id)}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                    active
                                        ? 'bg-sora text-sora-ink border-sora shadow-sm'
                                        : 'bg-paper-3/70 text-ink-2 border-line/80 hover:bg-sora-soft/50 hover:text-ink'
                                }`}
                            >
                                <span aria-hidden="true">{sys.icon}</span>
                                <span>{sys.name}</span>
                                <span className={`font-mono text-[10px] ${active ? 'opacity-85' : 'text-ink-3'}`}>
                                    ({sys.currency})
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* 主体双栏：左选通票，右配区段并实时核算 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* 左栏：通票档位列表 */}
                <section className="lg:col-span-5 bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-ink">1. 选择待评估通票</h4>
                        <span className="text-[11px] text-ink-3">{system.passes.length} 种主流券</span>
                    </div>
                    <div className="space-y-2">
                        {system.passes.map((pass) => {
                            const active = pass.id === selectedPass.id;
                            return (
                                <button
                                    key={pass.id}
                                    type="button"
                                    onClick={() => setSelectedPassId(pass.id)}
                                    className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                                        active
                                            ? 'bg-sora-soft/75 border-sora shadow-sm'
                                            : 'bg-paper-3/60 border-line/80 hover:border-sora/40 hover:bg-sora-soft/30'
                                    }`}
                                >
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-xs font-black text-ink">{pass.name}</span>
                                        <span className="tnum font-mono text-sm font-black text-sora-deep shrink-0">
                                            {fmtMoney(pass.price)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-ink-3 mt-1 leading-relaxed">
                                        {pass.scope}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 右栏：实时对比结论 + 区段编辑 + 热门线路预填 */}
                <div className="lg:col-span-7 space-y-5">
                    {/* 结论对比卡 */}
                    <section className="bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-sora" />
                                实时回本测算 · {selectedPass.name}
                            </h4>
                            <span className="tnum font-mono text-xs font-bold text-ink-3">
                                回本进度 {comparison.ratio}%
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-2xl bg-paper-3/75 border border-line/70">
                                <div className="text-[11px] text-ink-3 font-bold">单程参考合计</div>
                                <div className="tnum font-mono text-lg font-black text-ink mt-0.5">
                                    {fmtMoney(comparison.singleTotal)}
                                </div>
                            </div>
                            <div className="p-3 rounded-2xl bg-paper-3/75 border border-line/70">
                                <div className="text-[11px] text-ink-3 font-bold">通票参考价</div>
                                <div className="tnum font-mono text-lg font-black text-sora-deep mt-0.5">
                                    {fmtMoney(comparison.passPrice)}
                                </div>
                            </div>
                            <div
                                className={`p-3 rounded-2xl border ${
                                    comparison.singleTotal === 0
                                        ? 'bg-paper-3/75 border-line/70'
                                        : comparison.worthwhile
                                        ? 'bg-wakaba-soft/65 border-wakaba/40'
                                        : 'bg-koi-soft/55 border-koi/35'
                                }`}
                            >
                                <div className="text-[11px] text-ink-3 font-bold">
                                    {comparison.singleTotal === 0
                                        ? '差额'
                                        : comparison.worthwhile
                                        ? '通票预计可省'
                                        : '单买预计更省'}
                                </div>
                                <div
                                    className={`tnum font-mono text-lg font-black mt-0.5 ${
                                        comparison.singleTotal === 0
                                            ? 'text-ink-3'
                                            : comparison.worthwhile
                                            ? 'text-wakaba'
                                            : 'text-koi'
                                    }`}
                                >
                                    {comparison.singleTotal === 0
                                        ? '--'
                                        : comparison.worthwhile
                                        ? `+${fmtMoney(comparison.savings)}`
                                        : `-${fmtMoney(comparison.loss)}`}
                                </div>
                            </div>
                        </div>

                        {/* 回本进度条 */}
                        <div className="space-y-1.5">
                            <div className="h-2.5 rounded-full bg-paper-3 overflow-hidden border border-line/70">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        comparison.worthwhile ? 'bg-wakaba' : 'bg-sora'
                                    }`}
                                    style={{ width: `${progressWidth}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-ink">
                                {comparison.singleTotal > 0 && comparison.worthwhile ? (
                                    <CheckCircle2 className="w-4 h-4 text-wakaba shrink-0" />
                                ) : (
                                    <Ticket className="w-4 h-4 text-sora shrink-0" />
                                )}
                                <span>{comparison.verdict}</span>
                            </div>
                        </div>
                    </section>

                    {/* 区段编排与快速添加 */}
                    <section className="bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-ink">2. 添加计划搭乘的铁道区段</h4>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleImportFromItinerary}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-wakaba-soft text-ink border border-wakaba/40 hover:border-wakaba transition-colors"
                                    title="从「收藏与导入 → 行程按天编排」读取相邻跨城站点并按距离估算票价"
                                >
                                    <Compass className="w-3.5 h-3.5 text-wakaba" />
                                    从行程导入区段
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddCustomLeg}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-sora-soft/80 text-sora-deep border border-sora/30 hover:bg-sora-soft transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    手动加一段
                                </button>
                                {legs.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => { setLegs([]); setImportNotice(''); }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-ink-3 hover:text-koi hover:bg-koi-soft/60 transition-colors"
                                        title="清空所有区段"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        清空
                                    </button>
                                )}
                            </div>
                        </div>

                        {importNotice && (
                            <div className="px-3.5 py-2.5 rounded-2xl bg-sora-soft/55 border border-sora/25 text-xs text-ink-2">
                                {importNotice}
                            </div>
                        )}

                        {/* 已添加区段列表（支持直接改名、改单程价、切单程/往返） */}
                        {legs.length > 0 ? (
                            <div className="space-y-2">
                                {legs.map((leg) => (
                                    <div
                                        key={leg.id}
                                        className="p-3 rounded-2xl bg-paper-3/70 border border-line/80 flex flex-col sm:flex-row sm:items-center gap-2.5"
                                    >
                                        <input
                                            type="text"
                                            value={leg.label}
                                            onChange={(e) => handleUpdateLeg(leg.id, { label: e.target.value })}
                                            aria-label="区段名称"
                                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-paper-2 border border-line/80 text-xs font-bold text-ink focus:outline-none focus:border-sora"
                                        />
                                        <div className="flex items-center gap-2 shrink-0">
                                            <label className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-paper-2 border border-line/80 text-xs font-mono">
                                                <span className="text-ink-3">{system.symbol}</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={system.roundStep}
                                                    value={leg.fare}
                                                    onChange={(e) =>
                                                        handleUpdateLeg(leg.id, {
                                                            fare: Math.max(0, Number(e.target.value) || 0),
                                                        })
                                                    }
                                                    aria-label="单程参考票价"
                                                    className="w-20 bg-transparent text-ink font-bold focus:outline-none tnum"
                                                />
                                            </label>

                                            <div className="inline-flex items-center rounded-lg border border-line/80 bg-paper-2 overflow-hidden text-xs font-bold">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateLeg(leg.id, { count: Math.max(1, leg.count - 1) })}
                                                    className="px-2 py-1 text-ink-2 hover:bg-paper-3 transition-colors"
                                                    aria-label="减少次数"
                                                >
                                                    −
                                                </button>
                                                <span className="px-2 py-1 font-mono text-[11px] text-ink min-w-[40px] text-center">
                                                    {leg.count === 1 ? '单程' : leg.count === 2 ? '往返' : `×${leg.count}`}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateLeg(leg.id, { count: Math.min(10, leg.count + 1) })}
                                                    className="px-2 py-1 text-ink-2 hover:bg-paper-3 transition-colors"
                                                    aria-label="增加次数"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <span className="tnum font-mono text-xs font-bold text-sora-deep min-w-[68px] text-right">
                                                {fmtMoney(leg.fare * leg.count)}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLeg(leg.id)}
                                                className="p-1.5 rounded-lg text-ink-3 hover:text-koi hover:bg-koi-soft/70 transition-colors"
                                                title="删除区段"
                                                aria-label="删除区段"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-5 rounded-2xl border border-dashed border-line text-center text-xs text-ink-3">
                                尚未添加搭乘区段：点击下方常见线路可一键填入（再点一次自动变为往返），也可点上方「从行程导入区段」。
                            </div>
                        )}

                        {/* 常见线路参考价快捷按钮 */}
                        <div className="pt-3 border-t border-line/70 space-y-2">
                            <div className="text-[11px] font-bold text-ink-3">
                                热门干线参考单程价（点击添加，再次点击累加次数）
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {system.presetLegs.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleAddPreset(preset)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-paper-3/75 hover:bg-sora-soft/60 border border-line/80 hover:border-sora/40 text-[11px] font-bold text-ink transition-colors"
                                    >
                                        <Plus className="w-3 h-3 text-sora shrink-0" />
                                        <span>{preset.label}</span>
                                        <span className="tnum font-mono text-ink-3">{fmtMoney(preset.fare)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* 明确免责与口径声明 */}
                    <div className="p-4 rounded-2xl bg-kouchou-soft/45 border border-kouchou/30 flex items-start gap-2.5 text-[11px] text-ink-2 leading-relaxed">
                        <AlertTriangle className="w-4 h-4 text-kouchou shrink-0 mt-0.5" />
                        <div>
                            <strong className="text-ink">参考估算说明：</strong>
                            本工具仅按常规标准二等座/普通指定席参考价做回本方向判断，<strong>不含早鸟折扣（如 SmartEX / 欧铁早鸟票）、淡旺季浮动及强制订座费（如欧洲 Eurostar / TGV / 冰川快车或日本希望号特例加价）</strong>。最终购票请以 JR / Eurail 官网当日牌价与规则为准。
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RailPassCalculator;
