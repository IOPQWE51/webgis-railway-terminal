// src/pages/MapTactical.jsx
// 🗺️ 战术地图页面

import { useState } from 'react';
import MapboxMapTactical from '../components/MapboxMapTactical';
import DataCenter from '../components/DataCenter';
import { Map, Database, Search } from 'lucide-react';

export default function MapTactical({ customPoints: initialPoints = [], onPointsUpdate, onExit }) {
  const [customPoints, setCustomPoints] = useState(initialPoints);
  const [activeTab, setActiveTab] = useState('map'); // 'map' 或 'data'
  const [mapCenter, setMapCenter] = useState([-73.9851, 40.7484]); // 🗽 纽约（美国第一城）
  const [mapZoom, setMapZoom] = useState(1); // 🌍 缩放到地球视图级别（0-22，1=全地球）
  const [searchQuery, setSearchQuery] = useState(''); // 🔍 搜索关键词
  const [isSearching, setIsSearching] = useState(false); // 🔍 搜索状态

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

  // 📍 位置搜索处理（使用 OSM Nominatim API）
  const handleSearch = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            'User-Agent': 'EarthTerminal/5.0.1'
          }
        }
      );

      const results = await response.json();

      if (results && results.length > 0) {
        const { lat, lon, display_name } = results[0];
        const newCenter = [parseFloat(lon), parseFloat(lat)];
        const newZoom = 12;

        console.log('🎯 搜索定位成功:', { lat, lon, center: newCenter, zoom: newZoom });

        setMapCenter(newCenter);
        setMapZoom(newZoom);
        setSearchQuery(display_name.split(',')[0]); // 使用简短名称

        // 🔍 确保切换到地图视图
        setActiveTab('map');
      } else {
        console.warn('🔍 未找到位置:', query);
        alert(`未找到位置: ${query}`);
      }
    } catch (error) {
      console.error('❌ 搜索失败:', error);
      alert('搜索失败，请稍后重试');
    } finally {
      setIsSearching(false);
    }
  };

  // ⌨️ 回车搜索
  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery);
    }
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
      padding: '10px', // 缩小外边距，给小屏幕多留点空间
      height: '100dvh', // ⚠️ 绝杀：用 dvh (动态视口高度) 解决底部白边和浏览器工具栏遮挡问题
      boxSizing: 'border-box', // 确保 padding 不会撑爆高度
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#050505',
      color: '#f8fafc',
      fontFamily: '"Courier New", Courier, monospace',
      overflow: 'hidden', // 封死外部滚动条，消灭白边
    }}>
      {/* 📋 战术 HUD 控制台 */}
      <div style={{
        marginBottom: '10px',
        padding: '12px 15px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '0',
        borderTop: '1px solid rgba(251, 191, 36, 0.2)',
        borderRight: '1px solid rgba(251, 191, 36, 0.2)',
        borderBottom: '1px solid rgba(251, 191, 36, 0.2)',
        borderLeft: '4px solid #fbbf24',
        boxShadow: 'inset 0 0 20px rgba(251, 191, 36, 0.05)',
        flexShrink: 0 // 确保控制台不会被地图压扁
      }}>
        {/* 标题与状态行 (允许换行适配小屏幕) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <h1 style={{
            margin: '0',
            fontSize: '18px', // 稍微缩小一点字号
            color: '#fbbf24',
            textShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
          }}>
            <Map size={18} />
            [ DARK_2D_RADAR ]
          </h1>
          
          {/* 雷达状态灯 + 退出按钮 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '10px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <div style={{ width: '6px', height: '6px', backgroundColor: '#fbbf24', borderRadius: '50%', boxShadow: '0 0 8px #fbbf24' }}></div>
              SYS.ONLINE // TARGETS: {customPoints.length}
            </div>

            {/* 🚪 紧急脱出按钮 */}
            {onExit && (
              <button
                onClick={handleExit}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  cursor: 'pointer',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                ⚠️ EXIT
              </button>
            )}
          </div>
        </div>

        {/* 控制按钮群 (全面弹性化) */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* 位置搜索模块 */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '10px', letterSpacing: '1px' }}>ZONE</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', color: '#64748b', pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchSubmit}
                placeholder="搜索城市/地点..."
                disabled={isSearching}
                style={{
                  padding: '4px 10px 4px 24px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  color: '#fbbf24',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  outline: 'none',
                  cursor: isSearching ? 'wait' : 'text',
                  opacity: isSearching ? 0.6 : 1,
                  minWidth: '150px',
                  fontFamily: '"Courier New", Courier, monospace'
                }}
              />
            </div>
          </div>

          {/* 样式选择模块 */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '10px', letterSpacing: '1px' }}>MODE</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.keys(mapStyles).map(style => (
                <button
                  key={style}
                  onClick={() => setCurrentStyle(style)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: currentStyle === style ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                    color: currentStyle === style ? '#fbbf24' : '#64748b',
                    border: currentStyle === style ? '1px solid #fbbf24' : '1px solid rgba(100, 116, 139, 0.3)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  {style === 'dark2D' ? 'DARK_2D' : style.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 视图切换开关 (利用 flexGrow 自动推到右侧或换行) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexGrow: 1, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setActiveTab('map')}
              style={{
                padding: '4px 12px',
                backgroundColor: activeTab === 'map' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                color: activeTab === 'map' ? '#0ea5e9' : '#64748b',
                border: activeTab === 'map' ? '1px solid #0ea5e9' : '1px solid rgba(100, 116, 139, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                whiteSpace: 'nowrap'
              }}
            >
              <Map size={12} /> TACTICAL
            </button>
            <button
              onClick={() => setActiveTab('data')}
              style={{
                padding: '4px 12px',
                backgroundColor: activeTab === 'data' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                color: activeTab === 'data' ? '#0ea5e9' : '#64748b',
                border: activeTab === 'data' ? '1px solid #0ea5e9' : '1px solid rgba(100, 116, 139, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                whiteSpace: 'nowrap'
              }}
            >
              <Database size={12} /> DATA
            </button>
          </div>
        </div>
      </div>

      {/* 🗺️ 主屏幕矩阵 */}
      <div style={{ flex: 1, display: 'flex', gap: '15px', minHeight: 0, position: 'relative' }}>
        {activeTab === 'map' ? (
          <div style={{
            flex: 1,
            border: '1px solid rgba(251, 191, 36, 0.4)',
            boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)',
            position: 'relative',
            height: '100%',
            backgroundColor: '#000' // 防止加载时闪白
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '15px', height: '15px', borderTop: '2px solid #fbbf24', borderLeft: '2px solid #fbbf24', zIndex: 10 }}></div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '15px', height: '15px', borderBottom: '2px solid #fbbf24', borderRight: '2px solid #fbbf24', zIndex: 10 }}></div>
            
            <MapboxMapTactical styleUrl={mapStyles[currentStyle]} center={mapCenter} zoom={mapZoom} customPoints={customPoints} onMapClick={handleMapClick} />
          </div>
        ) : (
          <div style={{
            flex: 1,
            border: '1px solid rgba(14, 165, 233, 0.4)',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            padding: '15px',
            overflowY: 'auto'
          }}>
            <DataCenter isActive={true} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} />
          </div>
        )}
      </div>

      {/* 📖 底部状态栏 (增强换行兼容) */}
      <div style={{
        marginTop: '10px',
        padding: '6px 10px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderTop: '1px solid rgba(100, 116, 139, 0.2)',
        fontSize: '10px',
        color: '#475569',
        display: 'flex',
        flexWrap: 'wrap', // 允许文字换行
        justifyContent: 'space-between',
        gap: '10px',
        flexShrink: 0
      }}>
        <span>SYS_STATUS: NORMAL</span>
        <span style={{ wordBreak: 'break-all' }}>LAT: {mapCenter[1].toFixed(4)} // LNG: {mapCenter[0].toFixed(4)} // Z: {mapZoom}</span>
      </div>
    </div>
  );
}
