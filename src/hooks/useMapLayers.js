import { useEffect, useRef, useCallback } from 'react';
import { getIconStyle } from '../utils/helpers';
import { RAILWAY_LINES_CONFIG, TYPE_COLORS, GLOBAL_WEATHER_NODES, BASE_MAPS, OWM_API_KEY, getPointFilterType } from '../config/mapConstants';
import { generatePopupContent } from '../utils/photoEngine';
import { openCyberPanel } from '../utils/cyberPanel';

/** 战术锁定 HUD 准星 HTML（与地图选点共用） */
const TARGET_BEACON_HTML = `
    <div style="position: relative; width: 40px; height: 40px; transform: translate(-50%, -50%);">
        <div style="position: absolute; top: 0; left: 0; width: 10px; height: 10px; border-top: 2px solid #22d3ee; border-left: 2px solid #22d3ee;"></div>
        <div style="position: absolute; top: 0; right: 0; width: 10px; height: 10px; border-top: 2px solid #22d3ee; border-right: 2px solid #22d3ee;"></div>
        <div style="position: absolute; bottom: 0; left: 0; width: 10px; height: 10px; border-bottom: 2px solid #22d3ee; border-left: 2px solid #22d3ee;"></div>
        <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-bottom: 2px solid #22d3ee; border-right: 2px solid #22d3ee;"></div>
        <div style="position: absolute; top: 50%; left: 10px; right: 10px; height: 1px; background: rgba(168, 85, 247, 0.7); transform: translateY(-50%);"></div>
        <div style="position: absolute; left: 50%; top: 10px; bottom: 10px; width: 1px; background: rgba(168, 85, 247, 0.7); transform: translateX(-50%);"></div>
        <div style="position: absolute; top: 50%; left: 50%; width: 4px; height: 4px; background: #fff; border-radius: 50%; box-shadow: 0 0 10px #22d3ee, 0 0 20px #22d3ee; transform: translate(-50%, -50%); animation: beaconPulse 1.5s infinite;"></div>
        <style>@keyframes beaconPulse { 0% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); } 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); } }</style>
    </div>
`;

