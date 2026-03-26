import React, { useState } from 'react';
import { Search, Loader2, Target } from 'lucide-react';

const SearchNavEngine = ({ onLocationFound }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        if (e.key === 'Enter' && query.trim() !== '') {
            setIsSearching(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await res.json();
                
                if (data && data.length > 0) {
                    const { lat, lon, display_name } = data[0];
                    onLocationFound(parseFloat(lat), parseFloat(lon), display_name, query);
                    setQuery(''); 
                } else {
                    alert('终端未能锁定该地点的物理坐标，请更换搜索词。');
                }
            } catch (error) {
                alert('空间跃迁引擎暂时离线，请检查网络。');
            }
            setIsSearching(false);
        }
    };

    return (
        <div className="bg-zinc-900 rounded-2xl p-4 shadow-lg border border-zinc-800 relative overflow-hidden group">
            {/* 赛博朋克光效背景 */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500"></div>
            
            <div className="relative flex flex-col gap-2">
                <div className="flex items-center text-cyan-400 font-bold text-xs uppercase tracking-widest mb-1">
                    <Target className="w-4 h-4 mr-1.5" /> 空间跃迁引擎
                </div>
                
                <div className="relative flex items-center bg-black/50 border border-zinc-700/50 rounded-xl overflow-hidden focus-within:border-cyan-500 transition-colors">
                    <div className="pl-3 text-zinc-400">
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-cyan-500" /> : <Search className="w-4 h-4" />}
                    </div>
                    <input 
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="输入地名按回车锁定..."
                        className="w-full bg-transparent text-sm text-white font-mono placeholder-zinc-600 py-2.5 px-3 outline-none"
                    />
                    <div className="pr-2 hidden sm:block">
                        <span className="bg-zinc-800 text-zinc-500 text-[9px] px-1.5 py-0.5 rounded font-bold border border-zinc-700">↵</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchNavEngine;