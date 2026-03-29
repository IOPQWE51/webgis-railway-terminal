import { useEffect, useRef } from 'react';
import { getIconStyle } from '../utils/helpers';
import { RAILWAY_LINES_CONFIG, TYPE_COLORS, GLOBAL_WEATHER_NODES, BASE_MAPS, OWM_API_KEY, getPointFilterType } from '../config/mapConstants';
import { generatePopupContent } from '../utils/photoEngine';
import { openCyberPanel } from '../utils/cyberPanel';

export const useMapLayers = (leafletReady, mapRef, baseMapType, weatherType, filters, customPoints, basePoints, isMeasuring = false) => {
    const baseMapLayerRef = useRef(null);
    const baseLayerRef = useRef(null);
    const clusterGroupsRef = useRef({}); 
    const weatherLayerRef = useRef(null); 
    const cityWeatherNodesRef = useRef(null);

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

    // 1b. 点击地图任意空白处：用该经纬度打开摄影分析（测距取点时不起效）
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const map = mapRef.current;
        const onMapPick = (e) => {
            if (isMeasuring) return;
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            openCyberPanel(
                generatePopupContent(
                    { lat, lon: lng, category: 'spot' },
                    'map_pick',
                    '📌',
                    '地图选点',
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
                    // 🛑 核心修复：使用 Leaflet 原生 stop() 彻底斩断点击穿透！
                    L.DomEvent.stop(ev); 
                    openCyberPanel(generatePopupContent(pt, `base_${idx}`, '🛤️', pt.name, pt.desc));
                };
                L.circleMarker([pt.lat, pt.lon], { radius: 10, fillColor: color, color: 'transparent', fillOpacity: 0.2 }).on('click', openBasePanel).addTo(baseLayerRef.current);
                L.circleMarker([pt.lat, pt.lon], { radius: 5, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 }).on('click', openBasePanel).addTo(baseLayerRef.current);
            });
        }
    }, [leafletReady, basePoints, filters.framework, mapRef]);

    // 4. 渲染自定义标记与聚合点炸开 (带强制侵入式缩放)
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
                    zoomToBoundsOnClick: false, // 🛑 关闭原生无聊的缩放，我们自己接管！
                    iconCreateFunction: function(cluster) {
                        const count = cluster.getChildCount(); let size = count > 10 ? 44 : 36;
                        return L.divIcon({ html: `<div style="background-color: ${typeColor}; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 4px 12px ${typeColor}90; cursor: pointer;">${count}</div>`, className: 'custom-cluster-icon', iconSize: L.point(size, size) });
                    }
                });

                // 🚀 核心改动：智能缩放引擎 - 单击聚合点后，地图缩放到刚好装下所有点
                clusterGroup.on('clusterclick', function (a) {
                    const map = mapRef.current;
                    // 直接让地图适配聚合点的边界范围 + 内边距
                    map.fitBounds(a.layer.getBounds(), { 
                        padding: [50, 50], 
                        duration: 1.2,
                        animate: true,
                        easeLinearity: 0.25,
                        maxZoom: 17
                    });
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
                openCyberPanel(generatePopupContent(pt, `custom_${pt.id}`, style.icon, pt.name, pt.source));
            });
            markersByType[filterType].push(mk);
        });
        categories.forEach(type => { if (markersByType[type].length > 0) { clusterGroupsRef.current[type].addLayers(markersByType[type]); if (filters[type]) mapRef.current.addLayer(clusterGroupsRef.current[type]); } });
    }, [leafletReady, customPoints, filters, mapRef]);

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