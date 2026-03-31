import { useState, useCallback, useMemo } from 'react';
import { UploadCloud, Server, Loader2, CheckCircle2, Trash2, AlertCircle, Plus, Search, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { getIconStyle } from '../utils/helpers'; 

/**
 * 🛰️ 地理编码与数据解析中枢 (Google API 优先版)
 */

// 🔑 Google Maps API Key - 从环境变量读取
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// 🗂️ 地理编码缓存（防止重复查询）
const geocodeCache = new Map();

const geocodeService = {
    // 🔧 从 Google Maps URL 提取 Place ID
    extractPlaceId(url) {
        if (!url) return null;
        // 匹配格式：!1s{place_id}
        const match = url.match(/!1s([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    },

    // 🚀 使用 Google Geocoding API 查询（优先）
    async geocodeWithGoogle(placeIdOrName) {
        try {
            // 检查缓存
            const cacheKey = placeIdOrName;
            if (geocodeCache.has(cacheKey)) {
                console.log(`[缓存命中] ${placeIdOrName}`);
                return geocodeCache.get(cacheKey);
            }

            let url;

            // 判断是 Place ID 还是地名
            // Place ID 格式：0xabcdef:1234567890 或长字符串
            if (placeIdOrName.match(/^0x[a-fA-F0-9]+:[a-fA-F0-9]+$/) || placeIdOrName.length > 20) {
                // Place ID 查询
                url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeIdOrName)}&key=${GOOGLE_MAPS_API_KEY}`;
            } else {
                // 地名查询
                url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeIdOrName)}&key=${GOOGLE_MAPS_API_KEY}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
                const location = data.results[0].geometry.location;
                const result = {
                    lat: location.lat,
                    lon: location.lng
                };

                // 存入缓存
                geocodeCache.set(cacheKey, result);
                console.log(`[Google API 命中] ${placeIdOrName} -> ${result.lat}, ${result.lon}`);

                return result;
            } else if (data.status === 'ZERO_RESULTS') {
                console.warn(`[Google API] 未找到: ${placeIdOrName}`);
                return null;
            } else {
                console.error(`[Google API 错误] ${placeIdOrName}:`, data.status, data.error_message);
                return null;
            }
        } catch (error) {
            console.error(`[Google API 失败] ${placeIdOrName}:`, error);
            return null;
        }
    },
    // 🎯 主地理编码函数：Google API 优先，免费 API 回退
    async geocode(placeName, url = null) {
        try {
            // 🚀 策略 1：如果有 URL，优先提取 Place ID 并使用 Google API
            if (url) {
                const placeId = this.extractPlaceId(url);
                if (placeId) {
                    console.log(`[Place ID 检测] ${placeName} -> ${placeId}`);
                    const result = await this.geocodeWithGoogle(placeId);
                    if (result) return result;
                }
            }

            // 🚀 策略 2：直接使用 Google API 查询地名
            console.log(`[Google API 查询] ${placeName}`);
            const result = await this.geocodeWithGoogle(placeName);
            if (result) return result;

            // 🚀 策略 3：Google API 失败，回退到免费 API（Photon、ArcGIS、OSM）
            console.log(`[回退到免费 API] ${placeName}`);
            return await this.geocodeWithFallback(placeName);

        } catch (error) {
            console.error(`[地理编码失败] ${placeName}:`, error);
            return null;
        }
    },

    // 🔄 免费回退方案（Photon + ArcGIS + OSM）
    async geocodeWithFallback(placeName) {
        try {
            // 引擎 A：Photon
            try {
                const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(placeName)}&limit=1`;
                const photonRes = await fetch(photonUrl);
                const photonData = await photonRes.json();
                if (photonData?.features?.length > 0) {
                    const coords = photonData.features[0].geometry.coordinates;
                    console.log(`[Photon 命中] ${placeName} -> ${coords[1]}, ${coords[0]}`);
                    return { lat: coords[1], lon: coords[0] };
                }
            } catch (_e) { /* ignore */ }

            // 引擎 B：ArcGIS
            try {
                const arcGisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(placeName)}&maxLocations=1`;
                const arcRes = await fetch(arcGisUrl);
                const arcData = await arcRes.json();
                if (arcData?.candidates?.length > 0) {
                    const location = arcData.candidates[0].location;
                    console.log(`[ArcGIS 命中] ${placeName} -> ${location.y}, ${location.x}`);
                    return { lat: location.y, lon: location.x };
                }
            } catch (_e) { /* ignore */ }

            // 引擎 C：OSM Nominatim
            try {
                const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1&accept-language=zh-CN,ja,en-US`;
                const osmRes = await fetch(osmUrl);
                const osmData = await osmRes.json();
                if (osmData?.length > 0) {
                    console.log(`[OSM 命中] ${placeName} -> ${osmData[0].lat}, ${osmData[0].lon}`);
                    return { lat: parseFloat(osmData[0].lat), lon: parseFloat(osmData[0].lon) };
                }
            } catch (_e) { /* ignore */ }

            console.warn(`[全部失败] ${placeName}`);
            return null;
        } catch (error) {
            console.error(`[免费 API 失败] ${placeName}:`, error);
            return null;
        }
    },

    // 🚀 重构一：全文本级 CSV 解析器，完美兼容带换行符的”记事”和”评论”列
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

    // 🆕 手风琴式分组状态
    const [expandedGroup, setExpandedGroup] = useState(null);

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
                        coords = await geocodeService.geocode(place.name, place.url); // 🆕 传递 URL 用于提取 Place ID
                    }

                    if (coords) {
                        newPoints.push({
                            id: `csv_${Date.now()}_${i}`,
                            name: place.name,
                            lat: coords.lat,
                            lon: coords.lon,
                            category: 'auto',
                            source: file.name, // 🆕 保存为纯文件名，方便分组
                            importedAt: Date.now() // 🆕 保存导入时间戳
                        });
                        if (!place.hasCoords) successCount++;
                    } else {
                        fails.push(place.name);
                    }

                    if (!place.hasCoords) await new Promise(resolve => setTimeout(resolve, 500));
                }

                // 🆕 智能去重：根据名称和坐标双重判断
                const existingWithCoords = new Map(
                    customPoints.map(p => [`${p.name}_${p.lat.toFixed(4)}_${p.lon.toFixed(4)}`, true])
                );
                const uniqueNew = newPoints.filter(p =>
                    !existingWithCoords.has(`${p.name}_${p.lat.toFixed(4)}_${p.lon.toFixed(4)}`)
                );
                const skippedCount = newPoints.length - uniqueNew.length;

                onPointsUpdate([...customPoints, ...uniqueNew]);

                if (fails.length > 0) setFailedPoints(prev => [...new Set([...prev, ...fails])]);

                const geoCount = placesToFetch.filter(p => !p.hasCoords).length;
                const coordCount = placesToFetch.filter(p => p.hasCoords).length;

                // 🆕 更准确的统计信息
                let statusMsg = `✅ 解析完成！共 ${placesToFetch.length} 个地点（${coordCount} 含坐标，${geoCount} 需解析），成功 ${successCount} 个`;
                if (skippedCount > 0) {
                    statusMsg += `，新增 ${uniqueNew.length} 个（跳过 ${skippedCount} 个重复）`;
                } else {
                    statusMsg += `，新增 ${uniqueNew.length} 个`;
                }
                if (fails.length > 0) {
                    statusMsg += `，未识别 ${fails.length} 个`;
                }
                setProcessStatus(statusMsg);
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

    // 🆕 格式化导入时间为相对时间
    const formatImportTime = useCallback((timestamp) => {
        if (!timestamp) return '';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        return `${days}天前`;
    }, []);

    // 🆕 按照来源文件分组
    const groupedPoints = useMemo(() => {
        const groups = {};
        customPoints.forEach(pt => {
            // 🔧 统一 source 格式：移除旧格式的"源："前缀
            let source = pt.source || '未分类';
            if (source.startsWith('源：')) {
                source = source.substring(2); // 移除"源："前缀
            }

            // 特殊处理：智能检索、手动录入等
            if (!source.endsWith('.csv') && !source.includes('検索') && !source.includes('录入')) {
                // 如果是其他来源，保持原样或归类
            }

            if (!groups[source]) {
                groups[source] = {
                    name: source,
                    count: 0,
                    lastImport: 0,
                    points: []
                };
            }
            groups[source].count++;
            groups[source].points.push(pt);
            if (pt.importedAt && pt.importedAt > groups[source].lastImport) {
                groups[source].lastImport = pt.importedAt;
            }
        });
        return Object.values(groups).sort((a, b) => b.lastImport - a.lastImport);
    }, [customPoints]);

    // 🆕 点击地点跳转到地图并弹出面板
    const handlePointClick = useCallback((point) => {
        if (window.__locatePointOnMap) {
            window.__locatePointOnMap(point.id);
        }
    }, []);

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

                    {/* 🆕 已存储点位列表：手风琴式分组显示 */}
                    <div className="mt-8">
                        <div className="flex justify-between items-end mb-3 border-b pb-2">
                            <h4 className="font-bold text-gray-700">本地已存储的星标库 ({memoizedCustomPoints.length})</h4>
                            {memoizedCustomPoints.length > 0 && <button onClick={clearAllData} className="text-xs text-red-500 hover:text-red-700 flex items-center transition-colors"><Trash2 className="w-3 h-3 mr-1" /> 清空全部</button>}
                        </div>
                        <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                            {memoizedCustomPoints.length === 0 && <p className="text-sm text-gray-400 text-center py-8">地图目前很空旷，试试上传或搜索添加地标吧。</p>}

                            {/* 🆕 分组列表 */}
                            {groupedPoints.map(group => (
                                <div key={group.name} className="mb-2">
                                    {/* 分组标题（可点击展开/收起） */}
                                    <button
                                        onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}
                                        className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-3 rounded-xl border border-gray-200 hover:border-cyan-300 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            {expandedGroup === group.name ? (
                                                <ChevronDown className="w-4 h-4 text-cyan-600" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                            <span className="font-bold text-sm text-gray-800 truncate max-w-[150px]" title={group.name}>{group.name}</span>
                                            <span className="text-xs text-gray-500">({group.count})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-400">{formatImportTime(group.lastImport)}</span>
                                        </div>
                                    </button>

                                    {/* 展开的地点列表 */}
                                    {expandedGroup === group.name && (
                                        <div className="mt-1 ml-4 space-y-1 animate-in slide-in-from-top-1 duration-200">
                                            {group.points.map(pt => (
                                                <button
                                                    key={pt.id}
                                                    onClick={() => handlePointClick(pt)}
                                                    className="w-full flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-100 hover:border-cyan-400 hover:bg-cyan-50 transition-all text-left"
                                                >
                                                    <span className="font-bold text-sm text-gray-800 flex items-center">
                                                        <span className="mr-2 text-lg">{getIconStyle(pt.category, pt.source).icon}</span>
                                                        <span className="truncate max-w-[180px]" title={pt.name}>{pt.name}</span>
                                                    </span>
                                                    <span className="font-mono text-[10px] text-cyan-700 bg-cyan-100/50 px-2 py-1 rounded-md border border-cyan-200">
                                                        {pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
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