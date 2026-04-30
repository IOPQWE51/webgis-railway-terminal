import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ArrowRightLeft, AlertCircle, ShoppingBag, Info, Search, X, Globe } from 'lucide-react';

// =====================================================================
// [全局配置] 常驻核心货币与 CPI 数据库
// =====================================================================
const CURRENCY_CONFIG = {
    JPY: { code: 'JPY', name: '日元', flag: 'jp', symbol: '¥', cpi: [{ icon: '🍜', label: '一碗拉面', price: '800 - 1000 日元' }, { icon: '🏨', label: '商务酒店(晚)', price: '8000 - 12000 日元' }, { icon: '🚇', label: '地铁单程', price: '200 日元起' }] },
    USD: { code: 'USD', name: '美元', flag: 'us', symbol: '$', cpi: [{ icon: '🍔', label: '快餐套餐', price: '$10 - $15' }, { icon: '🏨', label: '普通酒店(晚)', price: '$120 - $200' }, { icon: '☕', label: '星巴克咖啡', price: '$5' }] },
    EUR: { code: 'EUR', name: '欧元', flag: 'eu', symbol: '€', cpi: [{ icon: '🥐', label: '咖啡+可颂', price: '€5 - €8' }, { icon: '🏨', label: '快捷酒店(晚)', price: '€80 - €120' }, { icon: '🚆', label: '城市交通', price: '€2 - €3' }] },
    KRW: { code: 'KRW', name: '韩元', flag: 'kr', symbol: '₩', cpi: [{ icon: '🍲', label: '拌饭/烤肉单人', price: '10,000 韩元' }, { icon: '🏨', label: '经济酒店(晚)', price: '60,000 韩元' }, { icon: '🚌', label: '公交单程', price: '1,400 韩元' }] },
    HKD: { code: 'HKD', name: '港币', flag: 'hk', symbol: 'HK$', cpi: [{ icon: '🍜', label: '茶餐厅单人', price: 'HK$50 - HK$80' }, { icon: '🏨', label: '经济酒店(晚)', price: 'HK$600 - HK$1000' }, { icon: '🚇', label: '港铁单程', price: 'HK$10 起' }] },
    GBP: { code: 'GBP', name: '英镑', flag: 'gb', symbol: '£', cpi: [{ icon: '🐟', label: '炸鱼薯条', price: '£12 - £15' }, { icon: '🏨', label: '普通酒店(晚)', price: '£100 - £150' }, { icon: '🚇', label: '伦敦地铁', price: '£2.5 起' }] },
    THB: { code: 'THB', name: '泰铢', flag: 'th', symbol: '฿', cpi: [{ icon: '🍜', label: '街边炒粉', price: '50 - 80 泰铢' }, { icon: '🏨', label: '舒适酒店(晚)', price: '1000 泰铢' }, { icon: '💆', label: '马杀鸡(1小时)', price: '300 泰铢' }] }
};

