// src/components/MapboxMapTactical.jsx
// 🗺️ Dark 2D Mapbox 地图组件 - 带限流保护

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { debounce } from '../utils/performanceHelpers';

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
  bearing = 0
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const flyToDebouncedRef = useRef(null); // 🛡️ 防抖函数引用

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
        setIsLoaded(true);
      });

      // 🖱️ 地图点击事件
      if (onMapClick) {
        map.current.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          onMapClick({ longitude: lng, latitude: lat });
        });
      }

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

    // 🛡️ 创建或更新防抖函数
    if (!flyToDebouncedRef.current) {
      flyToDebouncedRef.current = debounce(() => {
        if (map.current) {
          map.current.flyTo({
            center: center,
            zoom: zoom,
            duration: 2000,
            essential: true
          });
        }
      }, 500); // 500ms 防抖
    }

    flyToDebouncedRef.current();
  }, [center, zoom, isLoaded]);

  // 📍 渲染自定义标记点
  useEffect(() => {
    if (!map.current || !customPoints.length || !isLoaded) return;

    // 清除现有标记
    const existingMarkers = document.querySelectorAll('.custom-dark-marker');
    existingMarkers.forEach(marker => marker.remove());

    // 移除现有数据源和图层
    if (map.current.getSource('custom-points')) {
      map.current.removeLayer('custom-points-circle');
      map.current.removeLayer('custom-points-label');
      map.current.removeSource('custom-points');
    }

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

    // 🖱️ 鼠标悬停效果
    map.current.on('mouseenter', 'custom-points-circle', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'custom-points-circle', () => {
      map.current.getCanvas().style.cursor = '';
    });

  }, [customPoints, isLoaded]);

  return (
    <>
      {/* 🗺️ 地图容器 */}
      <div
        ref={mapContainer}
        className="mapbox-map-dark"
        style={{ width: '100%', height: '100%' }}
      />

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
      `}</style>
    </>
  );
}
