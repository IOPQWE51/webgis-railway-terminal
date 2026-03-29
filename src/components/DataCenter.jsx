import { useState, useCallback, useMemo } from 'react';
import { UploadCloud, Server, Loader2, CheckCircle2, Trash2, AlertCircle, Plus, Search, MapPin } from 'lucide-react';
import { getIconStyle } from '../utils/helpers'; 

/**
 * 地理编码服务 - 负责地名解析为坐标
 */
/**
 * 🛰️ 地理编码与数据解析中枢 (装甲重构版)
 */
/**
 * 🛰️ 地理编码与数据解析中枢 (双引擎制导版)
 */
const geocodeService = {
    // 🚀 核心升级：引入 ArcGIS 企业级引擎作为主脑，OSM 作为兜底
    // 🚀 究极重构：三引擎混合雷达 + 语义欺骗防偏系统
    async geocode(placeName) {
        try {
            // 🧠 1. 语义增强 (Semantic Sniffing)
            // 强行给纯中文地标加上英文后缀，防止商业引擎将其误判为国内的同名小公司
            let smartQuery = placeName;
            if (placeName.includes('机场') || placeName.includes('空港')) smartQuery += ' Airport';
            if (placeName.includes('站') || placeName.includes('駅')) smartQuery += ' Station';
            if (placeName.includes('旅舍') || placeName.includes('酒店')) smartQuery += ' Hotel';

            // 🚀 引擎 A：Photon (基于 ElasticSearch，对中日英多语言抗干扰极强)
            try {
                const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(smartQuery)}&limit=1`;
                const photonRes = await fetch(photonUrl);
                const photonData = await photonRes.json();
                if (photonData?.features?.length > 0) {
                    const coords = photonData.features[0].geometry.coordinates; // Photon 返回 [lon, lat]
                    console.log(`[Photon 命中] ${placeName} -> ${coords[1]}, ${coords[0]}`);
                    return { lat: coords[1], lon: coords[0] };
                }
            } catch (e) { console.warn('Photon 引擎超时'); }

            // 🎯 引擎 B：ArcGIS (加上英文后缀后，绝对不会再定位到济南小卖部)
            try {
                const arcGisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(smartQuery)}&maxLocations=1`;
                const arcRes = await fetch(arcGisUrl);
                const arcData = await arcRes.json();
                if (arcData?.candidates?.length > 0) {
                    const location = arcData.candidates[0].location;
                    console.log(`[ArcGIS 命中] ${placeName} -> ${location.y}, ${location.x}`);
                    return { lat: location.y, lon: location.x };
                }
            } catch (e) { console.warn('ArcGIS 引擎超时'); }

            // ♻️ 引擎 C：OSM Nominatim (强制加入 ja 日语 header 偏好，防止富冈/福冈惨案)
            try {
                const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1&accept-language=zh-CN,ja,en-US`;
                const osmRes = await fetch(osmUrl);
                const osmData = await osmRes.json();
                if (osmData?.length > 0) {
                    console.log(`[OSM 兜底命中] ${placeName} -> ${osmData[0].lat}, ${osmData[0].lon}`);
                    return { lat: parseFloat(osmData[0].lat), lon: parseFloat(osmData[0].lon) };
                }
            } catch (e) { console.warn('OSM 引擎超时'); }

            return null;
        } catch (error) {
            console.error(`三引擎雷达全部失效：${placeName}`, error);
            return null;
        }
    },

    // 🚀 重构一：全文本级 CSV 解析器，完美兼容带换行符的“记事”和“评论”列
    parseCSVText(text) {
        const rows = [];
        let currentRow = [];
        let currentVal = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    currentVal += '"';
                    i++; // 跳过转义引号
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    currentVal += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentRow.push(currentVal.trim());
                    currentVal = '';
                } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                    currentRow.push(currentVal.trim());
                    if (currentRow.some(v => v !== '')) rows.push(currentRow); // 忽略纯空行
                    currentRow = [];
                    currentVal = '';
                    if (char === '\r') i++; // 跳过 \n
                } else {
                    currentVal += char;
                }
            }
        }
        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal.trim());
            if (currentRow.some(v => v !== '')) rows.push(currentRow);
        }
        return rows;
    },

    // 🚀 重构二：智能清洗与三栖正则匹配引擎
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
                
                // 🕵️‍♂️ 智能嗅探 URL 列，防止记事列为空或过长导致列索引偏移
                let url = '';
                const urlIndex = parts.findIndex(p => p.includes('http'));
                if (urlIndex !== -1) {
                    url = parts[urlIndex];
                }

                let lat, lon, hasCoords = false;
                
                // 📡 终极正则强化：暴力提取 Google Maps 隐藏在 URL 深处的坐标
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
                const cleanName = parts[0];
                if (cleanName) placesToFetch.push({ name: cleanName, hasCoords: false });
            }
        }
        return placesToFetch;
    }
};

const DataCenter = ({ isActive, customPoints, onPointsUpdate }) => {
    // CSV 解析状态
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState('');
    const [progress] = useState(0);
    const [failedPoints, setFailedPoints] = useState([]);
    
    // 手动补录状态
    const [manualData, setManualData] = useState({ name: '', lat: '', lon: '', type: 'spot' });

    // 🆕 智能搜索状态
    const [searchData, setSearchData] = useState({ name: '', type: 'spot' });
    const [isSearching, setIsSearching] = useState(false);

    // =====================================================================
    // 🆕 核心功能：智能雷达检索添加
    // =====================================================================
    const handleSmartSearch = useCallback(async () => {
        if (!searchData.name.trim()) {
            alert('⚠️ 请输入要检索的地标名称');
            return;
        }

        setIsSearching(true);
        try {
            const coords = await geocodeService.geocode(searchData.name);
            
            if (coords) {
                const newPt = {
                    id: `search_${Date.now()}`,
                    name: searchData.name,
                    lat: coords.lat,
                    lon: coords.lon,
                    category: searchData.type,
                    source: 'OSM 智能检索'
                };
                
                onPointsUpdate([...customPoints, newPt]);
                alert(`✅ 卫星定位成功！已添加：${searchData.name}\n📍 坐标：${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);
                setSearchData({ ...searchData, name: '' }); // 成功后清空输入框
            } else {
                alert(`❌ 卫星未能锁定目标：“${searchData.name}”\n\n💡 极客提示：尝试输入更完整的名称，或者带上城市名（例如：“东京 浅草寺”或“Shinjuku Station”）。`);
            }
        } catch (_error) {
            alert('❌ 检索引擎网络请求失败，请检查网络连接。');
        } finally {
            setIsSearching(false);
        }
    }, [searchData, customPoints, onPointsUpdate]);

    // =====================================================================
    // 基础功能逻辑 (CSV 解析、手动添加、粘贴、清理)
    // =====================================================================
    const handleFileUpload = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const text = evt.target.result;
                const placesToFetch = geocodeService.parseCSVContent(text, file.name);

                if (placesToFetch.length === 0) throw new Error('CSV 文件中未找到有效地名');

                setIsProcessing(true);
                let successCount = 0;
                let fails = [];
                const newPoints = [];

                for (let i = 0; i < placesToFetch.length; i++) {
                    const place = placesToFetch[i];
                    setProcessStatus(`卫星定位中：${place.name} (${i + 1}/${placesToFetch.length})`);

                    let coords;
                    if (place.hasCoords) {
                        coords = { lat: place.lat, lon: place.lon };
                        successCount++;
                    } else {
                        coords = await geocodeService.geocode(place.name);
                    }

                    if (coords) {
                        newPoints.push({
                            id: `csv_${Date.now()}_${i}`,
                            name: place.name,
                            lat: coords.lat,
                            lon: coords.lon,
                            category: 'auto',
                            source: `源：${file.name}`
                        });
                        if (!place.hasCoords) successCount++;
                    } else {
                        fails.push(place.name);
                    }

                    if (!place.hasCoords) await new Promise(resolve => setTimeout(resolve, 500));
                }

                const existingNames = new Set(customPoints.map(p => p.name));
                const uniqueNew = newPoints.filter(p => !existingNames.has(p.name));
                onPointsUpdate([...customPoints, ...uniqueNew]);

                if (fails.length > 0) setFailedPoints(prev => [...new Set([...prev, ...fails])]);
                
                const geoCount = placesToFetch.filter(p => !p.hasCoords).length;
                const coordCount = placesToFetch.filter(p => p.hasCoords).length;
                setProcessStatus(`✅ 解析完成！共 ${placesToFetch.length} 个地点（${coordCount} 含坐标，${geoCount} 需解析），新增 ${successCount} 个坐标，未识别 ${fails.length} 个。`);
            } catch (error) {
                setProcessStatus(`❌ 错误：${error.message}`);
            } finally {
                setIsProcessing(false);
                e.target.value = null;
            }
        };
        reader.onerror = () => { setProcessStatus('❌ 文件读取失败'); setIsProcessing(false); };
        reader.readAsText(file);
    }, [customPoints, onPointsUpdate]);

    const clearAllData = useCallback(() => {
        if (window.confirm("⚠️ 危险操作：确定要清空地图上所有的自定义点位吗？")) {
            onPointsUpdate([]);
            setFailedPoints([]);
            setProcessStatus('');
        }
    }, [onPointsUpdate]);

    const handleManualAdd = useCallback(() => {
        if (!manualData.name || !manualData.lat || !manualData.lon) {
            alert('⚠️ 请填写完整的坐标信息');
            return;
        }
        const lat = parseFloat(manualData.lat);
        const lon = parseFloat(manualData.lon);
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            alert('⚠️ 经纬度格式错误（纬度：-90 到 90，经度：-180 到 180）');
            return;
        }

        const newPt = {
            id: `manual_${Date.now()}`,
            name: manualData.name, lat, lon, category: manualData.type, source: '手动修正录入'
        };
        onPointsUpdate([...customPoints, newPt]);
        setFailedPoints(prev => prev.filter(p => p !== manualData.name));
        setManualData({ name: '', lat: '', lon: '', type: 'spot' });
    }, [manualData, customPoints, onPointsUpdate]);

    const handlePasteCoords = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) { alert('⚠️ 剪贴板为空'); return; }

            let lat, lon, name;
            const coordMatch = text.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
            if (coordMatch) {
                lat = parseFloat(coordMatch[1]);
                lon = parseFloat(coordMatch[2]);
                const nameMatch = text.match(/@[^,\s]+/);
                name = nameMatch ? decodeURIComponent(nameMatch[0].substring(1)) : `粘贴点_${Date.now()}`;
                
                setManualData({ name: name.replace(/_/g, ' ').trim(), lat: lat.toString(), lon: lon.toString(), type: 'spot' });
                if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    alert(`✅ 成功解析坐标：\n纬度：${lat.toFixed(6)}\n经度：${lon.toFixed(6)}\n地点：${name}`);
                } else {
                    alert('⚠️ 坐标可能不正确，请检查范围');
                }
                return;
            }

            const urlMatch = text.match(/maps\.app\.goo\.gl|google\.com\/maps|@(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
            if (urlMatch && urlMatch[1] && urlMatch[2]) {
                lat = parseFloat(urlMatch[1]);
                lon = parseFloat(urlMatch[2]);
                setManualData({ name: `Google 地图点_${Date.now()}`, lat: lat.toString(), lon: lon.toString(), type: 'spot' });
                alert(`✅ 从 URL 解析成功：\n纬度：${lat.toFixed(6)}\n经度：${lon.toFixed(6)}`);
                return;
            }
            alert('❌ 无法识别坐标格式，请确保剪贴板包含类似 "35.6895, 139.6917" 的文本。');
        } catch (_err) {
            alert('❌ 读取剪贴板失败，浏览器可能拦截了权限。请直接使用 Ctrl+V 粘贴到框内。');
        }
    }, []);

    const populateManual = useCallback((name) => {
        // 如果是从失败列表点过来的，直接填入“智能搜索框”里，更方便用户修改重试
        setSearchData(prev => ({ ...prev, name }));
    }, []);

    const removeFailedPoint = useCallback((name) => setFailedPoints(prev => prev.filter(p => p !== name)), []);

    const memoizedCustomPoints = useMemo(() => customPoints, [customPoints]);
    const memoizedFailedPoints = useMemo(() => failedPoints, [failedPoints]);

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500`}>
            <div className="grid md:grid-cols-5 gap-6">
                
                {/* 左侧：CSV 批量解析舱 & 数据展示 */}
                <div className="md:col-span-3 bg-white rounded-[2rem] border border-gray-200 shadow-xl p-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center">
                            <UploadCloud className="w-6 h-6 mr-2 text-cyan-600" /> CSV 批量解析舱
                        </h2>
                    </div>
                    <div className="relative border-2 border-dashed border-cyan-300 bg-cyan-50 hover:bg-cyan-100 transition-colors rounded-2xl p-8 text-center cursor-pointer overflow-hidden">
                        <input type="file" accept=".csv" onChange={handleFileUpload} disabled={isProcessing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                        <Server className={`w-10 h-10 mx-auto mb-3 text-cyan-500 ${isProcessing ? 'animate-pulse' : ''}`} />
                        <h3 className="font-bold text-cyan-900">点击或拖拽上传 Google Maps CSV 文件</h3>
                    </div>
                    
                    {isProcessing && (
                        <div className="mt-6 bg-zinc-900 p-5 rounded-2xl text-white">
                            <div className="flex justify-between text-xs font-mono text-cyan-400 mb-2">
                                <span className="flex items-center"><Loader2 className="w-3 h-3 mr-2 animate-spin" /> {processStatus}</span><span>{progress}%</span>
                            </div>
                            <div className="w-full bg-zinc-700 rounded-full h-2"><div className="bg-cyan-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
                        </div>
                    )}
                    
                    {!isProcessing && processStatus && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm font-bold text-green-800 flex items-center"><CheckCircle2 className="w-5 h-5 mr-2 text-green-600" /> {processStatus}</div>
                    )}

                    {/* 已存储点位列表 */}
                    <div className="mt-8">
                        <div className="flex justify-between items-end mb-3 border-b pb-2">
                            <h4 className="font-bold text-gray-700">本地已存储的星标库 ({memoizedCustomPoints.length})</h4>
                            {memoizedCustomPoints.length > 0 && <button onClick={clearAllData} className="text-xs text-red-500 hover:text-red-700 flex items-center transition-colors"><Trash2 className="w-3 h-3 mr-1" /> 清空全部</button>}
                        </div>
                        <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {memoizedCustomPoints.length === 0 && <p className="text-sm text-gray-400 text-center py-8">地图目前很空旷，试试上传或搜索添加地标吧。</p>}
                            {memoizedCustomPoints.map(pt => (
                                <div key={pt.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100 hover:border-cyan-200 transition-colors">
                                    <span className="font-bold text-sm text-gray-800 flex items-center">
                                        <span className="mr-2 text-lg">{getIconStyle(pt.category, pt.source).icon}</span> 
                                        <span className="truncate max-w-[180px]" title={pt.name}>{pt.name}</span>
                                    </span>
                                    <span className="font-mono text-[10px] text-cyan-700 bg-cyan-100/50 px-2 py-1 rounded-md border border-cyan-200">{pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右侧：雷达检索 & 手动补录面板 */}
                <div className="md:col-span-2 space-y-6">
                    
                    {/* 失败点位提醒 */}
                    {memoizedFailedPoints.length > 0 && (
                        <div className="bg-red-50 rounded-2xl border border-red-200 p-5 shadow-sm">
                            <h4 className="font-bold text-red-800 text-sm flex items-center mb-3"><AlertCircle className="w-4 h-4 mr-1" /> 卫星定位失败 ({memoizedFailedPoints.length})</h4>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {memoizedFailedPoints.map(fp => (
                                    <button key={fp} onClick={() => populateManual(fp)} className="text-xs bg-white text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-100 flex items-center gap-1 shadow-sm" title="点击填入智能搜索框重试">
                                        {fp} <span onClick={(e) => { e.stopPropagation(); removeFailedPoint(fp); }} className="hover:text-red-900 font-bold ml-1">×</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 🆕 模块一：智能雷达检索 */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6 shadow-xl relative overflow-hidden">
                        <Search className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500 opacity-5 pointer-events-none" />
                        <h4 className="font-black text-indigo-900 mb-4 flex items-center border-b border-indigo-100 pb-2">
                            <Search className="w-5 h-5 mr-2 text-indigo-500" /> OSM 智能雷达检索
                        </h4>
                        <div className="space-y-3 relative z-10">
                            <p className="text-[11px] text-indigo-600/80 font-bold mb-1">输入地名，系统将自动连接卫星获取 GPS 坐标：</p>
                            <input 
                                type="text" 
                                value={searchData.name} 
                                onChange={e => setSearchData({ ...searchData, name: e.target.value })} 
                                onKeyDown={e => e.key === 'Enter' && handleSmartSearch()}
                                className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none shadow-sm" 
                                placeholder="如：清水寺 / Tokyo Tower..." 
                            />
                            <div className="flex gap-2">
                                <select 
                                    value={searchData.type} 
                                    onChange={e => setSearchData({ ...searchData, type: e.target.value })} 
                                    className="w-1/3 bg-white border border-indigo-200 rounded-lg px-2 py-2 text-sm shadow-sm outline-none cursor-pointer"
                                >
                                    <option value="spot">📍 地标</option><option value="station">🚉 车站</option><option value="airport">✈️ 机场</option><option value="hotel">🏨 住宿</option><option value="anime">🌸 圣地</option>
                                </select>
                                <button 
                                    onClick={handleSmartSearch} 
                                    disabled={isSearching}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2 rounded-lg shadow-md active:scale-95 transition-all flex items-center justify-center"
                                >
                                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
                                    {isSearching ? '检索中...' : '搜索并打点'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 模块二：手动精准输入（原逻辑保留） */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
                            <Plus className="w-4 h-4 mr-2 text-cyan-600" /> 手动经纬度录入
                        </h4>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input type="text" value={manualData.name} onChange={e => setManualData({ ...manualData, name: e.target.value })} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="地点名称" />
                                <button onClick={handlePasteCoords} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-bold shadow-sm">📋 粘贴坐标</button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" value={manualData.lat} onChange={e => setManualData({ ...manualData, lat: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="纬度 (Lat)" />
                                <input type="number" value={manualData.lon} onChange={e => setManualData({ ...manualData, lon: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="经度 (Lon)" />
                            </div>
                            <div className="flex gap-2">
                                <select value={manualData.type} onChange={e => setManualData({ ...manualData, type: e.target.value })} className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm">
                                    <option value="spot">📍 地标</option><option value="station">🚉 车站</option><option value="airport">✈️ 机场</option><option value="hotel">🏨 住宿</option><option value="anime">🌸 圣地</option>
                                </select>
                                <button onClick={handleManualAdd} className="flex-1 bg-white border-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white font-bold py-2 rounded-lg transition-colors">
                                    强行打点
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