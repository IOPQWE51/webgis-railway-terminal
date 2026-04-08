// src/components/MapboxMapStudio.jsx
// 🎨 专门用于调取 Mapbox Studio 自定义样式的地图组件

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// 🔑 设置 Mapbox Token (必须使用 Public Token)
if (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
} else {
  console.error('❌ 致命错误: VITE_MAPBOX_ACCESS_TOKEN 未设置!');
}

export default function MapboxMapStudio({
  center = [139.6503, 35.6762], // 默认东京
  zoom = 12,
  customPoints = [], // 自定义标记点
  onMapClick = null,
  styleUrl = 'mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z', // 你的全息赛博样式
  pitch = 0,
  bearing = 0
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [mapInfo, setMapInfo] = useState(null);

  useEffect(() => {
    if (map.current) return;

    // 🔍 诊断：检查配置
    console.log('🎨 Mapbox Studio 样式诊断');
    console.log('================');
    console.log('🔑 Token 状态:', import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ? '✅ 已设置' : '❌ 未设置');
    console.log('🎨 样式 URL:', styleUrl);
    console.log('📍 初始中心:', center);
    console.log('🔍 初始缩放:', zoom);

    try {
      // 🎨 创建地图实例
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleUrl, // 使用你的自定义样式
        center: center,
        zoom: zoom,
        pitch: pitch,
        bearing: bearing,
        antialias: true
      });

      // 📊 添加控件
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      // ✅ 样式加载成功
      map.current.on('style.load', () => {
        console.log('✅ Mapbox Studio 样式加载成功!');

        // 📊 获取样式信息
        const style = map.current.getStyle();
        console.log('📊 样式信息:', {
          name: style.name,
          owner: style.owner,
          layers: style.layers.length + ' 个图层',
          sources: Object.keys(style.sources).length + ' 个数据源'
        });

        setMapInfo({
          name: style.name,
          layers: style.layers.length,
          sources: Object.keys(style.sources).length
        });

        setIsLoaded(true);
      });

      // 🎯 地图加载完成
      map.current.on('load', () => {
        console.log('🗺️ 地图完全加载完成');

        // 🔍 检查关键图层
        const layers = map.current.getStyle().layers;
        const railLayers = layers.filter(l =>
          l.id.includes('rail') ||
          l.id.includes('transit') ||
          l.id.includes('station')
        );

        console.log('🚂 发现铁路/交通图层:', railLayers.length);
        console.log('📍 交通图层列表:', railLayers.map(l => l.id));

        // 📍 渲染自定义标记点
        if (customPoints.length > 0) {
          renderCustomPoints(customPoints);
        }
      });

      // ❌ 样式加载失败
      map.current.on('styledata', (error) => {
        if (error) {
          console.error('❌ 样式数据加载失败:', error);
          setLoadError('样式数据加载失败: ' + error.message);
        }
      });

      // 🖱️ 点击事件
      if (onMapClick) {
        map.current.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          console.log('🖱️ 地图点击:', { lng, lat });

          // 🔍 检查点击位置的图层
          const features = map.current.queryRenderedFeatures(e.point);
          console.log('📍 点击位置的特征:', features.length);

          onMapClick({ longitude: lng, latitude: lat });
        });
      }

      // 🎯 鼠标移动事件（用于交互）
      map.current.on('mousemove', (e) => {
        const features = map.current.queryRenderedFeatures(e.point);
        const transitFeatures = features.filter(f =>
          f.layer.id.includes('transit') ||
          f.layer.id.includes('station') ||
          f.layer.id.includes('rail')
        );

        if (transitFeatures.length > 0) {
          map.current.getCanvas().style.cursor = 'pointer';
        } else {
          map.current.getCanvas().style.cursor = '';
        }
      });

    } catch (error) {
      console.error('❌ 地图初始化失败:', error);
      setLoadError('地图初始化失败: ' + error.message);
    }

    // 🧹 清理函数
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 📍 渲染自定义标记点
  const renderCustomPoints = useCallback((points) => {
    if (!map.current || !points.length) return;

    console.log('📍 渲染自定义标记点:', points.length);

    // 清除现有标记
    const existingMarkers = document.querySelectorAll('.custom-studio-marker');
    existingMarkers.forEach(marker => marker.remove());

    // 添加新标记
    points.forEach((point) => {
      const { lon, lat, name, category = 'spot' } = point;

      // 创建自定义标记元素
      const el = document.createElement('div');
      el.className = 'custom-studio-marker';
      el.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: #fbbf24;
        border: 2px solid #1e293b;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
        transition: transform 0.2s ease;
      `;

      // 鼠标悬停效果
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.5)';
        el.style.boxShadow = '0 0 20px rgba(251, 191, 36, 0.8)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.5)';
      });

      // 创建弹窗
      const popup = new mapboxgl.Popup({ offset: 25 }).setText(name || '自定义标记');

      // 添加标记到地图
      new mapboxgl.Marker(el)
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map.current);
    });
  }, []);

  // 🔄 当 customPoints 更新时重新渲染
  useEffect(() => {
    if (isLoaded && customPoints.length > 0) {
      renderCustomPoints(customPoints);
    }
  }, [customPoints, isLoaded, renderCustomPoints]);

  // 🔄 更新地图视角
  useEffect(() => {
    if (map.current && center && isLoaded) {
      map.current.flyTo({
        center: center,
        zoom: zoom,
        duration: 2000,
        essential: true
      });
    }
  }, [center, zoom, isLoaded]);

  // ❌ 错误处理
  if (loadError) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e293b',
        color: '#f8fafc',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ color: '#fbbf24', marginBottom: '10px' }}>地图加载失败</h2>
        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>{loadError}</p>
        <div style={{
          backgroundColor: '#0f172a',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '12px',
          textAlign: 'left',
          maxWidth: '400px'
        }}>
          <strong style={{ color: '#fbbf24' }}>可能的原因：</strong>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Mapbox Token 无效或过期</li>
            <li>样式 URL 错误或无权访问</li>
            <li>网络连接问题</li>
          </ul>
          <strong style={{ color: '#fbbf24' }}>解决方法：</strong>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>检查 .env 文件中的 VITE_MAPBOX_ACCESS_TOKEN</li>
            <li>确认 Token 以 pk. 开头（Public Token）</li>
            <li>重启开发服务器</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 🗺️ 地图容器 */}
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      />

      {/* 📊 加载状态 */}
      {!isLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(30, 41, 59, 0.9)',
          color: '#fbbf24',
          padding: '20px 40px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          zIndex: 1000,
          border: '2px solid #fbbf24',
          boxShadow: '0 0 20px rgba(251, 191, 36, 0.3)'
        }}>
          🎨 正在加载 Mapbox Studio 样式...
        </div>
      )}

      {/* 📊 地图信息面板 */}
      {isLoaded && mapInfo && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(30, 41, 59, 0.9)',
          border: '1px solid #fbbf24',
          padding: '12px',
          borderRadius: '4px',
          color: '#e2e8f0',
          fontFamily: 'Courier New, monospace',
          fontSize: '11px',
          zIndex: 1000,
          boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)',
          maxWidth: '250px'
        }}>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px' }}>
            🎨 Mapbox Studio 样式信息
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#94a3b8' }}>样式名称:</span> {mapInfo.name || '全息赛博样式'}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#94a3b8' }}>图层数量:</span> {mapInfo.layers}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#94a3b8' }}>数据源:</span> {mapInfo.sources}
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#94a3b8' }}>
            ✅ 深空灰底座 + 琥珀金脉络
          </div>
        </div>
      )}

      {/* 🎨 Mapbox 控件样式优化 */}
      <style>{`
        .mapboxgl-ctrl-group {
          background-color: rgba(30, 41, 59, 0.9) !important;
          border: 1px solid rgba(251, 191, 36, 0.3) !important;
          backdrop-filter: blur(10px);
        }

        .mapboxgl-ctrl-icon {
          filter: invert(1) sepia(1) saturate(5) hue-rotate(5deg);
        }

        .mapboxgl-canvas {
          outline: none;
        }
      `}</style>
    </>
  );
}
