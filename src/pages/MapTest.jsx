// src/pages/MapTest.jsx
// 🧪 Mapbox 地图测试页面

import { useState } from 'react';
import MapboxMap from '@/components/MapboxMap';

export default function MapTest() {
  const [currentStyle, setCurrentStyle] = useState('default');
  const [selectedCity, setSelectedCity] = useState('tokyo');

  // 🎨 地图样式定义
  const mapStyles = {
    default: 'mapbox://styles/mapbox/streets-v12',
    dark: 'mapbox://styles/mapbox/dark-v11',           // 暗色主题（更有科技感）
    dark2D: 'mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z', // 🌟 自定义 Dark 2D
    satellite: 'mapbox://styles/mapbox/satellite-v9',    // 卫星图
    light: 'mapbox://styles/mapbox/light-v11',          // 明亮主题
    darkMatter: 'mapbox://styles/mapbox/dark-v10',       // 暗物质（更酷炫）
    navigation: 'mapbox://styles/mapbox/navigation-v1'   // 夜间导航（交通更明显）
  };

  // 🏙️ 城市数据
  const cities = {
    tokyo: {
      name: '东京',
      center: [139.6503, 35.6762],
      zoom: 12,
      markers: [
        { longitude: 139.7645, latitude: 35.6812, color: '#fbbf24', label: '新宿站' },
        { longitude: 139.7006, latitude: 35.6895, color: '#fbbf24', label: '池袋站' },
        { longitude: 139.6503, latitude: 35.6762, color: '#ef4444', label: '东京站' },
        { longitude: 139.7772, latitude: 35.7138, color: '#fbbf24', label: '上野站' }
      ]
    },
    osaka: {
      name: '大阪',
      center: [135.5023, 34.6937],
      zoom: 12,
      markers: [
        { longitude: 135.5023, latitude: 34.6937, color: '#fbbf24', label: '大阪站' },
        { longitude: 135.5181, latitude: 34.6940, color: '#fbbf24', label: '环状线' }
      ]
    },
    nyc: {
      name: '纽约',
      center: [-73.9851, 40.7484],
      zoom: 12,
      markers: [
        { longitude: -73.9851, latitude: 40.7484, color: '#fbbf24', label: '时代广场' },
        { longitude: -73.9442, latitude: 40.8176, color: '#fbbf24', label: '中央车站' }
      ]
    }
  };

  const [markers, setMarkers] = useState(cities[selectedCity].markers);
  const [clickCount, setClickCount] = useState(0);

  const handleMapClick = ({ longitude, latitude }) => {
    console.log('🖱️ 地图点击:', { longitude, latitude });
    setClickCount(prev => prev + 1);

    // 添加新标记
    const newMarker = {
      longitude,
      latitude,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      label: `标记 ${markers.length + 1}`
    };

    setMarkers([...markers, newMarker]);
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
    setMarkers(cities[city].markers);
    setClickCount(0);
  };

  return (
    <div style={{
      padding: '20px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 📋 控制面板 */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        color: '#f8fafc'
      }}>
        <h1 style={{ margin: '0 0 15px 0', fontSize: '24px' }}>
          🗺️ Mapbox 霓虹金地图测试
        </h1>

        {/* 城市选择 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '10px' }}>城市:</label>
          {Object.keys(cities).map(city => (
            <button
              key={city}
              onClick={() => handleCityChange(city)}
              style={{
                marginRight: '10px',
                padding: '8px 16px',
                backgroundColor: selectedCity === city ? '#fbbf24' : '#334155',
                color: selectedCity === city ? '#1e293b' : '#f8fafc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: selectedCity === city ? 'bold' : 'normal'
              }}
            >
              {cities[city].name}
            </button>
          ))}
        </div>

        {/* 样式选择 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '10px' }}>样式:</label>
          {Object.keys(mapStyles).map(style => (
            <button
              key={style}
              onClick={() => setCurrentStyle(style)}
              style={{
                marginRight: '10px',
                padding: '8px 16px',
                backgroundColor: currentStyle === style ? '#fbbf24' : '#334155',
                color: currentStyle === style ? '#1e293b' : '#f8fafc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: currentStyle === style ? 'bold' : 'normal'
              }}
            >
              {style === 'default' ? '经典 Streets' :
               style === 'dark' ? 'Mapbox Dark' :
               style === 'dark2D' ? 'Dark 2D (自)' :
               style === 'satellite' ? '卫星' :
               style === 'light' ? '明亮' :
               style === 'darkMatter' ? '暗物质' :
               style === 'navigation' ? '夜间导航' : style}
            </button>
          ))}
        </div>

        {/* 统计信息 */}
        <div style={{ fontSize: '14px', color: '#94a3b8' }}>
          <p style={{ margin: '5px 0' }}>
            📍 当前城市: {cities[selectedCity].name}
          </p>
          <p style={{ margin: '5px 0' }}>
            🎯 标记数量: {markers.length}
          </p>
          <p style={{ margin: '5px 0' }}>
            🖱️ 点击次数: {clickCount}
          </p>
        </div>
      </div>

      {/* 🗺️ 地图容器 */}
      <div style={{
        flex: 1,
        borderRadius: '8px',
        overflow: 'hidden',
        border: '2px solid #fbbf24'
      }}>
        <MapboxMap
          styleUrl={mapStyles[currentStyle]}
          center={cities[selectedCity].center}
          zoom={cities[selectedCity].zoom}
          markers={markers}
          onMapClick={handleMapClick}
        />
      </div>

      {/* 📋 使用说明 */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        color: '#f8fafc',
        fontSize: '14px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>📖 使用说明</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>点击地图任意位置添加标记</li>
          <li>切换城市查看不同地区的铁路</li>
          <li>切换样式查看不同的视觉效果</li>
          <li>点击标记查看位置名称</li>
          <li>使用右上角控件缩放和旋转地图</li>
        </ul>
        <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
          ⚠️ 注意：霓虹金样式需要在 Mapbox Studio 创建后才能使用
        </p>
      </div>
    </div>
  );
}
