// src/components/MapboxMapTactical.jsx
// 🗺️ Dark 2D Mapbox 地图组件 - 带限流保护

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { debounce } from '../utils/performanceHelpers';
import DarkTacticalHUD from './DarkTacticalHUD';

// 🔑 设置 Mapbox Token
if (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
} else {
  console.warn('⚠️ 未设置 VITE_MAPBOX_ACCESS_TOKEN 环境变量');
}

// 🛡️ 样式切换限流（防止频繁切换消耗配额）
let lastStyleChange = 0;
const STYLE_CHANGE_COOLDOWN = 2000; // 2秒冷却时间

export default function MapboxMapTactical({
  center = [139.6503, 35.6762], // 默认：东京
  zoom = 12,
  customPoints = [],
  onMapClick = null,
  styleUrl = 'mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z', // Dark 2D 样式
  pitch = 0,
  bearing = 0,
  clickedCoord = null, // 🖱️ 点击的坐标（显示面板用）
  userLocation = null // 📍 用户当前位置（幽灵蓝）
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const radarMarkerRef = useRef(null); // 🎯 雷达准星引用
  const userMarkerRef = useRef(null); // 📍 用户位置标记引用
  const coordMarkerRef = useRef(null); // 🖱️ 点击位置方框标记引用
  const clickHandlerRef = useRef(null); // 🎯 点击事件处理器引用（用于防重复绑定）
  const mouseEnterHandlerRef = useRef(null); // 🖱️ 鼠标进入处理器引用
  const mouseLeaveHandlerRef = useRef(null); // 🖱️ 鼠标离开处理器引用
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null); // 🎯 当前选中的站点

  // 🖱️ 监听 clickedCoord 变化，显示坐标面板 + 方框标记
  useEffect(() => {
    if (!clickedCoord) return;

    const { longitude, latitude } = clickedCoord;

    // 创建临时坐标数据用于显示面板
    const coordData = {
      id: `coord_${Date.now()}`,
      name: `坐标 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      lat: latitude,
      lon: longitude,
      category: 'spot',
      source: '地图点击'
    };

    setSelectedStation(coordData);

    // 🎯 渲染点击位置的战术方框标记（白色）
    if (!map.current || !isLoaded) return;

    // 清除旧的点击位置标记
    if (coordMarkerRef.current) {
      coordMarkerRef.current.remove();
      coordMarkerRef.current = null;
    }

    // 创建战术方框标记元素
    const coordEl = document.createElement('div');
    coordEl.innerHTML = `
      <div style="position: relative; width: 50px; height: 50px;">
        <!-- 战术方框 -->
        <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8)); z-index: 2; position: absolute; top: 0; left: 0;">
          <!-- 外框 -->
          <rect x="8" y="8" width="34" height="34" fill="none" stroke="#ffffff" stroke-width="2" rx="2"/>
          <!-- 四角 -->
          <path d="M8 16 L8 8 L16 8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
          <path d="M34 8 L42 8 L42 16" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
          <path d="M42 34 L42 42 L34 42" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
          <path d="M16 42 L8 42 L8 34" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
          <!-- 中心点 -->
          <circle cx="25" cy="25" r="3" fill="#ffffff"/>
        </svg>
        <!-- 脉冲动画 -->
        <div style="position: absolute; top: 50%; left: 50%; width: 40px; height: 40px; border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 4px; transform: translate(-50%, -50%); animation: coordBoxPulse 1.5s ease-out infinite;"></div>
      </div>
    `;

    coordMarkerRef.current = new mapboxgl.Marker({
      element: coordEl,
      anchor: 'center'
    })
      .setLngLat([longitude, latitude])
      .addTo(map.current);

    // 37秒后自动消失
    setTimeout(() => {
      if (coordMarkerRef.current) {
        coordMarkerRef.current.remove();
        coordMarkerRef.current = null;
      }
    }, 37000);

    console.log('🎯 点击位置标记已添加');
  }, [clickedCoord, isLoaded]);

  // 📍 渲染用户位置标记（幽灵蓝雷达波）
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // 清除旧的用户位置标记
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

    // 创建用户位置标记元素
    const userEl = document.createElement('div');
    userEl.innerHTML = USER_LOCATION_HTML;
    userEl.className = 'user-location-marker';

    userMarkerRef.current = new mapboxgl.Marker({
      element: userEl,
      anchor: 'center'
    })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(map.current);

    console.log('📍 用户位置已更新:', userLocation);
  }, [userLocation, isLoaded]);

  // 🚪 关闭 HUD
  const handleCloseHUD = () => {
    setSelectedStation(null);
    // 移除雷达准星
    if (radarMarkerRef.current) {
      radarMarkerRef.current.remove();
      radarMarkerRef.current = null;
    }
  };

  // 🎯 雷达准星 HTML（Dark 2D 风格）
  const TACTICAL_BEACON_HTML = `
    <div style="position: relative; width: 60px; height: 60px;">
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); z-index: 2; position: absolute; top: 0; left: 0;">
        <circle cx="30" cy="30" r="24" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.8"/>
        <circle cx="30" cy="30" r="18" stroke="#fbbf24" stroke-width="2" stroke-dasharray="14 14" stroke-dashoffset="7"/>
        <line x1="30" y1="12" x2="30" y2="18" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="30" y1="42" x2="30" y2="48" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="12" y1="30" x2="18" y2="30" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="42" y1="30" x2="48" y2="30" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="30" cy="30" r="2.5" fill="#fbbf24"/>
      </svg>
      <div class="tactical-radar-pulse"></div>
    </div>
  `;

  // 📍 用户位置 HTML（幽灵蓝雷达波）- 自机位
  const USER_LOCATION_HTML = `
    <div style="position: relative; width: 70px; height: 70px;">
      <!-- 外圈雷达波 - 动态扩散 -->
      <div class="user-radar-wave-1"></div>
      <div class="user-radar-wave-2"></div>
      <div class="user-radar-wave-3"></div>
      <!-- 核心标记 -->
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 20px rgba(14, 165, 233, 0.9)); z-index: 3; position: absolute; top: 0; left: 0;">
        <!-- 外圈虚线环 -->
        <circle cx="35" cy="35" r="28" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>
        <!-- 中圈实线环 -->
        <circle cx="35" cy="35" r="20" stroke="#0ea5e9" stroke-width="2.5" opacity="0.9"/>
        <!-- 十字准星 -->
        <line x1="35" y1="10" x2="35" y2="20" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/>
        <line x1="35" y1="50" x2="35" y2="60" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/>
        <line x1="10" y1="35" x2="20" y2="35" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/>
        <line x1="50" y1="35" x2="60" y2="35" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/>
        <!-- 核心点（高亮） -->
        <circle cx="35" cy="35" r="5" fill="#0ea5e9"/>
        <circle cx="35" cy="35" r="2.5" fill="#ffffff"/>
      </svg>
    </div>
  `;

  // 🎨 初始化地图
  useEffect(() => {
    if (map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: center,
        zoom: zoom,
        pitch: pitch,
        bearing: bearing,
        antialias: true
      });

      // 📍 添加导航控件
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      // ✨ 地图加载完成
      map.current.on('load', () => {
        console.log('🗺️ Dark 2D 地图加载完成');

        // 🔍 调试：列出所有可用图层
        const style = map.current.getStyle();
        if (style && style.layers) {
          console.log('📋 Mapbox 图层列表:');
          style.layers.forEach(layer => {
            if (layer.type === 'symbol' || layer.id.includes('station') || layer.id.includes('poi') || layer.id.includes('transit')) {
              console.log(`  - ${layer.id} (${layer.type})`);
            }
          });
        }

        setIsLoaded(true);
      });

      // 🖱️ 地图点击事件 - 检测 POI 和普通点击
      map.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;

        // 🔍 检测是否点击了 Mapbox 的 POI
        const poiFeatures = map.current.queryRenderedFeatures(e.point, {
          layers: [] // 空数组 = 查询所有图层
        });

        console.log('🔍 点击位置检测到要素数量:', poiFeatures.length);
        if (poiFeatures.length > 0) {
          console.log('📋 要素列表:', poiFeatures.map(f => ({ layer: f.layer?.id, type: f.layer?.type, properties: f.properties })));
        }

        // 寻找交通站点相关的 POI
        const stationFeature = poiFeatures.find(f => {
          const layerId = f.layer?.id || '';
          const props = f.properties || {};
          // 检查图层 ID 或属性中是否包含站点相关关键词
          return layerId.includes('station') ||
                 layerId.includes('poi') ||
                 layerId.includes('transit') ||
                 props.category === 'station' ||
                 props.type === 'station' ||
                 props.class === 'station';
        });

        if (stationFeature) {
          const feature = stationFeature;
          const props = feature.properties;
          const coords = feature.geometry?.coordinates || [lng, lat];

          console.log('🎯 点击了站点 POI:', { layer: feature.layer?.id, properties: props });

          // 提取 POI 名称
          const poiName = props.name || props.title || props.station || props.description || '未知站点';

          // 设置选中的站点数据
          setSelectedStation({
            id: props.id || `poi_${Date.now()}`,
            name: poiName,
            lat: coords[1] || lat,
            lon: coords[0] || lng,
            category: 'spot',
            source: `Mapbox (${feature.layer?.id})`
          });

          return; // POI 点击处理完成
        }

        // 普通点击：触发 handleMapClick
        if (onMapClick) {
          onMapClick({ longitude: lng, latitude: lat });
        }
      });

    } catch (error) {
      console.error('❌ 地图初始化失败:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 🔄 动态切换地图样式（带限流保护）
  useEffect(() => {
    if (!map.current || !styleUrl || !isLoaded) return;

    const now = Date.now();
    const timeSinceLastChange = now - lastStyleChange;

    // 🛡️ 限流保护：如果距离上次切换不足 2 秒，延迟执行
    if (timeSinceLastChange < STYLE_CHANGE_COOLDOWN) {
      const delay = STYLE_CHANGE_COOLDOWN - timeSinceLastChange;
      console.log(`⏳ 样式切换冷却中，${Math.ceil(delay / 1000)}秒后执行`);
      const timer = setTimeout(() => {
        try {
          map.current.setStyle(styleUrl);
          lastStyleChange = Date.now();
          console.log('🎨 地图样式已切换:', styleUrl);
        } catch (error) {
          console.error('❌ 样式切换失败:', error);
        }
      }, delay);

      return () => clearTimeout(timer);
    }

    // 正常切换
    try {
      map.current.setStyle(styleUrl);
      lastStyleChange = now;
      console.log('🎨 地图样式已切换:', styleUrl);
    } catch (error) {
      console.error('❌ 样式切换失败:', error);
    }
  }, [styleUrl, isLoaded]);

  // 🔄 更新地图中心点（带防抖保护）
  useEffect(() => {
    if (!map.current || !center || !isLoaded) return;

    // 🛡️ 创建防抖函数（每次 center/zoom 变化时重新创建）
    const flyToDebounced = debounce(() => {
      if (map.current) {
        console.log('🎯 地图跳转中...', { center, zoom });
        map.current.flyTo({
          center: center,
          zoom: zoom,
          duration: 2000,
          essential: true
        });
      }
    }, 300); // 300ms 防抖，更快的响应

    flyToDebounced();
  }, [center, zoom, isLoaded]);

  // 📍 渲染自定义标记点
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // 🚑 移除旧的事件监听器（防止重复绑定）
    if (clickHandlerRef.current) {
      try {
        map.current.off('click', 'custom-points-circle', clickHandlerRef.current);
        map.current.off('mouseenter', 'custom-points-circle', mouseEnterHandlerRef.current);
        map.current.off('mouseleave', 'custom-points-circle', mouseLeaveHandlerRef.current);
      } catch (e) {
        // 图层可能不存在，忽略错误
      }
    }

    // 清除现有标记
    const existingMarkers = document.querySelectorAll('.custom-dark-marker');
    existingMarkers.forEach(marker => marker.remove());

    // 移除现有数据源和图层
    if (map.current.getSource('custom-points')) {
      map.current.removeLayer('custom-points-circle');
      map.current.removeLayer('custom-points-label');
      map.current.removeSource('custom-points');
    }

    // 如果没有点位，直接返回
    if (!customPoints.length) return;

    // 创建 GeoJSON 数据
    const geoJSONData = {
      type: 'FeatureCollection',
      features: customPoints.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat]
        },
        properties: {
          id: point.id,
          name: point.name,
          category: point.category || 'spot',
          source: point.source || '未知来源'
        }
      }))
    };

    // 添加数据源
    map.current.addSource('custom-points', {
      type: 'geojson',
      data: geoJSONData
    });

    // 添加圆形标记图层
    map.current.addLayer({
      id: 'custom-points-circle',
      type: 'circle',
      source: 'custom-points',
      paint: {
        'circle-radius': 8,
        'circle-color': '#fbbf24',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#1e293b',
        'circle-opacity': 0.9
      }
    });

    // 添加文本标签图层
    map.current.addLayer({
      id: 'custom-points-label',
      type: 'symbol',
      source: 'custom-points',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.25],
        'text-anchor': 'top',
        'text-size': 12
      },
      paint: {
        'text-color': '#fbbf24',
        'text-halo-color': '#1e293b',
        'text-halo-width': 2
      }
    });

    // 🖱️ 鼠标悬停效果处理器
    const mouseEnterHandler = () => {
      map.current.getCanvas().style.cursor = 'pointer';
    };
    mouseEnterHandlerRef.current = mouseEnterHandler;

    const mouseLeaveHandler = () => {
      map.current.getCanvas().style.cursor = '';
    };
    mouseLeaveHandlerRef.current = mouseLeaveHandler;

    // 🎯 点击标记显示 HUD + 雷达动画处理器
    const clickHandler = (e) => {
      console.log('🖱️ 点击标记触发'); // 🔥 调试日志

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['custom-points-circle']
      });

      if (features.length > 0) {
        const feature = features[0];
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        console.log('🎯 选中的站点:', props); // 🔥 调试日志

        // 创建站点数据对象
        const stationData = {
          id: props.id,
          name: props.name,
          lat: coords[1],
          lon: coords[0],
          category: props.category || 'spot',
          source: props.source || 'Dark 2D 标记'
        };

        // 更新选中状态
        setSelectedStation(stationData);

        // 🎯 添加/更新雷达准星
        if (radarMarkerRef.current) {
          radarMarkerRef.current.remove();
        }

        // 创建雷达准星元素
        const beaconEl = document.createElement('div');
        beaconEl.innerHTML = TACTICAL_BEACON_HTML;

        radarMarkerRef.current = new mapboxgl.Marker({
          element: beaconEl,
          anchor: 'center'
        })
          .setLngLat([coords[0], coords[1]])
          .addTo(map.current);
      }
    };
    clickHandlerRef.current = clickHandler;

    // 绑定事件监听器
    map.current.on('mouseenter', 'custom-points-circle', mouseEnterHandler);
    map.current.on('mouseleave', 'custom-points-circle', mouseLeaveHandler);
    map.current.on('click', 'custom-points-circle', clickHandler);

  }, [customPoints, isLoaded]);

  return (
    <>
      {/* 🗺️ 地图容器 */}
      <div
        ref={mapContainer}
        className="mapbox-map-dark"
        style={{ width: '100%', height: '100%' }}
      />

      {/* 🎯 Dark 2D 战术 HUD */}
      {selectedStation && (
        <DarkTacticalHUD
          stationData={selectedStation}
          onClose={handleCloseHUD}
        />
      )}

      {/* 🎨 Dark 2D 样式 */}
      <style>{`
        /* Mapbox 控件样式优化 */
        .mapboxgl-ctrl-group {
          background-color: rgba(30, 41, 59, 0.9) !important;
          border: 1px solid rgba(251, 191, 36, 0.3) !important;
        }

        .mapboxgl-ctrl-icon {
          filter: invert(1);
        }

        .mapboxgl-canvas {
          outline: none;
        }

        /* 🚫 隐藏版权声明，让 HUD 面板可以覆盖 */
        .mapboxgl-ctrl-attrib {
          display: none !important;
        }

        /* 🎯 战术雷达脉冲动画 */
        .tactical-radar-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          border: 1.5px solid #fbbf24;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: tacticalPulse 2.5s infinite ease-out;
          z-index: 1;
        }

        /* 🛰️ 战术节点发光装甲 */
        .tactical-node-gold {
            width: 12px;
            height: 12px;
            background-color: #fbbf24; /* 琥珀金 */
            border: 2px solid rgba(251, 191, 36, 0.5);
            border-radius: 50%;
            box-shadow: 0 0 15px #fbbf24, 0 0 5px #fbbf24 inset;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

.tactical-node-gold:hover {
    transform: scale(1.5);
    box-shadow: 0 0 25px #fbbf24, 0 0 10px #ffffff;
    background-color: #ffffff; /* 悬停变白，模拟过载发光 */
}





        @keyframes tacticalPulse {
          0% {
            opacity: 1;
            width: 10px;
            height: 10px;
          }
          100% {
            opacity: 0;
            width: 56px;
            height: 56px;
            border-width: 0.5px;
          }
        }

        /* 📍 用户位置雷达波 - 幽灵蓝三重扩散 */
        .user-radar-wave-1,
        .user-radar-wave-2,
        .user-radar-wave-3 {
          position: absolute;
          top: 50%;
          left: 50%;
          border: 2px solid #0ea5e9;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 1;
        }

        .user-radar-wave-1 {
          animation: userRadarWave 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .user-radar-wave-2 {
          animation: userRadarWave 2.4s cubic-bezier(0.4, 0, 0.2, 1) 0.8s infinite;
        }

        .user-radar-wave-3 {
          animation: userRadarWave 2.4s cubic-bezier(0.4, 0, 0.2, 1) 1.6s infinite;
        }

        @keyframes userRadarWave {
          0% {
            width: 20px;
            height: 20px;
            opacity: 0.8;
            border-width: 2px;
          }
          100% {
            width: 70px;
            height: 70px;
            opacity: 0;
            border-width: 0.5px;
          }
        }

        /* 📍 用户位置核心脉冲 */
        .user-location-marker svg {
          animation: userCorePulse 2s ease-in-out infinite;
        }

        @keyframes userCorePulse {
          0%, 100% {
            filter: drop-shadow(0 0 20px rgba(14, 165, 233, 0.9));
          }
          50% {
            filter: drop-shadow(0 0 35px rgba(14, 165, 233, 1));
          }
        }

        /* 🎯 点击位置方框脉冲 */
        @keyframes coordBoxPulse {
          0% {
            opacity: 1;
            width: 40px;
            height: 40px;
            border-width: 1px;
          }
          100% {
            opacity: 0;
            width: 60px;
            height: 60px;
            border-width: 0.5px;
          }
        }

      `}</style>
    </>
  );
}