// =====================================================================
// [扩展配置] 隐藏的全球货币库 (供搜索使用)
// =====================================================================
const EXTENDED_CURRENCIES = {
    AUD: { code: 'AUD', name: '澳元', country: '澳大利亚', flag: 'au', symbol: 'A$' },
    CAD: { code: 'CAD', name: '加元', country: '加拿大', flag: 'ca', symbol: 'C$' },
    SGD: { code: 'SGD', name: '新加坡元', country: '新加坡', flag: 'sg', symbol: 'S$' },
    CHF: { code: 'CHF', name: '瑞郎', country: '瑞士', flag: 'ch', symbol: 'CHF' },
    NZD: { code: 'NZD', name: '新西兰元', country: '新西兰', flag: 'nz', symbol: 'NZ$' },
    MYR: { code: 'MYR', name: '林吉特', country: '马来西亚', flag: 'my', symbol: 'RM' },
    IDR: { code: 'IDR', name: '印尼盾', country: '印度尼西亚', flag: 'id', symbol: 'Rp' },
    PHP: { code: 'PHP', name: '比索', country: '菲律宾', flag: 'ph', symbol: '₱' },
    VND: { code: 'VND', name: '越南盾', country: '越南', flag: 'vn', symbol: '₫' },
    INR: { code: 'INR', name: '卢比', country: '印度', flag: 'in', symbol: '₹' },
    RUB: { code: 'RUB', name: '卢布', country: '俄罗斯', flag: 'ru', symbol: '₽' },
    BRL: { code: 'BRL', name: '雷亚尔', country: '巴西', flag: 'br', symbol: 'R$' },
    ZAR: { code: 'ZAR', name: '兰特', country: '南非', flag: 'za', symbol: 'R' },
    AED: { code: 'AED', name: '迪拉姆', country: '阿联酋', flag: 'ae', symbol: 'د.إ' },
    TWD: { code: 'TWD', name: '新台币', country: '中国台湾', flag: 'tw', symbol: 'NT$' },
    MOP: { code: 'MOP', name: '澳门元', country: '中国澳门', flag: 'mo', symbol: 'MOP$' },
    SAR: { code: 'SAR', name: '里亚尔', country: '沙特阿拉伯', flag: 'sa', symbol: '﷼' },
    MXN: { code: 'MXN', name: '比索', country: '墨西哥', flag: 'mx', symbol: '$' },
    SEK: { code: 'SEK', name: '克朗', country: '瑞典', flag: 'se', symbol: 'kr' },
    TRY: { code: 'TRY', name: '里拉', country: '土耳其', flag: 'tr', symbol: '₺' }
};

/** 汇率 API 服务 */
const exchangeRateService = {
    async fetchRatesBaseCNY() {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/CNY');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.rates;
        } catch (error) {
            console.error("汇率获取失败", error);
            throw error;
        }
    }
};

const formatTime = (date) => [
    date.getHours().toString().padStart(2, '0'),
    date.getMinutes().toString().padStart(2, '0'),
    date.getSeconds().toString().padStart(2, '0')
].join(':');

