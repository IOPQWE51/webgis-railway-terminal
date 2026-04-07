// src/components/MapboxMap.jsx
// 🗺️ Mapbox 地图组件 - 霓虹金铁路样式

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// 🔑 设置 Mapbox Token
// 注意：前端使用 Public Token（VITE_ 前缀）
if (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
} else {
  console.warn('⚠️ 未设置 VITE_MAPBOX_ACCESS_TOKEN 环境变量');
}

export default function MapboxMap({
  center = [139.6503, 35.6762], // 默认：东京
  zoom = 12,
  markers = [],
  onMapClick = null,
  styleUrl = 'mapbox://styles/mapbox/streets-v12', // 默认样式
  pitch = 0,
  bearing = 0
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 如果地图已存在，不重复创建
    if (map.current) return;

    try {
      // 🎨 初始化地图
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleUrl, // 🌟 使用自定义样式
        center: center,
        zoom: zoom,
        pitch: pitch, // 倾斜角度
        bearing: bearing, // 旋转角度
        antialias: true // 抗锯齿
      });

      // 📍 添加导航控件
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // 📍 添加比例尺
      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

      // 📍 添加全屏控件
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      // ✨ 地图加载完成后
      map.current.on('load', () => {
        console.log('🗺️ 地图加载完成');
        setIsLoaded(true);

        // 🎨 自定义铁路发光效果（可选）
        addRailwayGlowEffect();
      });

      // 🖱️ 点击事件
      if (onMapClick) {
        map.current.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          onMapClick({ longitude: lng, latitude: lat });
        });
      }

    } catch (error) {
      console.error('❌ 地图初始化失败:', error);
    }

    // 🧹 清理函数
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // 只在组件挂载时执行一次

  // 更新地图中心点
  useEffect(() => {
    if (map.current && center && isLoaded) {
      map.current.flyTo({
        center: center,
        duration: 2000, // 2秒动画
        essential: true
      });
    }
  }, [center, isLoaded]);

  // 添加标记点
  useEffect(() => {
    if (!map.current || !markers.length || !isLoaded) return;

    // 清除现有标记
    const existingMarkers = document.querySelectorAll('.custom-marker');
    existingMarkers.forEach(marker => marker.remove());

    // 添加新标记
    markers.forEach((markerData, index) => {
      const { longitude, latitude, color = '#fbbf24', label = '' } = markerData;

      // 创建自定义标记元素
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 2px solid #1e293b;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 10px ${color}80;
        animation: pulse 2s infinite;
      `;

      // 添加点击事件
      el.addEventListener('click', () => {
        console.log('标记点击:', markerData);
      });

      // 创建标记
      const popup = label ? new mapboxgl.Popup({ offset: 25 }).setText(label) : null;
      new mapboxgl.Marker(el)
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map.current);
    });
  }, [markers, isLoaded]);

  /**
   * 添加铁路发光效果（可选高级效果）
   * 注意：需要在 Mapbox Studio 中预先配置基础样式
   */
  const addRailwayGlowEffect = () => {
    try {
      // 检查是否有铁路图层
      const layers = map.current.getStyle().layers;

      const railwayLayers = layers.filter(layer =>
        layer.id.includes('rail') || layer.id.includes('transit')
      );

      if (railwayLayers.length > 0) {
        console.log('🚂 发现铁路图层:', railwayLayers.map(l => l.id));
      }

      // 如果使用自定义霓虹金样式，这里可以添加额外的图层效果
      // 例如：添加动态发光、动画等
    } catch (error) {
      console.warn('⚠️ 无法添加铁路效果:', error);
    }
  };

  return (
    <>
      {/* 🗺️ 地图容器 */}
      <div
        ref={mapContainer}
        className="mapbox-map"
        style={{ width: '100%', height: '100%' }}
      />

      {/* 🎨 自定义样式 */}
      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .custom-marker {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .custom-marker:hover {
          transform: scale(1.5) !important;
          transition: transform 0.2s ease;
        }

        /* Mapbox 控件样式优化 */
        .mapboxgl-ctrl-group {
          background-color: rgba(30, 41, 59, 0.9) !important;
          border: 1px solid rgba(251, 191, 36, 0.3) !important;
        }

        .mapboxgl-ctrl-icon {
          filter: invert(1);
        }
      `}</style>
    </>
  );
}
