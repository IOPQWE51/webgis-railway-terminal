// src/hooks/useMapTools.js
import { useState, useEffect, useRef } from 'react';
import { generatePopupContent } from '../utils/photoEngine';
import { openCyberPanel } from '../utils/cyberPanel';

export const useMapTools = (leafletReady, mapRef, setShowDrawer) => {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [measurePoints, setMeasurePoints] = useState([]);
    const [measureDistance, setMeasureDistance] = useState(0);
    const measureLayerRef = useRef(null);

    const [userLocation, setUserLocation] = useState(null);
    const [isLocating, setIsLocating] = useState(false);
    const userMarkerRef = useRef(null);
    const searchMarkerRef = useRef(null);

    // 1. 搜索跃迁逻辑
    const handleSearchLocationFound = (lat, lon, fullName) => {
        const map = mapRef.current; if (!map) return; const L = window.L;
        if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current);
        map.flyTo([lat, lon], 14, { duration: 1.5 });
        const targetIcon = L.divIcon({ className: 'search-target-pin', html: `<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 3px solid white; box-shadow: 0 0 15px rgba(239,68,68,0.8); animation: pulse 1.5s infinite;">🎯</div>`, iconSize: [32, 32], iconAnchor: [16, 16] });
        const showSearchPanel = () => openCyberPanel(generatePopupContent({ lat, lon }, 'search_target', '🎯', '目标锁定区', fullName));
        showSearchPanel();
        searchMarkerRef.current = L.marker([lat, lon], { icon: targetIcon }).addTo(map);
        searchMarkerRef.current.on('click', (ev) => {
            if (ev.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
            showSearchPanel();
        });
        if (window.innerWidth < 1024) setShowDrawer(false);
    };

    // 2. 玩家定位逻辑
    const locatePlayer = () => {
        if (!navigator.geolocation) return alert('不支持空间定位');
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                setIsLocating(false);
                if (window.innerWidth < 1024) setShowDrawer(false);
            },
            () => { alert('获取定位失败'); setIsLocating(false); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // 监听定位更新并渲染玩家标靶
    useEffect(() => {
        if (!leafletReady || !mapRef.current || !userLocation) return;
        const L = window.L; const map = mapRef.current;
        if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
        const { lat, lon } = userLocation;
        const userIcon = L.divIcon({ className: 'user-pin', html: `<div style="background-color: #06b6d4; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(6, 182, 212, 0.8); animation: pulse 2s infinite;"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
        const showUserPanel = () => openCyberPanel(generatePopupContent({ lat, lon }, 'user_gps', '📍', '玩家坐标', `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`));
        showUserPanel();
        userMarkerRef.current = L.marker([lat, lon], { icon: userIcon }).addTo(map);
        userMarkerRef.current.on('click', (ev) => {
            if (ev.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
            showUserPanel();
        });
        map.flyTo([lat, lon], 15);
    }, [leafletReady, userLocation, mapRef]);

    // 3. 测距雷达逻辑
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const L = window.L; const map = mapRef.current;
        if (!measureLayerRef.current) measureLayerRef.current = L.layerGroup().addTo(map);
        const layer = measureLayerRef.current; layer.clearLayers();
        
        if (measurePoints.length > 0) L.circleMarker(measurePoints[0], { radius: 6, color: '#facc15', fillColor: '#111827', fillOpacity: 1, weight: 3 }).addTo(layer);
        
        if (measurePoints.length === 2) { 
            L.circleMarker(measurePoints[1], { radius: 6, color: '#facc15', fillColor: '#111827', fillOpacity: 1, weight: 3 }).addTo(layer); 
            L.polyline(measurePoints, { color: '#facc15', dashArray: '8, 8', weight: 3 }).addTo(layer); 
            // 实时计算两点距离
            setMeasureDistance(map.distance(measurePoints[0], measurePoints[1])); 
        }
        
        const onMapClick = (e) => { 
            if (!isMeasuring) return; 
            
            // 1. 如果还没画，或者已经画完了一条线，点击地图就重新开始画第一点
            if (measurePoints.length === 0 || measurePoints.length === 2) { 
                setMeasurePoints([e.latlng]); 
                setMeasureDistance(0); 
            } 
            // 2. 如果已经有一个点了，点击地图就落定第二个点，完成连线！
            else if (measurePoints.length === 1) { 
                setMeasurePoints([measurePoints[0], e.latlng]); 
                // 🛑 核心修复：删掉了 setIsMeasuring(false)，保持雷达持续开启！
            } 
        };
        
        if (isMeasuring) {
            map.on('click', onMapClick);
        } else {
            map.off('click', onMapClick);
        }
        return () => map.off('click', onMapClick);
    }, [leafletReady, isMeasuring, measurePoints, mapRef]);

    // 🗑️ 垃圾桶功能：只清空线和数据，但不退出雷达模式！
    const clearMeasurement = () => { 
        setMeasurePoints([]); 
        setMeasureDistance(0); 
        // 🛑 核心修复：删掉 setIsMeasuring(false)
        if (measureLayerRef.current) measureLayerRef.current.clearLayers(); 
    };

    // ✖️ 退出功能：真正关闭雷达，销毁 HUD 和数据
    const exitMeasurement = () => {
        setMeasurePoints([]); 
        setMeasureDistance(0); 
        setIsMeasuring(false); // 只有这里才能真正关掉模式！
        if (measureLayerRef.current) measureLayerRef.current.clearLayers(); 
    };

    return { 
        handleSearchLocationFound, locatePlayer, isLocating, 
        isMeasuring, setIsMeasuring, measurePoints, setMeasurePoints, measureDistance, setMeasureDistance, 
        clearMeasurement, exitMeasurement // 🚀 别忘了把新增的 exitMeasurement 导出去！
    };
};