import React, { useState } from 'react';
import { Calendar, MapPin, Sparkles, ExternalLink } from 'lucide-react';

// 本地模拟花火大会数据库（未来你可以写个脚本自动把 hanabi.cloud 的数据更新到这里）
const HANABI_DATA = [
    { id: 1, name: "长冈祭大花火大会", date: "2026-08-02", location: "新潟县长冈市信浓川河川敷", scale: "约20000发", status: "confirmed" },
    { id: 2, name: "大曲之花火 (全国花火竞技大会)", date: "2026-08-29", location: "秋田县大仙市雄物川河畔", scale: "约18000发", status: "confirmed" },
    { id: 3, name: "土浦全国花火竞技大会", date: "2026-11-07", location: "茨城县土浦市樱川畔", scale: "约20000发", status: "planned" },
    { id: 4, name: "隅田川花火大会", date: "2026-07-25", location: "东京都墨田区", scale: "约20000发", status: "confirmed" },
];

const HanabiRadar = ({ isActive }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredData = HANABI_DATA.filter(event => 
        event.name.includes(searchQuery) || event.location.includes(searchQuery)
    );

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto`}>
            <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
                
                {/* 模块标题 */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-black text-2xl text-gray-900 flex items-center">
                            <Sparkles className="w-6 h-6 mr-2 text-rose-500" />
                            花火情报局
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest uppercase">Hanabi Radar & Schedule</p>
                    </div>
                    <a 
                        href="https://hanabi.cloud/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center px-4 py-2 bg-rose-50 text-rose-600 rounded-full text-sm font-bold hover:bg-rose-100 transition-colors"
                    >
                        数据源: Hanabi.cloud <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                </div>

                {/* 搜索过滤框 */}
                <div className="mb-6">
                    <input 
                        type="text" 
                        placeholder="搜索花火大会名称或地点..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                    />
                </div>

                {/* 数据列表 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredData.map((event) => (
                        <div key={event.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 hover:border-rose-200 hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-3">
                                <h4 className="font-bold text-gray-900 text-lg group-hover:text-rose-600 transition-colors">{event.name}</h4>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${event.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {event.status === 'confirmed' ? '已定档' : '计划中'}
                                </span>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600 font-medium">
                                <p className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-gray-400" /> {event.date}</p>
                                <p className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-400" /> {event.location}</p>
                                <p className="flex items-center"><Sparkles className="w-4 h-4 mr-2 text-rose-400" /> {event.scale}</p>
                            </div>
                        </div>
                    ))}
                    {filteredData.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-400 font-bold">没有找到匹配的花火大会记录</div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default HanabiRadar;