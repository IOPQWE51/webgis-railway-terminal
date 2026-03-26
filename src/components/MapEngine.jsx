import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Filter, CloudRain, Cloud, Map as MapIcon, Moon, Globe, Ruler, X, Layers, Target } from 'lucide-react';
import { getIconStyle } from '../utils/helpers';
import SearchNavEngine from './SearchNavEngine'; 

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
const GLOBAL_WEATHER_NODES = [
    { name: '北京', lat: 39.9042, lon: 116.4074 }, { name: '东京', lat: 35.6895, lon: 139.6917 }, { name: '新加坡', lat: 1.3521, lon: 103.8198 },
    { name: '悉尼', lat: -33.8688, lon: 151.2093 }, { name: '伦敦', lat: 51.5074, lon: -0.1278 }, { name: '巴黎', lat: 48.8566, lon: 2.3522 },
    { name: '纽约', lat: 40.7128, lon: -74.0060 }, { name: '洛杉矶', lat: 34.0522, lon: -118.2437 }
];

const getPointFilterType = (pt) => {
    const source = pt.source || ''; const type = pt.category || '';
    if (source.includes('车站') || type === 'station') return 'station';
    if (source.includes('机场') || type === 'airport' || type === 'plane') return 'airport';
    if (source.includes('圣地') || type === 'anime') return 'anime';
    if (source.includes('住') || type === 'hotel') return 'hotel';
    return 'spot';
};

