import { useState } from 'react';
import { Search, Loader2, Crosshair } from 'lucide-react';
import { searchPlace } from '../utils/geocode';

const SearchNavEngine = ({ onLocationFound, onLocate, isLocating = false }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        if ((e.key === 'Enter' || e.type === 'click') && query.trim() !== '') {
            setIsSearching(true);
            const q = query.trim();
            try {
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
        <div className="flex items-center bg-paper-2/92 backdrop-blur-md rounded-2xl shadow-lift border border-line/90 focus-within:border-sora focus-within:ring-2 focus-within:ring-sora/20 transition-all overflow-hidden">
            <button
                type="button"
                onClick={handleSearch}
                aria-label="搜索地点"
                className="pl-3.5 pr-1 text-ink-3 hover:text-sora-deep transition-colors shrink-0"
            >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-sora" /> : <Search className="w-4 h-4" />}
            </button>
            <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="搜索全球城市、车站或地标..."
                className="w-full bg-transparent text-[13px] text-ink placeholder-ink-3 py-2.5 px-2 outline-none"
            />
            {onLocate && (
                <button
                    type="button"
                    onClick={onLocate}
                    disabled={isLocating}
                    title="定位到当前位置"
                    aria-label="定位到当前位置"
                    className="pr-3 pl-2.5 py-2 text-ink-2 hover:text-sora-deep border-l border-line/70 transition-colors shrink-0 disabled:opacity-50"
                >
                    {isLocating ? <Loader2 className="w-4 h-4 animate-spin text-sora" /> : <Crosshair className="w-4 h-4" />}
                </button>
            )}
        </div>
    );
};

export default SearchNavEngine;