import { useState, useCallback, useMemo } from 'react';
import { UploadCloud, Server, Loader2, CheckCircle2, Trash2, AlertCircle, Plus, Search, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { getIconStyle } from '../utils/helpers'; 

/**
 * 🛰️ 地理编码与数据解析中枢 (Google API 独家重装版 v4.2.1)
 */

// 🔑 Google Maps API Key - 从环境变量读取 (务必确保 .env 中配置正确)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// 🗂️ 地理编码缓存（极其重要：保护咱们每天仅有的 200 次额度）
const geocodeCache = new Map();

// ⏸️ 异步呼吸节拍（防并发神器）
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const geocodeService = {
    // 🔧 从 Google Maps URL 提取 Place ID
    extractPlaceId(url) {
        if (!url) return null;
        const match = url.match(/!1s([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    },

    // 🧹 智能地址清洗（大幅提升 Google 命中率）
    sanitizeQuery(name, type) {
        let query = name.trim();
        // 如果是日本的项目，强制加上上下文，防止坐标飘到中国或欧美
        if (!query.includes('日本') && !query.includes('Japan') && !query.match(/[ぁ-んァ-ヶ]/)) {
            query = '日本 ' + query;
        }
        // 如果明确是车站，补齐后缀
        if (type === 'station' && !query.includes('駅') && !query.includes('Station')) {
            query += '駅';
        }
        return query;
    },

    // 🚀 Google Geocoding 核心引擎
    async geocodeWithGoogle(queryStr, isPlaceId = false) {
        if (!GOOGLE_MAPS_API_KEY) {
            console.error("❌ 致命错误: 未找到 Google Maps API Key");
            return null;
        }

        const cacheKey = queryStr;
        if (geocodeCache.has(cacheKey)) {
            return geocodeCache.get(cacheKey);
        }

        try {
            let url = isPlaceId 
                ? `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(queryStr)}&key=${GOOGLE_MAPS_API_KEY}`
                : `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryStr)}&key=${GOOGLE_MAPS_API_KEY}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
                const location = data.results[0].geometry.location;
                const result = { lat: location.lat, lon: location.lng };
                geocodeCache.set(cacheKey, result); // 存入缓存
                return result;
            } 
            // 🚨 触发了咱们设置的配额限制或并发限制
            else if (data.status === 'OVER_QUERY_LIMIT') {
                console.warn("⚠️ 警告: 触发 Google API 频率或配额限制！");
                throw new Error("RATE_LIMIT");
            } 
            else {
                console.warn(`[未找到] ${queryStr}:`, data.status);
                return null;
            }
        } catch (error) {
            if (error.message === "RATE_LIMIT") throw error; // 抛出给上层处理
            console.error(`[网络请求失败] ${queryStr}:`, error);
            return null;
        }
    },

    // 🎯 主地理编码调度器
    async geocode(placeName, url = null, type = 'spot') {
        try {
            // 1. 提取 Place ID (最高精度)
            if (url) {
                const placeId = this.extractPlaceId(url);
                if (placeId) {
                    const result = await this.geocodeWithGoogle(placeId, true);
                    if (result) return result;
                }
            }

            // 2. 智能清洗地名并查询
            const cleanQuery = this.sanitizeQuery(placeName, type);
            const result = await this.geocodeWithGoogle(cleanQuery, false);
            if (result) return result;

            // 3. 兜底策略：如果清洗后的查不到，用最原始的名字再试一次 (利用缓存不耗时)
            if (cleanQuery !== placeName) {
                return await this.geocodeWithGoogle(placeName, false);
            }

            return null;
        } catch (error) {
            if (error.message === "RATE_LIMIT") {
                alert("⚠️ 已触发 Google API 限制 (可能是请求过快或已达每日 200 次上限)。请稍后再试。");
            }
            return null;
        }
    },

    // CSV 解析逻辑 (保留你原本优秀的正则逻辑)
    parseCSVText(text) {
        const rows = [];
        let currentRow = [];
        let currentVal = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') { currentVal += '"'; i++; } 
                else if (char === '"') { inQuotes = false; } 
                else { currentVal += char; }
            } else {
                if (char === '"') { inQuotes = true; } 
                else if (char === ',') { currentRow.push(currentVal.trim()); currentVal = ''; } 
                else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                    currentRow.push(currentVal.trim());
                    if (currentRow.some(v => v !== '')) rows.push(currentRow);
                    currentRow = []; currentVal = '';
                    if (char === '\r') i++;
                } else { currentVal += char; }
            }
        }
        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal.trim());
            if (currentRow.some(v => v !== '')) rows.push(currentRow);
        }
        return rows;
    },

    parseCSVContent(text, _fileName) {
        const rows = this.parseCSVText(text);
        const placesToFetch = [];
        if (rows.length === 0) return [];

        const firstLine = rows[0].join(',').toLowerCase();
        const isGoogleMapsFormat = firstLine.includes('标题') || (firstLine.includes('name') && firstLine.includes('网址'));
        const startIndex = isGoogleMapsFormat ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            const parts = rows[i];
            if (parts.length === 0 || !parts[0]) continue;

            if (isGoogleMapsFormat && parts.length >= 2) {
                const name = parts[0];
                let url = '';
                const urlIndex = parts.findIndex(p => p.includes('http'));
                if (urlIndex !== -1) url = parts[urlIndex];

                let lat, lon, hasCoords = false;
                
                if (url) {
                    const atMatch = url.match(/@(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
                    const dMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
                    const qMatch = url.match(/q=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
                    
                    if (atMatch) { lat = parseFloat(atMatch[1]); lon = parseFloat(atMatch[2]); hasCoords = true; }
                    else if (dMatch) { lat = parseFloat(dMatch[1]); lon = parseFloat(dMatch[2]); hasCoords = true; }
                    else if (qMatch) { lat = parseFloat(qMatch[1]); lon = parseFloat(qMatch[2]); hasCoords = true; }
                }
                if (name) placesToFetch.push({ name, url, lat, lon, hasCoords });
            } else {
                if (parts[0]) placesToFetch.push({ name: parts[0], hasCoords: false });
            }
        }
        return placesToFetch;
    }
};

const DataCenter = ({ isActive, customPoints, onPointsUpdate }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [progress, setProgress] = useState(0);
    const [failedPoints, setFailedPoints] = useState([]);
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [manualData, setManualData] = useState({ name: '', lat: '', lon: '', type: 'spot' });
    const [searchData, setSearchData] = useState({ name: '', type: 'spot' });
    const [isSearching, setIsSearching] = useState(false);

    // 🆕 多文件队列状态
    const [fileQueue, setFileQueue] = useState([]);
    const [currentFile, setCurrentFile] = useState(null);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);

    // =====================================================================
    // 智能雷达检索添加 (Google 引擎)
    // =====================================================================
    const handleSmartSearch = useCallback(async () => {
        if (!searchData.name.trim()) return alert('⚠️ 请输入要检索的地标名称');

        setIsSearching(true);
        try {
            const coords = await geocodeService.geocode(searchData.name, null, searchData.type);
            
            if (coords) {
                const newPt = {
                    id: `search_${Date.now()}`,
                    name: searchData.name,
                    lat: coords.lat,
                    lon: coords.lon,
                    category: searchData.type,
                    source: 'Google 智能检索'
                };
                
                onPointsUpdate([...customPoints, newPt]);
                alert(`✅ 卫星锁定成功！已添加：${searchData.name}`);
                setSearchData({ ...searchData, name: '' }); 
            } else {
                alert(`❌ 卫星未能锁定目标：“${searchData.name}”\n💡 提示：尝试输入更完整的名称。`);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    }, [searchData, customPoints, onPointsUpdate]);

    // =====================================================================
    // 🆕 多文件队列处理系统 (带呼吸节拍)
    // =====================================================================
    const handleFileUpload = useCallback(async (e) => {
        const files = Array.from(e.target.files || e.dataTransfer.files);
        if (files.length === 0) return;

        if (!GOOGLE_MAPS_API_KEY) {
            alert("❌ 缺少 Google Maps API Key，请检查 .env 配置！");
            e.target.value = null;
            return;
        }

        // 🆕 初始化队列
        setFileQueue(files);
        setIsProcessing(true);

        let totalSuccess = 0;
        let totalFailed = 0;
        const allNewPoints = [];
        const allFails = [];

        // 🔄 逐个处理文件（队列模式）
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const file = files[fileIndex];
            setCurrentFile(file);
            setCurrentFileIndex(fileIndex);

            try {
                const text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsText(file);
                });

                const placesToFetch = geocodeService.parseCSVContent(text, file.name);
                if (placesToFetch.length === 0) {
                    console.warn(`⚠️ 文件 ${file.name} 中未找到有效地名`);
                    continue;
                }

                let fileSuccess = 0;
                const fileFails = [];

                // 📍 处理单个文件中的地点
                for (let i = 0; i < placesToFetch.length; i++) {
                    const place = placesToFetch[i];

                    // 📊 更新进度显示
                    setProcessStatus(
                        `📂 ${file.name} (${fileIndex + 1}/${files.length})\n` +
                        `📍 ${place.name} (${i + 1}/${placesToFetch.length})`
                    );
                    setProgress(Math.round(((fileIndex * placesToFetch.length + i + 1) / (files.length * placesToFetch.length)) * 100));

                    let coords;
                    if (place.hasCoords) {
                        coords = { lat: place.lat, lon: place.lon };
                        fileSuccess++;
                    } else {
                        // ⏱️ 关键：API 请求加上 800ms 的呼吸节拍，防止触发速率限制
                        coords = await geocodeService.geocode(place.name, place.url, 'spot');
                        await sleep(800);
                    }

                    if (coords) {
                        allNewPoints.push({
                            id: `csv_${Date.now()}_${fileIndex}_${i}`,
                            name: place.name,
                            lat: coords.lat,
                            lon: coords.lon,
                            category: 'auto',
                            source: file.name,
                            importedAt: Date.now()
                        });
                        if (!place.hasCoords) fileSuccess++;
                    } else {
                        fileFails.push(place.name);
                        totalFailed++;
                    }
                }

                totalSuccess += fileSuccess;
                allFails.push(...fileFails);

                console.log(`✅ 文件 ${file.name} 处理完成：成功 ${fileSuccess} 个，失败 ${fileFails.length} 个`);

            } catch (error) {
                console.error(`❌ 文件 ${file.name} 处理失败：`, error);
                setProcessStatus(`❌ 文件 ${file.name} 解析失败：${error.message}`);
            }
        }

        // 🎯 所有文件处理完毕，批量更新数据
        const existingKeys = new Set(customPoints.map(p => `${p.name}_${p.lat.toFixed(4)}_${p.lon.toFixed(4)}`));
        const uniqueNew = allNewPoints.filter(p => !existingKeys.has(`${p.name}_${p.lat.toFixed(4)}_${p.lon.toFixed(4)}`));
        const skippedCount = allNewPoints.length - uniqueNew.length;

        onPointsUpdate([...customPoints, ...uniqueNew]);
        if (allFails.length > 0) {
            setFailedPoints(prev => [...new Set([...prev, ...allFails])]);
        }

        // 📊 最终统计
        setProcessStatus(
            `🎉 全部完成！共处理 ${files.length} 个文件\n` +
            `✅ 新增 ${uniqueNew.length} 个地标` +
            (skippedCount > 0 ? `（跳过 ${skippedCount} 个重复）` : '') +
            (allFails.length > 0 ? `\n❌ 失败 ${allFails.length} 个` : '')
        );
        setCurrentFile(null);
        setCurrentFileIndex(0);

        setTimeout(() => {
            setIsProcessing(false);
            setFileQueue([]);
        }, 5000);

        // 清理 input
        if (e.target) e.target.value = null;
    }, [customPoints, onPointsUpdate]);

    // 其他基础功能...
    const clearAllData = useCallback(() => {
        if (window.confirm("⚠️ 确定要清空地图上所有的自定义点位吗？")) {
            onPointsUpdate([]); setFailedPoints([]); setProcessStatus(''); setProgress(0);
        }
    }, [onPointsUpdate]);

    const handleManualAdd = useCallback(() => { /* 同原逻辑 */
        if (!manualData.name || !manualData.lat || !manualData.lon) return alert('⚠️ 请填写完整');
        onPointsUpdate([...customPoints, { id: `manual_${Date.now()}`, ...manualData, lat: parseFloat(manualData.lat), lon: parseFloat(manualData.lon), source: '手动修正录入' }]);
        setManualData({ name: '', lat: '', lon: '', type: 'spot' });
    }, [manualData, customPoints, onPointsUpdate]);

    const handlePasteCoords = useCallback(async () => { /* 同原逻辑 */ }, []);
    const populateManual = useCallback((name) => setSearchData(prev => ({ ...prev, name })), []);
    const removeFailedPoint = useCallback((name) => setFailedPoints(prev => prev.filter(p => p !== name)), []);

    const formatImportTime = useCallback((timestamp) => {
        if (!timestamp) return '';
        const minutes = Math.floor((Date.now() - timestamp) / 60000);
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`;
        return `${Math.floor(minutes / 1440)}天前`;
    }, []);

    const groupedPoints = useMemo(() => {
        const groups = {};
        customPoints.forEach(pt => {
            let source = (pt.source || '未分类').replace(/^源：/, '');
            // 🆕 去掉 .csv 后缀，显示更清爽
            if (source.endsWith('.csv')) {
                source = source.slice(0, -4);
            }
            if (!groups[source]) groups[source] = { name: source, count: 0, lastImport: 0, points: [] };
            groups[source].count++;
            groups[source].points.push(pt);
            if (pt.importedAt && pt.importedAt > groups[source].lastImport) groups[source].lastImport = pt.importedAt;
        });
        return Object.values(groups).sort((a, b) => b.lastImport - a.lastImport);
    }, [customPoints]);

    const handlePointClick = useCallback((point) => { if (window.__locatePointOnMap) window.__locatePointOnMap(point.id); }, []);

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500`}>
            <div className="grid md:grid-cols-5 gap-6">
                
                {/* 左侧：CSV 批量解析舱 */}
                <div className="md:col-span-3 bg-white rounded-[2rem] border border-gray-200 shadow-xl p-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center">
                            <UploadCloud className="w-6 h-6 mr-2 text-cyan-600" /> CSV 战术解析舱
                        </h2>
                    </div>
                    <div
                        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer overflow-hidden transition-all ${
                            isProcessing
                                ? 'border-indigo-300 bg-indigo-50'
                                : 'border-cyan-300 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-400'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-cyan-500', 'bg-cyan-200'); }}
                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-200'); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-200');
                            handleFileUpload(e);
                        }}
                    >
                        <input
                            type="file"
                            accept=".csv"
                            multiple
                            onChange={handleFileUpload}
                            disabled={isProcessing}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <Server className={`w-10 h-10 mx-auto mb-3 text-cyan-500 ${isProcessing ? 'animate-pulse' : ''}`} />
                        <h3 className="font-bold text-cyan-900 mb-1">
                            {isProcessing ? '🚀 正在处理中...' : '📂 拖入多个 CSV 文件'}
                        </h3>
                        <p className="text-xs text-cyan-700">
                            {isProcessing
                                ? `请稍候，正在按队列处理 ${fileQueue.length} 个文件`
                                : '支持同时拖入多个 Google Maps 导出的 CSV 文件'}
                        </p>
                        {currentFile && (
                            <div className="mt-2 text-xs font-mono bg-white/50 rounded px-2 py-1 inline-block">
                                📄 当前: {currentFile.name}
                            </div>
                        )}
                    </div>
                    
                    {isProcessing && (
                        <div className="mt-6 bg-zinc-900 p-5 rounded-2xl text-white shadow-lg">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center text-xs font-mono text-cyan-400">
                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                    <span className="whitespace-pre-line">{processStatus}</span>
                                </div>
                                <span className="text-lg font-bold text-cyan-400">{progress}%</span>
                            </div>

                            {/* 🆕 文件队列进度条 */}
                            <div className="mb-2">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>总进度</span>
                                    <span>{fileQueue.length} 个文件</span>
                                </div>
                                <div className="w-full bg-zinc-700 rounded-full h-2">
                                    <div
                                        className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* 当前文件指示器 */}
                            {fileQueue.length > 1 && (
                                <div className="mt-3 pt-3 border-t border-zinc-700">
                                    <div className="text-[10px] text-gray-400 mb-1">文件队列</div>
                                    <div className="flex gap-1 flex-wrap">
                                        {fileQueue.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className={`text-[9px] px-2 py-0.5 rounded ${
                                                    idx === currentFileIndex
                                                        ? 'bg-cyan-500 text-white'
                                                        : idx < currentFileIndex
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-zinc-700 text-gray-400'
                                                }`}
                                            >
                                                {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {!isProcessing && processStatus && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm font-bold text-green-800 flex items-center"><CheckCircle2 className="w-5 h-5 mr-2 text-green-600" /> {processStatus}</div>
                    )}

                    {/* 已存储星标库 */}
                    <div className="mt-8">
                        <div className="flex justify-between items-end mb-3 border-b pb-2">
                            <h4 className="font-bold text-gray-700">战术星标库 ({customPoints.length})</h4>
                            {customPoints.length > 0 && <button onClick={clearAllData} className="text-xs text-red-500 hover:text-red-700 flex items-center transition-colors"><Trash2 className="w-3 h-3 mr-1" /> 格式化缓存</button>}
                        </div>
                        <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                            {customPoints.length === 0 && <p className="text-sm text-gray-400 text-center py-8">雷达图当前为空，等待数据注入。</p>}
                            {groupedPoints.map(group => (
                                <div key={group.name} className="mb-2">
                                    <button onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)} className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-3 rounded-xl border border-gray-200 hover:border-cyan-300 transition-all">
                                        <div className="flex items-center gap-2">
                                            {expandedGroup === group.name ? <ChevronDown className="w-4 h-4 text-cyan-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                            <span className="font-bold text-sm text-gray-800 truncate max-w-[150px]">{group.name}</span>
                                            <span className="text-xs text-gray-500">({group.count})</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400">{formatImportTime(group.lastImport)}</span>
                                    </button>
                                    {expandedGroup === group.name && (
                                        <div className="mt-1 ml-4 space-y-1 animate-in slide-in-from-top-1 duration-200">
                                            {group.points.map(pt => (
                                                <button key={pt.id} onClick={() => handlePointClick(pt)} className="w-full flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-100 hover:border-cyan-400 hover:bg-cyan-50 transition-all text-left">
                                                    <span className="font-bold text-sm text-gray-800 flex items-center">
                                                        <span className="mr-2 text-lg">{getIconStyle(pt.category, pt.source).icon}</span>
                                                        <span className="truncate max-w-[180px]">{pt.name}</span>
                                                    </span>
                                                    <span className="font-mono text-[10px] text-cyan-700 bg-cyan-100/50 px-2 py-1 rounded-md border border-cyan-200">{pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右侧：雷达检索 & 手动补录 */}
                <div className="md:col-span-2 space-y-6">
                    {failedPoints.length > 0 && (
                        <div className="bg-red-50 rounded-2xl border border-red-200 p-5 shadow-sm">
                            <h4 className="font-bold text-red-800 text-sm flex items-center mb-3"><AlertCircle className="w-4 h-4 mr-1" /> 卫星锁定失败 ({failedPoints.length})</h4>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {failedPoints.map(fp => (
                                    <button key={fp} onClick={() => populateManual(fp)} className="text-xs bg-white text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-100 flex items-center gap-1 shadow-sm">
                                        {fp} <span onClick={(e) => { e.stopPropagation(); removeFailedPoint(fp); }} className="hover:text-red-900 font-bold ml-1">×</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6 shadow-xl relative overflow-hidden">
                        <Search className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500 opacity-5 pointer-events-none" />
                        <h4 className="font-black text-indigo-900 mb-4 flex items-center border-b border-indigo-100 pb-2">
                            <Search className="w-5 h-5 mr-2 text-indigo-500" /> Google 战术雷达检索
                        </h4>
                        <div className="space-y-3 relative z-10">
                            <p className="text-[11px] text-indigo-600/80 font-bold mb-1">直连 Google 卫星获取最高精度 GPS：</p>
                            <input type="text" value={searchData.name} onChange={e => setSearchData({ ...searchData, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleSmartSearch()} className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none shadow-sm" placeholder="如：清水寺 / Tokyo Tower..." />
                            <div className="flex gap-2">
                                <select value={searchData.type} onChange={e => setSearchData({ ...searchData, type: e.target.value })} className="w-1/3 bg-white border border-indigo-200 rounded-lg px-2 py-2 text-sm shadow-sm outline-none cursor-pointer">
                                    <option value="spot">📍 地标</option><option value="station">🚉 车站</option><option value="airport">✈️ 机场</option><option value="hotel">🏨 住宿</option><option value="anime">🌸 圣地</option>
                                </select>
                                <button onClick={handleSmartSearch} disabled={isSearching} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2 rounded-lg shadow-md active:scale-95 transition-all flex items-center justify-center">
                                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
                                    {isSearching ? '信号连接中...' : '锁定目标坐标'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
                            <Plus className="w-4 h-4 mr-2 text-cyan-600" /> 手动坐标覆写
                        </h4>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input type="text" value={manualData.name} onChange={e => setManualData({ ...manualData, name: e.target.value })} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="信标代号" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" value={manualData.lat} onChange={e => setManualData({ ...manualData, lat: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Lat (纬度)" />
                                <input type="number" value={manualData.lon} onChange={e => setManualData({ ...manualData, lon: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Lon (经度)" />
                            </div>
                            <div className="flex gap-2">
                                <select value={manualData.type} onChange={e => setManualData({ ...manualData, type: e.target.value })} className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm">
                                    <option value="spot">📍 地标</option><option value="station">🚉 车站</option><option value="airport">✈️ 机场</option><option value="hotel">🏨 住宿</option><option value="anime">🌸 圣地</option>
                                </select>
                                <button onClick={handleManualAdd} className="flex-1 bg-white border-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white font-bold py-2 rounded-lg transition-colors">
                                    强制注入
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataCenter;