import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Filter, CloudRain, Cloud, Map as MapIcon, Moon, Globe, Ruler, X } from 'lucide-react';
import { getIconStyle } from '../utils/helpers'; 

/** 铁路线路绘制配置 */
const RAILWAY_LINES_CONFIG = [
    { points: ['wakkanai', 'nayoro', 'asahikawa', 'iwamizawa', 'sapporo', 'tomakomai', 'hakodate'], color: '#22c55e', dashArray: null },
    { points: ['hakodate', 'shin_hakodate', 'shin_aomori'], color: '#f97316', dashArray: '6, 6' },
    { points: ['shin_aomori', 'aomori', 'hachinohe', 'morioka', 'ichinoseki', 'sendai', 'shiroishi', 'fukushima', 'koriyama', 'utsunomiya', 'omiya', 'ueno', 'tokyo'], color: '#22c55e', dashArray: null },
    { points: ['tokyo', 'yokohama', 'odawara', 'atami', 'shizuoka', 'hamamatsu', 'toyohashi', 'nagoya', 'maibara', 'kyoto', 'osaka'], color: '#22c55e', dashArray: null },
    { points: ['osaka', 'kobe', 'himeji', 'okayama', 'hiroshima', 'yamaguchi', 'shimonoseki'], color: '#22c55e', dashArray: null },
    { points: ['shimonoseki', 'moji', 'kokura', 'hakata', 'kumamoto', 'kagoshima_chuo'], color: '#22c55e', dashArray: null },
    { points: ['asahikawa', 'higashi_nemuro'], color: '#4ade80', dashArray: '4, 4' },
    { points: ['hakata', 'sasebo'], color: '#4ade80', dashArray: '4, 4' },
    { points: ['kagoshima_chuo', 'nishi_oyama'], color: '#22c55e', dashArray: null },
    { points: ['okayama', 'takamatsu'], color: '#22c55e', dashArray: null },
    { points: ['okayama', 'sakaiminato', 'oki'], color: '#3b82f6', dashArray: '4, 4' },
    { points: ['hiroshima', 'miyajima_guchi', 'miyajima'], color: '#3b82f6', dashArray: '4, 4' }
];

const TYPE_COLORS = { station: '#3b82f6', airport: '#8b5cf6', anime: '#ec4899', hotel: '#f97316', spot: '#06b6d4' };
// 👇 气象全息阵列坐标库 (全球 12 大枢纽均衡分布)
const GLOBAL_WEATHER_NODES = [
    { name: '北京', lat: 39.9042, lon: 116.4074 },
    { name: '东京', lat: 35.6895, lon: 139.6917 },
    { name: '新加坡', lat: 1.3521, lon: 103.8198 },
    { name: '悉尼', lat: -33.8688, lon: 151.2093 },
    { name: '伦敦', lat: 51.5074, lon: -0.1278 },
    { name: '巴黎', lat: 48.8566, lon: 2.3522 },
    { name: '莫斯科', lat: 55.7558, lon: 37.6173 },
    { name: '开罗', lat: 30.0444, lon: 31.2357 },
    { name: '纽约', lat: 40.7128, lon: -74.0060 },
    { name: '洛杉矶', lat: 34.0522, lon: -118.2437 },
    { name: '里约', lat: -22.9068, lon: -43.1729 },
    { name: '内罗毕', lat: -1.2921, lon: 36.8219 } // 非洲代表
];

const getPointFilterType = (pt) => {
    const source = pt.source || ''; const type = pt.category || '';
    if (source.includes('车站') || type === 'station') return 'station';
    if (source.includes('机场') || type === 'airport' || type === 'plane') return 'airport';
    if (source.includes('圣地') || type === 'anime') return 'anime';
    if (source.includes('住') || type === 'hotel') return 'hotel';
    return 'spot';
};

