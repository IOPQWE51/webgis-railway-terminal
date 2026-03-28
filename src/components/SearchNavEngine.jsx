import { useState } from 'react';
import { Search, Loader2, Target } from 'lucide-react';

const SearchNavEngine = ({ onLocationFound }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        // 允许回车或点击放大镜搜索
        if ((e.key === 'Enter' || e.type === 'click') && query.trim() !== '') {
            setIsSearching(true);
            try {
                // Nominatim API 需要明确的 User-Agent 描述（这里用 App 名称）
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
                    headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' }
                });
                const data = await res.json();
                
                if (data && data.length > 0) {
                    const { lat, lon, display_name } = data[0];
                    // 提取地名简称
                    const shortName = display_name.split(',')[0];
                    onLocationFound(parseFloat(lat), parseFloat(lon), display_name, shortName);
                    setQuery(''); 
                } else {
                    alert('🛰️ 空间卫星未能定位该区域，请尝试更精确的名称（如：Tokyo Station）');
                }
            } catch (_error) {
                alert('⚠️ 跃迁引擎链路异常，请检查网络连接。');
            }
            setIsSearching(false);
        }
    };

    return (
        <div className="bg-zinc-900/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-zinc-700/50 group">
            <div className="relative flex flex-col gap-2">
                <div className="flex items-center justify-between text-cyan-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                    <div className="flex items-center">
                        <Target className="w-3.5 h-3.5 mr-1.5 animate-pulse" /> 空间跃迁引擎
                    </div>
                    <span className="text-zinc-500 font-mono">NODE: 03-JP</span>
                </div>
                
                <div className="relative flex items-center bg-black/60 border border-zinc-700/30 rounded-xl overflow-hidden focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
                    <button onClick={handleSearch} className="pl-3 text-zinc-500 hover:text-cyan-400 transition-colors">
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-cyan-500" /> : <Search className="w-4 h-4" />}
                    </button>
                    <input 
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="输入目的地锁定经纬度..."
                        className="w-full bg-transparent text-sm text-white font-mono placeholder-zinc-600 py-2.5 px-3 outline-none"
                    />
                </div>
            </div>
        </div>
    );
};

export default SearchNavEngine;