export const useMapLayers = (leafletReady, mapRef, baseMapType, weatherType, filters, customPoints, basePoints, isMeasuring = false) => {
    const baseMapLayerRef = useRef(null);
    const baseLayerRef = useRef(null);
    const clusterGroupsRef = useRef({}); 
    const weatherLayerRef = useRef(null); 
    const cityWeatherNodesRef = useRef(null);
    // 🎯 用于存放并管理“战术锁定信标”的引用，保证每次只有一个准星
    const targetBeaconRef = useRef(null);

    /** 将准星移动到指定经纬度并轻推镜头（铁道点 / 导入点 / 地图选点共用） */
    const updateTargetBeacon = useCallback((lat, lng) => {
        const map = mapRef.current;
        if (!map || !window.L) return;
        const L = window.L;
        map.panTo([lat, lng], { animate: true, duration: 0.6, easeLinearity: 0.25 });
        if (targetBeaconRef.current) {
            try {
                map.removeLayer(targetBeaconRef.current);
            } catch {
                /* ignore */
            }
            targetBeaconRef.current = null;
        }
        const beaconIcon = L.divIcon({
            html: TARGET_BEACON_HTML,
            className: 'target-beacon-icon',
            iconSize: [0, 0]
        });
        targetBeaconRef.current = L.marker([lat, lng], { icon: beaconIcon, zIndexOffset: 600 }).addTo(map);
    }, [mapRef]);

    // 1. 初始化底图
    useEffect(() => {
        if (!leafletReady || !document.getElementById('real-map-container')) return;
        const L = window.L;
        if (!mapRef.current) {
            mapRef.current = L.map('real-map-container', {zoomControl: false,worldCopyJump: true,minZoom: 3,maxBounds: [[-85, -Infinity], [85, Infinity]],maxBoundsViscosity: 1.0}).setView([37.5, 137.5], 4.5);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        if (baseMapLayerRef.current) mapRef.current.removeLayer(baseMapLayerRef.current);
        baseMapLayerRef.current = L.tileLayer(BASE_MAPS[baseMapType].url, { maxZoom: 19}).addTo(mapRef.current);
    }, [leafletReady, baseMapType, mapRef]);

    // 1b. 点击地图任意空白处：战术锁定、绘制信标并打开分析面板
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        const map = mapRef.current;
        
        const onMapPick = (e) => {
            if (isMeasuring) return;
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            updateTargetBeacon(lat, lng);

            openCyberPanel(
                generatePopupContent(
                    { lat, lon: lng, category: 'spot' },
                    'map_pick',
                    '🎯', // 换了个更有锁定感的 Emoji
                    '战术坐标锁定',
                    `WGS84 · ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`
                )
            );
        };
        
        map.on('click', onMapPick);
        return () => map.off('click', onMapPick);
    }, [leafletReady, isMeasuring, mapRef]);

    // 2. 渲染气象雷达层
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        if (weatherLayerRef.current) { mapRef.current.removeLayer(weatherLayerRef.current); weatherLayerRef.current = null; }
        if (weatherType !== 'none') weatherLayerRef.current = L.tileLayer(`https://tile.openweathermap.org/map/${weatherType}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, { opacity: 0.8, zIndex: 10 }).addTo(mapRef.current);
    }, [leafletReady, weatherType, mapRef]);

    // 3. 渲染骨架线与基础站点
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L;
        if (!baseLayerRef.current) baseLayerRef.current = L.layerGroup().addTo(mapRef.current);
        baseLayerRef.current.clearLayers();
        if (filters.framework) {
            RAILWAY_LINES_CONFIG.forEach(line => {
                const coords = line.points.map(id => { const pt = basePoints.find(p => p.id === id); return pt ? [pt.lat, pt.lon] : null; }).filter(Boolean);
                if (coords.length > 0) L.polyline(coords, { color: line.color, weight: 3, dashArray: line.dashArray }).addTo(baseLayerRef.current);
            });
            basePoints.forEach((pt, idx) => {
                let color = pt.type === 'shinkansen' ? '#f97316' : pt.type === 'ferry' || pt.type === 'plane' ? '#3b82f6' : '#22c55e';
                const openBasePanel = (ev) => {
                    L.DomEvent.stop(ev);
                    updateTargetBeacon(pt.lat, pt.lon);
                    openCyberPanel(generatePopupContent(pt, `base_${idx}`, '🛤️', pt.name, pt.desc));
                };
                L.circleMarker([pt.lat, pt.lon], { radius: 10, fillColor: color, color: 'transparent', fillOpacity: 0.2 }).on('click', openBasePanel).addTo(baseLayerRef.current);
                L.circleMarker([pt.lat, pt.lon], { radius: 5, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 }).on('click', openBasePanel).addTo(baseLayerRef.current);
            });
        }
    }, [leafletReady, basePoints, filters.framework, mapRef, updateTargetBeacon]);

    // 4. 渲染自定义标记与聚合点炸开
    useEffect(() => {
        if (!leafletReady || !mapRef.current || !customPoints) return;
        const L = window.L; const categories = ['station', 'airport', 'anime', 'hotel', 'spot'];
        categories.forEach(type => { if (clusterGroupsRef.current[type]) { mapRef.current.removeLayer(clusterGroupsRef.current[type]); clusterGroupsRef.current[type].clearLayers(); } });

        categories.forEach(type => {
            if (!clusterGroupsRef.current[type]) {
                const typeColor = TYPE_COLORS[type] || '#06b6d4';
                const clusterGroup = L.markerClusterGroup({
                    chunkedLoading: true, 
                    spiderfyOnMaxZoom: true, 
                    showCoverageOnHover: false, 
                    maxClusterRadius: 40, 
                    zoomToBoundsOnClick: false, 
                    iconCreateFunction: function(cluster) {
                        const count = cluster.getChildCount(); let size = count > 10 ? 44 : 36;
                        return L.divIcon({ html: `<div style="background-color: ${typeColor}; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 4px 12px ${typeColor}90; cursor: pointer;">${count}</div>`, className: 'custom-cluster-icon', iconSize: L.point(size, size) });
                    }
                });

                clusterGroup.on('clusterclick', function (a) {
                    const map = mapRef.current;
                    map.fitBounds(a.layer.getBounds(), { padding: [50, 50], duration: 1.2, animate: true, easeLinearity: 0.25, maxZoom: 17 });
                });

                clusterGroupsRef.current[type] = clusterGroup;
            }
        });

        const markersByType = { station: [], airport: [], anime: [], hotel: [], spot: [] };
        customPoints.forEach(pt => {
            const filterType = getPointFilterType(pt); if (!filters[filterType]) return;
            const style = getIconStyle(pt.category, pt.source);
            const customIcon = L.divIcon({ className: 'custom-pin', html: `<div style="background-color: ${style.color}; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">${style.icon}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
            const mk = L.marker([pt.lat, pt.lon], { icon: customIcon });
            mk.on('click', (ev) => {
                if (ev.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
                updateTargetBeacon(pt.lat, pt.lon);
                openCyberPanel(generatePopupContent(pt, `custom_${pt.id}`, style.icon, pt.name, pt.source));
            });
            markersByType[filterType].push(mk);
        });
        categories.forEach(type => { if (markersByType[type].length > 0) { clusterGroupsRef.current[type].addLayers(markersByType[type]); if (filters[type]) mapRef.current.addLayer(clusterGroupsRef.current[type]); } });
    }, [leafletReady, customPoints, filters, mapRef, updateTargetBeacon]);

    // 5. 渲染 12 个城市气象标靶
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L; const map = mapRef.current;
        if (!cityWeatherNodesRef.current) cityWeatherNodesRef.current = L.layerGroup().addTo(map);
        cityWeatherNodesRef.current.clearLayers();
        if (weatherType === 'none' || OWM_API_KEY === 'YOUR_API_KEY_HERE') return;
        GLOBAL_WEATHER_NODES.forEach(async (city) => {
            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${OWM_API_KEY}&units=metric&lang=zh_cn`);
                const data = await res.json(); if (!data.weather) return;
                const nodeHtml = `<div style="background: rgba(17,24,39,0.75); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(4px); color: white; padding: 4px 10px; border-radius: 20px; display: flex; align-items: center; gap: 6px;"><img src="https://openweathermap.org/img/wn/${data.weather[0].icon}.png" style="width: 22px; height: 22px; margin: -4px 0;" /><span style="font-size: 11px; font-weight: 800;">${city.name}</span><span style="font-size: 13px; color: #38bdf8;">${Math.round(data.main.temp)}°</span></div>`;
                L.marker([city.lat, city.lon], { icon: L.divIcon({ html: nodeHtml, iconSize: [0,0] }) }).addTo(cityWeatherNodesRef.current);
            } catch {
                /* 单城天气请求失败时跳过 */
            }
        });
    }, [leafletReady, weatherType, mapRef]);
};