// =====================================================================
// 🌍 底图库 (Base Maps)
// =====================================================================
const BASE_MAPS = {
    topo: { name: 'Esri 拓扑', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' },
    satellite: { name: '高清卫星', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri, Maxar' },
    dark: { name: '暗黑终端', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' }
};

// =====================================================================
// ⚠️ 你的专属 OpenWeatherMap API Key (你需要去官网免费注册一个)
// 注册地址: https://home.openweathermap.org/users/sign_up
// =====================================================================
const OWM_API_KEY = 'f248f355671dcb0ffa5645c53823d4e5'; // 👈 哥们，把申请到的 Key 填到这里！

const MapEngine = ({ isActive, customPoints = [], basePoints = [], onDeletePoint }) => {
    const mapRef = useRef(null);
    const baseMapLayerRef = useRef(null);
    const baseLayerRef = useRef(null);
    const clusterGroupsRef = useRef({}); 
    const weatherLayerRef = useRef(null); // 🛰️ 气象图层引力场
    const cityWeatherNodesRef = useRef(null);// 👈 就在它下面加这行：城市气象节点图层
    
    const [leafletReady, setLeafletReady] = useState(false);

    // 系统状态管理
    const [baseMapType, setBaseMapType] = useState('topo'); // topo, satellite, dark
    const [weatherType, setWeatherType] = useState('none'); // none, precipitation_new, clouds_new
    const [filters, setFilters] = useState({ framework: true, station: true, airport: true, anime: true, hotel: true, spot: true });
    

    // 👇 --- 测距雷达独立状态 START ---
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [measurePoints, setMeasurePoints] = useState([]); // 存放起点和终点
    const [measureDistance, setMeasureDistance] = useState(0); // 距离(米)
    const measureLayerRef = useRef(null); // 专属绘画图层
    // 👆 --- 测距雷达独立状态 END ---


    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        window.__deleteCustomPoint = (id) => {
            if (window.confirm('⚠️ 确定要从系统中永久删除这个坐标点吗？')) {
                if (onDeletePoint) onDeletePoint(id);
                if (mapRef.current) mapRef.current.closePopup();
            }
        };
        return () => { delete window.__deleteCustomPoint; };
    }, [onDeletePoint]);

    // 1. 初始化 Leaflet 引擎
    useEffect(() => {
        const initLeafletSystem = async () => {
            const cssUrls = [
                'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
                'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
                'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css'
            ];
            cssUrls.forEach(url => {
                if (!document.querySelector(`link[href="${url}"]`)) {
                    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; document.head.appendChild(link);
                }
            });

            if (!window.L) {
                await new Promise(resolve => {
                    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                    script.onload = resolve; document.head.appendChild(script);
                });
            }
            if (!window.L.markerClusterGroup) {
                await new Promise(resolve => {
                    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js';
                    script.onload = resolve; document.head.appendChild(script);
                });
            }
            setLeafletReady(true);
        };
        initLeafletSystem();
    }, []);

    // 2. 初始化核心底图引擎 (处理底图切换)
    useEffect(() => {
        if (!leafletReady || !document.getElementById('real-map-container')) return;
        const L = window.L;

        if (!mapRef.current) {
            // 这里新增了 zoomSnap: 0.5，允许地图停在 4.5 这种半级缩放上
            mapRef.current = L.map('real-map-container', { 
                zoomControl: false,
                zoomSnap: 0.5 
            }).setView([37.5, 137.5], 4.5); // 👈 中心点微调，缩放改为 4.5

            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }

        // 清除旧底图，加载新底图
        if (baseMapLayerRef.current) mapRef.current.removeLayer(baseMapLayerRef.current);
        
        baseMapLayerRef.current = L.tileLayer(BASE_MAPS[baseMapType].url, {
            attribution: BASE_MAPS[baseMapType].attribution,
            maxZoom: 19,
            zIndex: 1
        }).addTo(mapRef.current);

    }, [leafletReady, baseMapType]);

    // 3. 🛰️ 气象雷达引擎加载
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;

        // 每次切换天气先清空旧天气云层
        if (weatherLayerRef.current) {
            mapRef.current.removeLayer(weatherLayerRef.current);
            weatherLayerRef.current = null;
        }

        if (weatherType !== 'none') {
            if (OWM_API_KEY === 'YOUR_API_KEY_HERE') {
                alert('⚠️ 气象雷达离线：\n你需要去 OpenWeatherMap 官网免费注册一个 API Key，并填入 MapEngine.jsx 代码中的 OWM_API_KEY 变量中，雷达才能生效！');
                setWeatherType('none');
                return;
            }

            // 加载 OWM 气象瓦片层
            const weatherUrl = `https://tile.openweathermap.org/map/${weatherType}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`;
            weatherLayerRef.current = L.tileLayer(weatherUrl, {
                opacity: 0.8, // 透明度设定为 0.8，防止遮盖铁路网
                maxZoom: 18,
                zIndex: 10,
                attribution: '&copy; OpenWeatherMap'
            }).addTo(mapRef.current);
        }
    }, [leafletReady, weatherType]);

    // 4. 渲染青春18基础骨架层
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        if (!baseLayerRef.current) baseLayerRef.current = L.layerGroup().addTo(mapRef.current);
        baseLayerRef.current.clearLayers();

        if (filters.framework) {
            const drawLine = (pointIds, color, dashArray) => {
                const coords = pointIds.map(id => {
                    const pt = basePoints.find(p => p.id === id);
                    return pt ? [pt.lat, pt.lon] : null;
                }).filter(Boolean);
                if (coords.length > 0) L.polyline(coords, { color, weight: 3, dashArray, opacity: 0.8 }).addTo(baseLayerRef.current);
            };
            RAILWAY_LINES_CONFIG.forEach(line => drawLine(line.points, line.color, line.dashArray));
            basePoints.forEach(pt => {
                let color = pt.type === 'shinkansen' ? '#f97316' : pt.type === 'ferry' || pt.type === 'plane' ? '#3b82f6' : '#22c55e';
                L.circleMarker([pt.lat, pt.lon], { radius: 10, fillColor: color, color: 'transparent', fillOpacity: 0.2 }).addTo(baseLayerRef.current);
                L.circleMarker([pt.lat, pt.lon], { radius: 5, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 }).addTo(baseLayerRef.current)
                    .bindPopup(`<div style="font-family: sans-serif; min-width: 150px;"><b>${pt.name}</b><br/><span style="font-size:12px; color:#666;">${pt.desc}</span></div>`);
            });
        }
    }, [leafletReady, basePoints, filters.framework]);

    // 5. 渲染分类独立聚合层 (Categorized Cluster)
    useEffect(() => {
        if (!leafletReady || !mapRef.current || !customPoints) return;
        const L = window.L;
        const categories = ['station', 'airport', 'anime', 'hotel', 'spot'];

        categories.forEach(type => {
            if (clusterGroupsRef.current[type]) {
                if (mapRef.current.hasLayer(clusterGroupsRef.current[type])) mapRef.current.removeLayer(clusterGroupsRef.current[type]);
                clusterGroupsRef.current[type].clearLayers();
            }
        });

        categories.forEach(type => {
            if (!clusterGroupsRef.current[type]) {
                const typeColor = TYPE_COLORS[type] || '#06b6d4';
                clusterGroupsRef.current[type] = L.markerClusterGroup({
                    chunkedLoading: true, spiderfyOnMaxZoom: true, showCoverageOnHover: false, maxClusterRadius: 40,
                    iconCreateFunction: function(cluster) {
                        const count = cluster.getChildCount();
                        let size = 36; if (count > 10) size = 44; if (count > 50) size = 52;
                        return L.divIcon({
                            html: `<div style="background-color: ${typeColor}; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: ${size > 40 ? '16px' : '14px'}; font-weight: 900; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 4px 12px ${typeColor}90; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${count}</div>`,
                            className: 'custom-cluster-icon', iconSize: L.point(size, size)
                        });
                    }
                });
            }
        });

        const markersByType = { station: [], airport: [], anime: [], hotel: [], spot: [] };
        customPoints.forEach(pt => {
            const filterType = getPointFilterType(pt);
            if (!filters[filterType]) return;

            const style = getIconStyle(pt.category, pt.source);
            const customIcon = L.divIcon({
                className: 'custom-pin',
                html: `<div style="background-color: ${style.color}; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">${style.icon}</div>`,
                iconSize: [28, 28], iconAnchor: [14, 14]
            });
            
            const marker = L.marker([pt.lat, pt.lon], { icon: customIcon })
                .bindPopup(`
                    <div style="min-width: 160px; font-family: sans-serif;">
                        <b style="font-size:14px;">${style.icon} ${pt.name}</b><br/>
                        <div style="margin-top:4px; font-size:11px; color:#666; background:#f3f4f6; padding:2px 6px; border-radius:4px; display:inline-block;">${pt.source}</div>
                        <div style="margin-top: 6px; font-size: 10px; color: #9ca3af; font-family: monospace;">GPS: ${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)}</div>
                        <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px; text-align: right;">
                            <button onclick="window.__deleteCustomPoint('${pt.id}')" style="background-color: #fee2e2; color: #b91c1c; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%; transition: background 0.2s;" onmouseover="this.style.backgroundColor='#fecaca'" onmouseout="this.style.backgroundColor='#fee2e2'">🗑️ 删除此机位</button>
                        </div>
                    </div>
                `);
            markersByType[filterType].push(marker);
        });

        categories.forEach(type => {
            if (markersByType[type].length > 0) {
                clusterGroupsRef.current[type].addLayers(markersByType[type]);
                if (filters[type]) mapRef.current.addLayer(clusterGroupsRef.current[type]);
            }
        });
    }, [leafletReady, customPoints, filters]);


    // 👇 =====================================================================
    // 📏 独立模块：测距雷达引擎 (低耦合插件)
    // =====================================================================
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        const map = mapRef.current;

        if (!measureLayerRef.current) measureLayerRef.current = L.layerGroup().addTo(map);
        const layer = measureLayerRef.current;
        layer.clearLayers();

        if (measurePoints.length > 0) {
            L.circleMarker(measurePoints[0], { radius: 6, color: '#facc15', fillColor: '#111827', fillOpacity: 1, weight: 3 }).addTo(layer);
        }
        if (measurePoints.length === 2) {
            L.circleMarker(measurePoints[1], { radius: 6, color: '#facc15', fillColor: '#111827', fillOpacity: 1, weight: 3 }).addTo(layer);
            L.polyline(measurePoints, { color: '#facc15', dashArray: '8, 8', weight: 3, opacity: 0.8 }).addTo(layer);
            setMeasureDistance(map.distance(measurePoints[0], measurePoints[1])); // Leaflet 原生高精度球面测距
        }

        const onMapClick = (e) => {
            if (!isMeasuring) return;
            if (measurePoints.length === 0 || measurePoints.length === 2) {
                setMeasurePoints([e.latlng]); setMeasureDistance(0);
            } else if (measurePoints.length === 1) {
                setMeasurePoints([measurePoints[0], e.latlng]);
                setIsMeasuring(false); // 测完自动退出瞄准模式
            }
        };

        if (isMeasuring) {
            map.on('click', onMapClick);
            map._container.style.cursor = 'crosshair'; // 变身为十字瞄准星！
        } else {
            map.off('click', onMapClick);
            map._container.style.cursor = '';
        }

        return () => map.off('click', onMapClick);
    }, [leafletReady, isMeasuring, measurePoints]);

    const clearMeasurement = () => {
        setMeasurePoints([]); setMeasureDistance(0); setIsMeasuring(false);
        if (measureLayerRef.current) measureLayerRef.current.clearLayers();
    };


    // 👇 =====================================================================
    // 🌤️ 独立模块：城市气象全息投影 (只在开启气象雷达时显示)
    // =====================================================================
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        const map = mapRef.current;

        if (!cityWeatherNodesRef.current) cityWeatherNodesRef.current = L.layerGroup().addTo(map);
        const layer = cityWeatherNodesRef.current;
        layer.clearLayers();

        // 只有开启气象图层时，才加载城市节点面板
        if (weatherType === 'none' || OWM_API_KEY === 'YOUR_API_KEY_HERE') return;

        GLOBAL_WEATHER_NODES.forEach(async (city) => {
            try {
                // 请求当前实时气象数据
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${OWM_API_KEY}&units=metric&lang=zh_cn`);
                const data = await res.json();
                if (!data.weather) return;

                const temp = Math.round(data.main.temp);
                const desc = data.weather[0].description;
                const iconId = data.weather[0].icon;
                
               // 🧠 极客推演：把长串文字压缩成一个纯粹的“防晒指示灯”
                let uvColor = '#fbbf24'; // 黄色 (适中)
                let uvTitle = 'UV推演: 适中';
                if (data.clouds.all < 20 && data.weather[0].main === 'Clear') {
                    uvColor = '#ef4444'; uvTitle = 'UV推演: 极强 (注意防晒)'; // 红色
                } else if (data.clouds.all > 80 || ['Rain', 'Snow', 'Drizzle', 'Thunderstorm'].includes(data.weather[0].main)) {
                    uvColor = '#94a3b8'; uvTitle = 'UV推演: 微弱'; // 灰色
                }

                // 极简科幻胶囊 UI：只占极小的空间，图标+城市+温度+指示灯
                const iconUrl = `https://openweathermap.org/img/wn/${iconId}.png`;
                const nodeHtml = `
                    <div style="background: rgba(17, 24, 39, 0.75); border: 1px solid rgba(255, 255, 255, 0.2); backdrop-filter: blur(4px); color: white; padding: 4px 10px 4px 6px; border-radius: 20px; width: max-content; box-shadow: 0 4px 10px rgba(0,0,0,0.5); pointer-events: auto; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 6px; cursor: help;" title="${desc} | ${uvTitle}">
                        <img src="${iconUrl}" style="width: 22px; height: 22px; margin: -4px 0;" />
                        <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px;">${city.name}</span>
                        <span style="font-size: 13px; font-weight: 900; color: #38bdf8;">${temp}°</span>
                        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: ${uvColor}; box-shadow: 0 0 6px ${uvColor}; margin-left: 2px;"></div>
                    </div>
                `;

                L.marker([city.lat, city.lon], {
                    icon: L.divIcon({ className: 'weather-hologram', html: nodeHtml, iconSize: [0, 0] }),
                    zIndexOffset: 1000 // 保证气象面板浮在最上面
                }).addTo(layer);

            } catch (err) {
                console.error(`无法获取 ${city.name} 的气象数据`, err);
            }
        });

    }, [leafletReady, weatherType]); 
    // 👆 =====================================================================



    useEffect(() => {
        if (isActive && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 200);
    }, [isActive]);

    return (
        <div className={`${isActive ? 'block' : 'hidden'} flex flex-col gap-4 animate-in slide-in-from-bottom duration-500`}>
            
            {/* 上半部分：地图展示层 */}
            <div className="relative h-[60vh] md:h-[480px] rounded-[2rem] overflow-hidden shadow-xl border border-gray-200">
                <div className="absolute top-4 left-6 z-[1000] pointer-events-none">
                    <div className="bg-zinc-900/95 backdrop-blur text-white px-5 py-3 rounded-xl shadow-lg border border-zinc-700 pointer-events-auto flex items-center space-x-3">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${weatherType !== 'none' ? 'bg-rose-500' : 'bg-cyan-500'}`}></span>
                        <div className="w-px h-4 bg-zinc-700 mx-2"></div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider flex items-center">
                            {baseMapType === 'dark' ? 'Dark Mode' : 'Esri Topo'} 
                            {weatherType === 'precipitation_new' && ' + Rain Radar'}
                            {weatherType === 'clouds_new' && ' + Cloud Radar'}
                        </span>
                    </div>
                </div>
                
                {/* 👇 测距雷达 HUD 悬浮面板 */}
                <div className="absolute top-4 right-6 z-[1000] flex flex-col items-end gap-2 pointer-events-none">
                    <button 
                        onClick={() => { setIsMeasuring(!isMeasuring); if(!isMeasuring) { setMeasurePoints([]); setMeasureDistance(0); } }}
                        className={`pointer-events-auto px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center transition-all border-2 ${isMeasuring ? 'bg-yellow-400 text-yellow-900 border-yellow-500 animate-pulse' : 'bg-zinc-900/90 text-yellow-400 border-zinc-700 hover:bg-zinc-800 backdrop-blur-sm'}`}
                    >
                        <Ruler className="w-4 h-4 mr-2" />
                        {isMeasuring ? '瞄准中 (点击地图两点)...' : '启动测距雷达'}
                    </button>

                    {measurePoints.length === 2 && (
                        <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-xl shadow-lg border border-yellow-500/50 flex flex-col items-end animate-in fade-in zoom-in duration-300">
                            <span className="text-[10px] text-yellow-400/80 font-mono font-bold mb-1 uppercase">直线物理距离</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-yellow-400">{(measureDistance / 1000).toFixed(2)}</span>
                                <span className="text-sm font-bold text-zinc-400">km</span>
                            </div>
                            <button onClick={clearMeasurement} className="mt-2 text-[10px] text-zinc-400 hover:text-red-400 transition-colors flex items-center bg-zinc-800 px-2 py-1 rounded">
                                <X className="w-3 h-3 mr-1" /> 清除雷达数据
                            </button>
                        </div>
                    )}
                </div>
                

                <div id="real-map-container" className="w-full h-full z-10" style={{ background: baseMapType === 'dark' ? '#1a1a1a' : '#e5e5f7' }}></div>
                
                {!leafletReady && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-600 mx-auto mb-2" />
                            <p className="text-sm font-bold text-gray-600">加载全息空间引擎中...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 下半部分：高级控制台 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col gap-4">
                
                {/* 模块 A: 底图与气象雷达 (新增) */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center text-gray-500 font-bold text-sm shrink-0 w-24">
                        <Globe className="w-4 h-4 mr-2" /> 环境矩阵：
                    </div>
                    
                    {/* 底图切换器 */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => setBaseMapType('topo')} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center transition-all ${baseMapType === 'topo' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><MapIcon className="w-3 h-3 mr-1" /> 拓扑图</button>
                        <button onClick={() => setBaseMapType('satellite')} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center transition-all ${baseMapType === 'satellite' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Globe className="w-3 h-3 mr-1" /> 卫星图</button>
                        <button onClick={() => setBaseMapType('dark')} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center transition-all ${baseMapType === 'dark' ? 'bg-zinc-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Moon className="w-3 h-3 mr-1" /> 暗黑终端</button>
                    </div>

                    <div className="hidden md:block w-px h-6 bg-gray-200 mx-2"></div>

                    {/* 气象雷达切换器 */}
                    <div className="flex bg-rose-50 p-1 rounded-xl border border-rose-100">
                        <button onClick={() => setWeatherType('none')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${weatherType === 'none' ? 'bg-white text-rose-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}>关闭气象</button>
                        <button onClick={() => setWeatherType('precipitation_new')} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center transition-all ${weatherType === 'precipitation_new' ? 'bg-white text-blue-600 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><CloudRain className="w-3 h-3 mr-1" /> 实时降雨</button>
                        <button onClick={() => setWeatherType('clouds_new')} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center transition-all ${weatherType === 'clouds_new' ? 'bg-white text-gray-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><Cloud className="w-3 h-3 mr-1" /> 卫星云图</button>
                    </div>
                </div>

                {/* 模块 B: 数据图层开关 (原逻辑) */}
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center text-gray-500 font-bold text-sm shrink-0 w-24">
                        <Filter className="w-4 h-4 mr-2" /> 数据覆盖：
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => toggleFilter('framework')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all border ${filters.framework ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}>🛤️ 青春18骨架</button>
                        {[
                            { id: 'station', label: '车站', icon: '🚉', color: 'blue' },
                            { id: 'airport', label: '机场', icon: '✈️', color: 'purple' },
                            { id: 'anime', label: '圣地巡礼', icon: '🌸', color: 'pink' },
                            { id: 'hotel', label: '住宿', icon: '🏨', color: 'orange' },
                            { id: 'spot', label: '默认地标', icon: '📍', color: 'cyan' },
                        ].map(btn => (
                            <button key={btn.id} onClick={() => toggleFilter(btn.id)} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all border ${filters[btn.id] ? `bg-${btn.color}-50 text-${btn.color}-700 border-${btn.color}-200 shadow-sm` : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}>
                                {btn.icon} {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

            </div>
            
        </div>
    );
};

export default MapEngine;