import { useState } from 'react';
import { Search, Loader2, Target } from 'lucide-react';
import { searchPlace } from '../utils/geocode';

const SearchNavEngine = ({ onLocationFound }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        // 允许回车或点击放大镜搜索
        if ((e.key === 'Enter' || e.type === 'click') && query.trim() !== '') {
            setIsSearching(true);
            const q = query.trim();
            try {
                // 🛰️ 统一链路：自有代理（Mapbox 服务端）→ Nominatim 兜底（见 utils/geocode.js）
                const located = await searchPlace(q);
                if (located) {
                    onLocationFound(located.lat, located.lon, located.displayName, located.shortName);
                    setQuery('');
                } else {
                    alert('未能找到该地点，请尝试更完整的名称（如：Paris、北京南站、Tokyo Station）');
                }
            } catch (_error) {
                alert('地点搜索服务暂时异常，请检查网络连接。');
            }
            setIsSearching(false);
        }
    };

    return (
        <div className="bg-zinc-900/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-zinc-700/50 group">
            <div className="relative flex flex-col gap-2">
                <div className="flex items-center justify-between text-cyan-400 font-bold text-xs tracking-wide mb-1">
                    <div className="flex items-center">
                        <Target className="w-3.5 h-3.5 mr-1.5" /> 全球地点搜索
                    </div>
                    <span className="text-zinc-500 font-mono text-[10px]">GLOBAL</span>
                </div>
                
                <div className="relative flex items-center bg-black/60 border border-zinc-700/30 rounded-xl overflow-hidden focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
                    <button onClick={handleSearch} aria-label="搜索地点" className="pl-3 text-zinc-500 hover:text-cyan-400 transition-colors">
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-cyan-500" /> : <Search className="w-4 h-4" />}
                    </button>
                    <input 
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="搜索全球城市、车站或地标..."
                        className="w-full bg-transparent text-sm text-white placeholder-zinc-500 py-2.5 px-3 outline-none"
                    />
                </div>
            </div>
        </div>
    );
};

export default SearchNavEngine;