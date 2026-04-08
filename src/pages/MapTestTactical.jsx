// src/pages/MapTestTactical.jsx
// 🗺️ Dark 2D 地图测试页面

import { useState } from 'react';
import MapboxMapTactical from '../components/MapboxMapTactical';
import DataCenter from '../components/DataCenter';
import { Map, Database } from 'lucide-react';

export default function MapTestTactical({ customPoints: initialPoints = [], onPointsUpdate, onExit }) {
  const [customPoints, setCustomPoints] = useState(initialPoints);
  const [selectedCity, setSelectedCity] = useState('tokyo');
  const [activeTab, setActiveTab] = useState('map'); // 'map' 或 'data'
  const [mapCenter, setMapCenter] = useState([139.6503, 35.6762]);
  const [mapZoom, setMapZoom] = useState(12);

  // 🔄 处理点位更新（同步给父组件）
  const handlePointsUpdate = (newPoints) => {
    setCustomPoints(newPoints);
    if (onPointsUpdate) {
      onPointsUpdate(newPoints);
    }
  };

  // 🚪 退出战术模式
  const handleExit = () => {
    if (onExit) {
      onExit();
    }
  };

  // 🏙️ 城市数据
  const cities = {
    tokyo: {
      name: '东京',
      center: [139.6503, 35.6762],
      zoom: 12,
      description: '霓虹都市 · 交通枢纽'
    },
    osaka: {
      name: '大阪',
      center: [135.5023, 34.6937],
      zoom: 12,
      description: '关西门户 · 美食之都'
    },
    nyc: {
      name: '纽约',
      center: [-73.9851, 40.7484],
      zoom: 12,
      description: '世界十字路口 · 大苹果'
    }
  };

  // 🎨 地图样式定义
  const mapStyles = {
    dark2D: 'mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z', // 自定义 Dark 2D
    dark: 'mapbox://styles/mapbox/dark-v11',                       // Mapbox Dark
    light: 'mapbox://styles/mapbox/light-v11',                     // Light
    streets: 'mapbox://styles/mapbox/streets-v12'                  // Streets
  };

  const [currentStyle, setCurrentStyle] = useState('dark2D');

  // 🖱️ 地图点击处理
  const handleMapClick = ({ longitude, latitude }) => {
    console.log('🖱️ Dark 2D 地图点击:', { longitude, latitude });

    const newPoint = {
      id: `click_${Date.now()}`,
      name: `标记 ${customPoints.length + 1}`,
      lat: latitude,
      lon: longitude,
      category: 'spot',
      source: 'Dark 2D 地图手动标记'
    };

    setCustomPoints([...customPoints, newPoint]);
  };

  // 🏙️ 切换城市
  const handleCityChange = (city) => {
    setSelectedCity(city);
    setMapCenter(cities[city].center);
    setMapZoom(cities[city].zoom);
  };

  // 🗺️ 定位到特定点位（从 DataCenter 列表点击）
  useState(() => {
    window.__locatePointOnMap = (pointId) => {
      const point = customPoints.find(p => p.id === pointId);
      if (point) {
        setMapCenter([point.lon, point.lat]);
        setMapZoom(15);
        setActiveTab('map');
      }
    };
  }, [customPoints]);

  return (
    <div style={{
      padding: '20px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      // 1. 全域暗化：比原本的 #0f172a 更深的纯粹黑，消除视觉干扰
      backgroundColor: '#050505',
      color: '#f8fafc',
      fontFamily: '"Courier New", Courier, monospace', // 换成机械等宽字体
    }}>
      {/* 📋 战术 HUD 控制台 */}
      <div style={{
        marginBottom: '20px',
        padding: '15px 20px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // 极度透明的底色
        // 2. 机械锐角：彻底干掉圆角
        borderRadius: '0',
        // 3. 机甲切割边框：左侧加粗作为能量柱，其余极细线
        borderTop: '1px solid rgba(251, 191, 36, 0.2)',
        borderRight: '1px solid rgba(251, 191, 36, 0.2)',
        borderBottom: '1px solid rgba(251, 191, 36, 0.2)',
        borderLeft: '4px solid #fbbf24',
        boxShadow: 'inset 0 0 20px rgba(251, 191, 36, 0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h1 style={{
            margin: '0',
            fontSize: '22px',
            color: '#fbbf24',
            textShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            <Map size={22} />
            [ Earth_Terminal :: Dark_2D ]
          </h1>
          {/* 雷达状态灯 + 退出按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '12px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: '#fbbf24', borderRadius: '50%', boxShadow: '0 0 8px #fbbf24' }}></div>
              SYS.ONLINE // 📍 TARGETS: {customPoints.length}
            </div>

            {/* 🚪 紧急脱出按钮 */}
            {onExit && (
              <button
                onClick={handleExit}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '0',
                  cursor: 'pointer',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                  e.target.style.boxShadow = 'inset 0 0 8px rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.boxShadow = 'none';
                }}
              >
                ⚠️ EXIT
              </button>
            )}
          </div>
        </div>

        {/* 控制按钮群 */}
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* 城市选择模块 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '12px', color: '#64748b', fontSize: '12px', letterSpacing: '1px' }}>ZONE</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.keys(cities).map(city => (
                <button
                  key={city}
                  onClick={() => handleCityChange(city)}
                  style={{
                    padding: '6px 12px',
                    // 4. 幽灵按钮 (Ghost Buttons)：抛弃实心背景，改用透明+微光
                    backgroundColor: selectedCity === city ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                    color: selectedCity === city ? '#fbbf24' : '#64748b',
                    border: selectedCity === city ? '1px solid #fbbf24' : '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '0',
                    cursor: 'pointer',
                    fontSize: '12px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: selectedCity === city ? 'inset 0 0 8px rgba(251, 191, 36, 0.2), 0 0 8px rgba(251, 191, 36, 0.2)' : 'none'
                  }}
                >
                  {cities[city].name}
                </button>
              ))}
            </div>
          </div>

          {/* 样式选择模块 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '12px', color: '#64748b', fontSize: '12px', letterSpacing: '1px' }}>RADAR.MODE</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.keys(mapStyles).map(style => (
                <button
                  key={style}
                  onClick={() => setCurrentStyle(style)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: currentStyle === style ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                    color: currentStyle === style ? '#fbbf24' : '#64748b',
                    border: currentStyle === style ? '1px solid #fbbf24' : '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '0',
                    cursor: 'pointer',
                    fontSize: '12px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s',
                    boxShadow: currentStyle === style ? 'inset 0 0 8px rgba(251, 191, 36, 0.2), 0 0 8px rgba(251, 191, 36, 0.2)' : 'none'
                  }}
                >
                  {style === 'dark2D' ? 'DARK_2D' : style.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 视图切换开关 (Map / Data) */}
          <div style={{ display: 'flex', marginLeft: 'auto' }}>
            <button
              onClick={() => setActiveTab('map')}
              style={{
                padding: '6px 16px',
                backgroundColor: activeTab === 'map' ? 'rgba(14, 165, 233, 0.15)' : 'transparent', // 这里用幽蓝色作为次强调色
                color: activeTab === 'map' ? '#0ea5e9' : '#64748b',
                border: activeTab === 'map' ? '1px solid #0ea5e9' : '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '0',
                cursor: 'pointer',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                boxShadow: activeTab === 'map' ? 'inset 0 0 8px rgba(14, 165, 233, 0.2)' : 'none'
              }}
            >
              <Map size={14} /> TACTICAL_VIEW
            </button>
            <button
              onClick={() => setActiveTab('data')}
              style={{
                padding: '6px 16px',
                backgroundColor: activeTab === 'data' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                color: activeTab === 'data' ? '#0ea5e9' : '#64748b',
                border: activeTab === 'data' ? '1px solid #0ea5e9' : '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                boxShadow: activeTab === 'data' ? 'inset 0 0 8px rgba(14, 165, 233, 0.2)' : 'none'
              }}
            >
              <Database size={14} /> DATA_CENTER
            </button>
          </div>
        </div>
      </div>

      {/* 🗺️ 主屏幕矩阵 */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '20px',
        minHeight: 0
      }}>
        {activeTab === 'map' ? (
          /* Dark 2D 视口 */
          <div style={{
            flex: 1,
            borderRadius: '0', // 去掉圆角
            overflow: 'hidden',
            border: '1px solid rgba(251, 191, 36, 0.4)', // 细线琥珀边框
            boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)', // 外围加深阴影，让地图"浮"起来
            position: 'relative',
            height: '100%',
            minHeight: '500px'
          }}>
            {/* 准星十字装饰物 (绝对定位，悬浮在地图边缘) */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '2px solid #fbbf24', borderLeft: '2px solid #fbbf24', zIndex: 10 }}></div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '2px solid #fbbf24', borderRight: '2px solid #fbbf24', zIndex: 10 }}></div>

            <MapboxMapTactical
              styleUrl={mapStyles[currentStyle]}
              center={mapCenter}
              zoom={mapZoom}
              customPoints={customPoints}
              onMapClick={handleMapClick}
            />
          </div>
        ) : (
          /* 数据中心视口 - 修复致命光污染！ */
          <div style={{
            flex: 1,
            borderRadius: '0',
            border: '1px solid rgba(14, 165, 233, 0.4)', // 数据区用幽蓝色区分
            backgroundColor: 'rgba(15, 23, 42, 0.8)', // 修复了原本刺眼的白底，统一成深色半透明
            padding: '20px',
            overflowY: 'auto'
          }}>
            <DataCenter
              isActive={true}
              customPoints={customPoints}
              onPointsUpdate={handlePointsUpdate}
            />
          </div>
        )}
      </div>

      {/* 📖 底部状态栏 */}
      <div style={{
        marginTop: '15px',
        padding: '8px 15px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderTop: '1px solid rgba(100, 116, 139, 0.2)',
        fontSize: '10px', // 缩小字号，更像状态栏
        color: '#475569',
        letterSpacing: '1px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>TERMINAL STATUS: NORMAL</span>
        <span>LAT: {mapCenter[1].toFixed(4)} // LNG: {mapCenter[0].toFixed(4)} // Z: {mapZoom}</span>
      </div>
    </div>
  );
}