const BASE_MAPS = {
    topo: { name: 'Esri 拓扑', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' },
    satellite: { name: '高清卫星', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' },
    dark: { name: '暗黑终端', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: 'OpenStreetMap' }
};

const OWM_API_KEY = 'f248f355671dcb0ffa5645c53823d4e5'; 

const MapEngine = ({ isActive, customPoints = [], basePoints = [], onDeletePoint }) => {
    const mapRef = useRef(null);
    const baseMapLayerRef = useRef(null);
    const baseLayerRef = useRef(null);
    const clusterGroupsRef = useRef({}); 
    const weatherLayerRef = useRef(null); 
    const cityWeatherNodesRef = useRef(null);
    const measureLayerRef = useRef(null);
    const searchMarkerRef = useRef(null);
    
    const [leafletReady, setLeafletReady] = useState(false);
    const [baseMapType, setBaseMapType] = useState('topo'); 
    const [weatherType, setWeatherType] = useState('none'); 
    const [filters, setFilters] = useState({ framework: true, station: true, airport: true, anime: true, hotel: true, spot: true });
    
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [measurePoints, setMeasurePoints] = useState([]); 
    const [measureDistance, setMeasureDistance] = useState(0); 

    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        window.__deleteCustomPoint = (id) => {
            if (window.confirm('⚠️ 确定删除此坐标点吗？')) {
                if (onDeletePoint) onDeletePoint(id);
                if (mapRef.current) mapRef.current.closePopup();
            }
        };
        return () => { delete window.__deleteCustomPoint; };
    }, [onDeletePoint]);

    const handleSearchLocationFound = (lat, lon, fullName, shortName) => {
        const map = mapRef.current;
        if (!map) return;
        const L = window.L;

        if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current);
        map.flyTo([lat, lon], 14, { duration: 1.5 });

        const popupContent = `
            <div style="min-width: 180px; font-family: sans-serif;">
                <b style="font-size:15px; color:#1f2937;">🎯 目标已锁定</b><br/>
                <div style="font-size:11px; color:#6b7280; margin: 4px 0 10px 0;">${fullName}</div>
                <div style="display: flex; gap: 8px;">
                    <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" style="flex: 1; text-align: center; background-color: #3b82f6; color: white; padding: 6px 0; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">📍 Google</a>
                    <a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(shortName)}" target="_blank" style="flex: 1; text-align: center; background-color: #ef4444; color: white; padding: 6px 0; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">🚃 Yahoo!</a>
                </div>
            </div>
        `;

        const targetIcon = L.divIcon({
            className: 'search-target-pin',
            html: `<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 3px solid white; box-shadow: 0 0 15px rgba(239,68,68,0.8); animation: pulse 1.5s infinite;">🎯</div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
        });

        searchMarkerRef.current = L.marker([lat, lon], { icon: targetIcon }).addTo(map).bindPopup(popupContent).openPopup();
    };

    // 核心初始化 (与你之前的逻辑一致，无需更改)
    useEffect(() => {
        const initLeafletSystem = async () => {
            const cssUrls = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css', 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css'];
            cssUrls.forEach(url => { if (!document.querySelector(`link[href="${url}"]`)) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; document.head.appendChild(link); } });
            if (!window.L) { await new Promise(resolve => { const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.onload = resolve; document.head.appendChild(script); }); }
            if (!window.L.markerClusterGroup) { await new Promise(resolve => { const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js'; script.onload = resolve; document.head.appendChild(script); }); }
            setLeafletReady(true);
        }; initLeafletSystem();
    }, []);

    useEffect(() => {
        if (!leafletReady || !document.getElementById('real-map-container')) return;
        const L = window.L;
        if (!mapRef.current) {
            mapRef.current = L.map('real-map-container', { zoomControl: false, zoomSnap: 0.5 }).setView([37.5, 137.5], 4.5);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        if (baseMapLayerRef.current) mapRef.current.removeLayer(baseMapLayerRef.current);
        baseMapLayerRef.current = L.tileLayer(BASE_MAPS[baseMapType].url, { attribution: BASE_MAPS[baseMapType].attribution, maxZoom: 19, zIndex: 1 }).addTo(mapRef.current);
    }, [leafletReady, baseMapType]);

    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        if (weatherLayerRef.current) { mapRef.current.removeLayer(weatherLayerRef.current); weatherLayerRef.current = null; }
        if (weatherType !== 'none') {
            if (OWM_API_KEY === 'YOUR_API_KEY_HERE') return;
            weatherLayerRef.current = L.tileLayer(`https://tile.openweathermap.org/map/${weatherType}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, { opacity: 0.8, maxZoom: 18, zIndex: 10 }).addTo(mapRef.current);
        }
    }, [leafletReady, weatherType]);

    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        if (!baseLayerRef.current) baseLayerRef.current = L.layerGroup().addTo(mapRef.current);
        baseLayerRef.current.clearLayers();
        if (filters.framework) {
            RAILWAY_LINES_CONFIG.forEach(line => {
                const coords = line.points.map(id => { const pt = basePoints.find(p => p.id === id); return pt ? [pt.lat, pt.lon] : null; }).filter(Boolean);
                if (coords.length > 0) L.polyline(coords, { color: line.color, weight: 3, dashArray: line.dashArray, opacity: 0.8 }).addTo(baseLayerRef.current);
            });
            basePoints.forEach(pt => {
                let color = pt.type === 'shinkansen' ? '#f97316' : pt.type === 'ferry' || pt.type === 'plane' ? '#3b82f6' : '#22c55e';
                L.circleMarker([pt.lat, pt.lon], { radius: 10, fillColor: color, color: 'transparent', fillOpacity: 0.2 }).addTo(baseLayerRef.current);
                L.circleMarker([pt.lat, pt.lon], { radius: 5, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 }).addTo(baseLayerRef.current)
                    .bindPopup(`<div style="font-family: sans-serif; min-width: 170px;"><b style="font-size:15px;">${pt.name}</b><br/><span style="font-size:12px; color:#6b7280;">${pt.desc}</span><div style="display: flex; gap: 8px; margin-top: 10px;"><a href="https://www.google.com/maps?q=${pt.lat},${pt.lon}" target="_blank" style="flex: 1; text-align: center; background-color: #3b82f6; color: white; padding: 6px 0; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">📍 Google</a><a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(pt.name)}" target="_blank" style="flex: 1; text-align: center; background-color: #ef4444; color: white; padding: 6px 0; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">🚃 Yahoo!</a></div></div>`);
            });
        }
    }, [leafletReady, basePoints, filters.framework]);

    useEffect(() => {
        if (!leafletReady || !mapRef.current || !customPoints) return;
        const L = window.L; const categories = ['station', 'airport', 'anime', 'hotel', 'spot'];
        categories.forEach(type => { if (clusterGroupsRef.current[type]) { mapRef.current.removeLayer(clusterGroupsRef.current[type]); clusterGroupsRef.current[type].clearLayers(); } });
        categories.forEach(type => {
            if (!clusterGroupsRef.current[type]) {
                const typeColor = TYPE_COLORS[type] || '#06b6d4';
                const clusterGroup = L.markerClusterGroup({
                    chunkedLoading: true, spiderfyOnMaxZoom: true, showCoverageOnHover: false, maxClusterRadius: 40, zoomToBoundsOnClick: false,
                    iconCreateFunction: function(cluster) {
                        const count = cluster.getChildCount(); let size = 36; if (count > 10) size = 44; if (count > 50) size = 52;
                        return L.divIcon({ html: `<div style="background-color: ${typeColor}; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: ${size > 40 ? '16px' : '14px'}; font-weight: 900; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 4px 12px ${typeColor}90; pointer-events: none;">${count}</div>`, className: 'custom-cluster-icon', iconSize: L.point(size, size) });
                    }
                });
                clusterGroup.on('clusterclick', function (a) { if (mapRef.current.getZoom() === mapRef.current.getMaxZoom()) a.layer.spiderfy(); else a.layer.zoomToBounds({ padding: [40, 40] }); });
                clusterGroupsRef.current[type] = clusterGroup;
            }
        });
        const markersByType = { station: [], airport: [], anime: [], hotel: [], spot: [] };
        customPoints.forEach(pt => {
            const filterType = getPointFilterType(pt); if (!filters[filterType]) return;
            const style = getIconStyle(pt.category, pt.source);
            const customIcon = L.divIcon({ className: 'custom-pin', html: `<div style="background-color: ${style.color}; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">${style.icon}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
            const marker = L.marker([pt.lat, pt.lon], { icon: customIcon }).bindPopup(`<div style="min-width: 180px; font-family: sans-serif;"><b style="font-size:15px;">${style.icon} ${pt.name}</b><div style="margin-top:6px; font-size:11px; color:#4b5563;">${pt.source}</div><div style="display: flex; gap: 8px; margin-top: 12px;"><a href="https://www.google.com/maps?q=${pt.lat},${pt.lon}" target="_blank" style="flex: 1; text-align: center; background-color: #3b82f6; color: white; padding: 6px 0; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">📍 Google</a><a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(pt.name)}" target="_blank" style="flex: 1; text-align: center; background-color: #ef4444; color: white; padding: 6px 0; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">🚃 Yahoo!</a></div><div style="margin-top: 12px; border-top: 1px solid #e5e7eb; padding-top: 10px;"><button onclick="window.__deleteCustomPoint('${pt.id}')" style="background-color: #fee2e2; color: #b91c1c; border: none; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; width: 100%;">🗑️ 删除此机位</button></div></div>`);
            markersByType[filterType].push(marker);
        });
        categories.forEach(type => { if (markersByType[type].length > 0) { clusterGroupsRef.current[type].addLayers(markersByType[type]); if (filters[type]) mapRef.current.addLayer(clusterGroupsRef.current[type]); } });
    }, [leafletReady, customPoints, filters]);

    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L; const map = mapRef.current;
        if (!measureLayerRef.current) measureLayerRef.current = L.layerGroup().addTo(map);
        const layer = measureLayerRef.current; layer.clearLayers();
        if (measurePoints.length > 0) L.circleMarker(measurePoints[0], { radius: 6, color: '#facc15', fillColor: '#111827', fillOpacity: 1, weight: 3 }).addTo(layer);
        if (measurePoints.length === 2) { L.circleMarker(measurePoints[1], { radius: 6, color: '#facc15', fillColor: '#111827', fillOpacity: 1, weight: 3 }).addTo(layer); L.polyline(measurePoints, { color: '#facc15', dashArray: '8, 8', weight: 3, opacity: 0.8 }).addTo(layer); setMeasureDistance(map.distance(measurePoints[0], measurePoints[1])); }
        const onMapClick = (e) => { if (!isMeasuring) return; if (measurePoints.length === 0 || measurePoints.length === 2) { setMeasurePoints([e.latlng]); setMeasureDistance(0); } else if (measurePoints.length === 1) { setMeasurePoints([measurePoints[0], e.latlng]); setIsMeasuring(false); } };
        if (isMeasuring) { map.on('click', onMapClick); map._container.style.cursor = 'crosshair'; } else { map.off('click', onMapClick); map._container.style.cursor = ''; }
        return () => map.off('click', onMapClick);
    }, [leafletReady, isMeasuring, measurePoints]);

    const clearMeasurement = () => { setMeasurePoints([]); setMeasureDistance(0); setIsMeasuring(false); if (measureLayerRef.current) measureLayerRef.current.clearLayers(); };

    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L; const map = mapRef.current;
        if (!cityWeatherNodesRef.current) cityWeatherNodesRef.current = L.layerGroup().addTo(map);
        const layer = cityWeatherNodesRef.current; layer.clearLayers();
        if (weatherType === 'none' || OWM_API_KEY === 'YOUR_API_KEY_HERE') return;
        GLOBAL_WEATHER_NODES.forEach(async (city) => {
            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${OWM_API_KEY}&units=metric&lang=zh_cn`);
                const data = await res.json(); if (!data.weather) return;
                const temp = Math.round(data.main.temp); const desc = data.weather[0].description; const iconId = data.weather[0].icon;
                const nodeHtml = `<div style="background: rgba(17, 24, 39, 0.75); border: 1px solid rgba(255, 255, 255, 0.2); backdrop-filter: blur(4px); color: white; padding: 4px 10px 4px 6px; border-radius: 20px; width: max-content; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 6px;"><img src="https://openweathermap.org/img/wn/${iconId}.png" style="width: 22px; height: 22px; margin: -4px 0;" /><span style="font-size: 11px; font-weight: 800;">${city.name}</span><span style="font-size: 13px; font-weight: 900; color: #38bdf8;">${temp}°</span></div>`;
                L.marker([city.lat, city.lon], { icon: L.divIcon({ className: 'weather-hologram', html: nodeHtml, iconSize: [0, 0] }) }).addTo(layer);
            } catch (err) {}
        });
    }, [leafletReady, weatherType]); 

    useEffect(() => { if (isActive && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 200); }, [isActive]);

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500`}>
            
            {/* 🖥️ 全新架构：左右分栏 (Command Center Layout) */}
            <div className="flex flex-col lg:flex-row gap-5" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
                
                {/* 📍 左侧主屏：纯净全息地图 */}
                <div className="flex-1 relative rounded-[2rem] overflow-hidden shadow-2xl border border-gray-200">
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

                {/* 🎛️ 右侧中枢：控制台面板 */}
                <div className="w-full lg:w-[360px] flex flex-col gap-4 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-300">
                    
                    {/* 1. 搜索中枢 */}
                    <SearchNavEngine onLocationFound={handleSearchLocationFound} />

                    {/* 2. 测距雷达模块 */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                        <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider mb-3">
                            <Ruler className="w-4 h-4 mr-2" /> 战术雷达
                        </div>
                        <button 
                            onClick={() => { setIsMeasuring(!isMeasuring); if(!isMeasuring) { setMeasurePoints([]); setMeasureDistance(0); } }}
                            className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center transition-all border-2 ${isMeasuring ? 'bg-yellow-50 text-yellow-700 border-yellow-400 animate-pulse' : 'bg-zinc-900 text-yellow-400 border-zinc-900 hover:bg-zinc-800'}`}
                        >
                            <Target className="w-4 h-4 mr-2" />
                            {isMeasuring ? '系统瞄准中 (在地图点击两点)...' : '启动两点测距雷达'}
                        </button>

                        {measurePoints.length === 2 && (
                            <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] text-zinc-500 font-bold block uppercase">物理直线距离</span>
                                    <span className="text-xl font-black text-zinc-800">{(measureDistance / 1000).toFixed(2)} <span className="text-xs font-bold text-zinc-500">km</span></span>
                                </div>
                                <button onClick={clearMeasurement} className="text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg font-bold transition-colors">
                                    清除数据
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 3. 环境矩阵 (地图与天气) */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                        <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider mb-3">
                            <Globe className="w-4 h-4 mr-2" /> 环境矩阵
                        </div>
                        
                        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-3">
                            <button onClick={() => setBaseMapType('topo')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'topo' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><MapIcon className="w-3 h-3 mr-1" /> 拓扑</button>
                            <button onClick={() => setBaseMapType('satellite')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'satellite' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Globe className="w-3 h-3 mr-1" /> 卫星</button>
                            <button onClick={() => setBaseMapType('dark')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'dark' ? 'bg-zinc-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Moon className="w-3 h-3 mr-1" /> 暗黑</button>
                        </div>

                        <div className="flex bg-rose-50 p-1.5 rounded-xl border border-rose-100">
                            <button onClick={() => setWeatherType('none')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${weatherType === 'none' ? 'bg-white text-rose-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}>关闭</button>
                            <button onClick={() => setWeatherType('precipitation_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${weatherType === 'precipitation_new' ? 'bg-white text-blue-600 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><CloudRain className="w-3 h-3 mr-1" /> 降雨</button>
                            <button onClick={() => setWeatherType('clouds_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${weatherType === 'clouds_new' ? 'bg-white text-gray-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><Cloud className="w-3 h-3 mr-1" /> 云层</button>
                        </div>
                    </div>

                    {/* 4. 数据过滤器 */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex-1">
                        <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider mb-3">
                            <Layers className="w-4 h-4 mr-2" /> 数据图层
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => toggleFilter('framework')} className={`py-2 rounded-xl text-xs font-bold transition-all border ${filters.framework ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}>🛤️ 青春18骨架</button>
                            {[
                                { id: 'station', label: '核心车站', icon: '🚉', color: 'blue' },
                                { id: 'airport', label: '航空枢纽', icon: '✈️', color: 'purple' },
                                { id: 'anime', label: '次元圣地', icon: '🌸', color: 'pink' },
                                { id: 'hotel', label: '补给住宿', icon: '🏨', color: 'orange' },
                                { id: 'spot', label: '默认地标', icon: '📍', color: 'cyan' },
                            ].map(btn => (
                                <button key={btn.id} onClick={() => toggleFilter(btn.id)} className={`py-2 rounded-xl text-xs font-bold transition-all border ${filters[btn.id] ? `bg-${btn.color}-50 text-${btn.color}-700 border-${btn.color}-200 shadow-sm` : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}>
                                    {btn.icon} {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MapEngine;