const ExchangeEngine = ({ isActive }) => {
    const [rates, setRates] = useState({});
    const [targetCurrency, setTargetCurrency] = useState('JPY');
    
    const [cnyAmount, setCnyAmount] = useState('1000');
    const [targetAmount, setTargetAmount] = useState('');
    
    // 控制搜索模态框的状态
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [isFetching, setIsFetching] = useState(false);
    const [lastUpdate, setLastUpdate] = useState('');
    const [error, setError] = useState(null);

    const fetchRates = useCallback(async () => {
        setIsFetching(true);
        setError(null);
        try {
            const newRates = await exchangeRateService.fetchRatesBaseCNY();
            setRates(newRates);
            setLastUpdate(formatTime(new Date()));
            // 汇率刷新后，以人民币为基准重算外币金额
            const currentCny = cnyAmountRef.current;
            const currentTarget = targetCurrencyRef.current;
            if (currentCny && newRates[currentTarget]) {
                const num = parseFloat(currentCny);
                if (!isNaN(num)) setTargetAmount((num * newRates[currentTarget]).toFixed(2));
            }
        } catch (_err) {
            setError('汇率网络连接失败，请检查网络后重试');
        } finally {
            setIsFetching(false);
        }
    }, []);

    // 追踪最新值用于 fetchRates 中的汇率刷新重算（避免 useEffect 反馈回路）
    const cnyAmountRef = useRef(cnyAmount);
    cnyAmountRef.current = cnyAmount;
    const targetCurrencyRef = useRef(targetCurrency);
    targetCurrencyRef.current = targetCurrency;

    useEffect(() => { fetchRates(); }, [fetchRates]);

    const handleCnyChange = useCallback((e) => {
        const val = e.target.value;
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
            setCnyAmount(val);
            if (val === '' || !rates[targetCurrency]) setTargetAmount('');
            else {
                const num = parseFloat(val);
                if (!isNaN(num)) setTargetAmount((num * rates[targetCurrency]).toFixed(2));
            }
        }
    }, [rates, targetCurrency]);

    const handleTargetAmountChange = useCallback((e) => {
        const val = e.target.value;
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
            setTargetAmount(val);
            if (val === '' || !rates[targetCurrency]) setCnyAmount('');
            else {
                const num = parseFloat(val);
                if (!isNaN(num)) setCnyAmount((num / rates[targetCurrency]).toFixed(2));
            }
        }
    }, [rates, targetCurrency]);

    /** 处理下拉菜单的选择 */
    const handleCurrencySelect = useCallback((e) => {
        const newCurrency = e.target.value;
        
        // 如果点击的是“其他货币”选项，弹出搜索框，打断常规赋值
        if (newCurrency === 'SEARCH_OTHER') {
            setShowSearchModal(true);
            return;
        }
        
        setTargetCurrency(newCurrency);
        if (cnyAmount && rates[newCurrency]) {
            const num = parseFloat(cnyAmount);
            if (!isNaN(num)) setTargetAmount((num * rates[newCurrency]).toFixed(2));
        }
    }, [cnyAmount, rates]);

    /** 在搜索框中选中了扩展货币 */
    const selectExtendedCurrency = (code) => {
        setTargetCurrency(code);
        setShowSearchModal(false);
        setSearchQuery(''); // 清空搜索记录
        if (cnyAmount && rates[code]) {
            const num = parseFloat(cnyAmount);
            if (!isNaN(num)) setTargetAmount((num * rates[code]).toFixed(2));
        }
    };

    // 智能合并当前激活的配置（核心库 or 扩展库）
    const activeConfig = CURRENCY_CONFIG[targetCurrency] || EXTENDED_CURRENCIES[targetCurrency];
    const currentRate = rates[targetCurrency] || 0;

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500 max-w-3xl mx-auto relative`}>
            
            {/* ================= 搜索模态框 (Modal) ================= */}
            {showSearchModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <h3 className="font-black text-gray-800 flex items-center text-lg">
                                <Globe className="w-5 h-5 mr-2 text-blue-500" />
                                搜索全球货币
                            </h3>
                            <button onClick={() => setShowSearchModal(false)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-gray-100 shadow-sm relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-8 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                autoFocus
                                placeholder="输入国家或地区名称 (如: 澳大利亚、越南)..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-100/80 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
                            {Object.values(EXTENDED_CURRENCIES).filter(c => 
                                c.country.includes(searchQuery) || 
                                c.name.includes(searchQuery) || 
                                c.code.toLowerCase().includes(searchQuery.toLowerCase())
                            ).map(c => (
                                <button 
                                    key={c.code}
                                    onClick={() => selectExtendedCurrency(c.code)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50/60 rounded-xl transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center">
                                        <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt={c.code} className="h-5 w-7 object-cover rounded shadow-sm mr-3" />
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">{c.country}</div>
                                            <div className="text-xs font-bold text-gray-400">{c.name} ({c.code})</div>
                                        </div>
                                    </div>
                                    <span className="text-blue-500 font-mono text-sm opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">{c.symbol}</span>
                                </button>
                            ))}
                            {Object.values(EXTENDED_CURRENCIES).filter(c => c.country.includes(searchQuery) || c.name.includes(searchQuery) || c.code.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                <div className="text-center py-10 flex flex-col items-center justify-center text-gray-400">
                                    <Search className="w-8 h-8 mb-2 opacity-50" />
                                    <span className="text-sm font-bold">未找到相关国家或货币</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* ======================================================= */}

            <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="font-black text-2xl text-gray-900 flex items-center">
                            <ShoppingBag className="w-6 h-6 mr-2 text-blue-600" />
                            跨国结算与物价中枢
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest uppercase">Global Exchange Engine</p>
                    </div>
                    <button 
                        onClick={fetchRates} 
                        disabled={isFetching} 
                        className={`p-3 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-all shadow-sm border border-gray-100 ${isFetching ? 'animate-spin text-blue-500 border-blue-200' : 'hover:rotate-180 hover:text-blue-600'}`}
                        title="刷新实时汇率"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-center font-bold">
                        <AlertCircle className="w-5 h-5 mr-2" /> {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    <div className="bg-green-50 p-6 rounded-2xl border-2 border-transparent focus-within:border-green-500 transition-colors shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-bold text-green-800 flex items-center">
                                <img src="https://flagcdn.com/w40/cn.png" alt="CN" className="h-4 w-6 object-cover rounded-sm mr-2 shadow-sm" /> 人民币 (CNY)
                            </label>
                            <span className="text-[10px] font-mono bg-green-200 text-green-800 px-2 py-0.5 rounded uppercase font-bold">Base</span>
                        </div>
                        <div className="flex items-center text-4xl font-black text-green-900">
                            <span className="text-green-600/50 mr-2">¥</span>
                            <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={cnyAmount} onChange={handleCnyChange} className="bg-transparent border-none outline-none w-full appearance-none placeholder-green-300" placeholder="0" />
                        </div>
                    </div>

                    <div className="flex justify-center py-2 md:py-0">
                        <div className="bg-white rounded-full p-3 border-2 border-gray-100 shadow-lg z-10 relative">
                            <ArrowRightLeft className="w-6 h-6 text-blue-500 rotate-90 md:rotate-0" />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-2xl border-2 border-transparent focus-within:border-blue-500 transition-colors shadow-inner">
                        <div className="flex justify-between items-center mb-4 relative">
                            <div className="flex items-center">
                                <img src={`https://flagcdn.com/w40/${activeConfig.flag}.png`} alt={activeConfig.code} className="h-4 w-6 object-cover rounded-sm mr-2 shadow-sm" />
                                <select 
                                    value={targetCurrency} 
                                    onChange={handleCurrencySelect}
                                    className="bg-transparent text-sm font-bold text-blue-900 outline-none cursor-pointer appearance-none pr-4"
                                >
                                    {Object.keys(CURRENCY_CONFIG).map(code => (
                                        <option key={code} value={code}>{CURRENCY_CONFIG[code].name} ({code})</option>
                                    ))}
                                    {/* 如果当前选中的是扩展货币，为了能在select框内正确显示，临时把它加进来 */}
                                    {EXTENDED_CURRENCIES[targetCurrency] && (
                                        <option value={targetCurrency}>{EXTENDED_CURRENCIES[targetCurrency].country} - {EXTENDED_CURRENCIES[targetCurrency].name} ({targetCurrency})</option>
                                    )}
                                    <option disabled>──────────</option>
                                    <option value="SEARCH_OTHER">🔍 其他货币 (按国家搜索)...</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center text-4xl font-black text-blue-900">
                            <span className="text-blue-400 mr-2">{activeConfig.symbol}</span>
                            <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={targetAmount} onChange={handleTargetAmountChange} className="bg-transparent border-none outline-none w-full appearance-none placeholder-blue-300" placeholder="0" />
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                        <Info className="w-4 h-4 mr-2 text-blue-500" />
                        {activeConfig.country || activeConfig.name} 当地物价参考 (CPI)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 动态渲染：如果有配置好的CPI数据则显示，否则显示友好的缺省面板 */}
                        {activeConfig.cpi ? activeConfig.cpi.map((item, index) => (
                            <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start space-x-3">
                                <span className="text-2xl leading-none">{item.icon}</span>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold mb-1">{item.label}</p>
                                    <p className="text-sm font-black text-slate-800">{item.price}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full bg-slate-50 py-8 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
                                <Globe className="w-8 h-8 text-blue-200 mb-3" />
                                <p className="text-sm font-bold text-gray-500">已切换至 {activeConfig.country} 汇率轨道</p>
                                <p className="text-[11px] font-bold text-gray-400 mt-1">该地区暂未收录本地消费物价指数，但汇率引擎将保持实时计算。</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-between items-center text-[10px] font-mono text-gray-400 bg-gray-50 p-2 rounded-lg">
                    <span>
                        <strong className="text-gray-600">当前汇率：</strong> 
                        1 CNY = {currentRate.toFixed(4)} {targetCurrency} 
                        {currentRate > 0 && targetCurrency !== 'CNY' ? ` (100 ${targetCurrency} = ${(100 / currentRate).toFixed(2)} CNY)` : ''}
                    </span>
                    <span className="flex items-center">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isFetching ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></span>
                        SYNC: {lastUpdate || '--:--:--'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ExchangeEngine;