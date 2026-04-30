// src/pages/MapTactical.jsx
// 🗺️ 战术地图页面

import { useState, useEffect } from 'react';
import MapboxMapTactical from '../components/MapboxMapTactical';
import DataCenter from '../components/DataCenter';
import TacticalBottomSheet from '../components/TacticalBottomSheet';
import { Map, Database, Search, Crosshair, Loader2 } from 'lucide-react';
import { storage, geocodeRequest, getCurrentPosition } from '../utils/performanceHelpers';
import { TACTICAL_STYLES } from '../config/mapConstants';

export default function MapTactical({ customPoints: initialPoints = [], onPointsUpdate: _onPointsUpdate, onExit }) {
  // 🎯 Dark 2D 模式使用独立的点位存储（不继承主地图的点）
  const [customPoints, setCustomPoints] = useState(() => {
    return storage.load('earth_terminal_dark2d_points', []);
  });
  const [activeTab, setActiveTab] = useState('map'); // 'map' 或 'data'
  const [mapCenter, setMapCenter] = useState([-73.9851, 40.7484]); // 🗽 纽约（美国第一城）
  const [mapZoom, setMapZoom] = useState(1); // 🌍 缩放到地球视图级别（0-22，1=全地球）
  const [searchQuery, setSearchQuery] = useState(''); // 🔍 搜索关键词
  const [isSearching, setIsSearching] = useState(false); // 🔍 搜索状态
  const [isLocating, setIsLocating] = useState(false); // 📍 定位中状态
  const [userLocation, setUserLocation] = useState(null); // 📍 用户当前位置（幽灵蓝）

  // 📱 移动端抽屉状态
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [bottomSheetContent, setBottomSheetContent] = useState('');

  // 📱 监听移动端抽屉事件
  useEffect(() => {
    const handleOpenSheet = (e) => {
      setBottomSheetContent(e.detail);
      setBottomSheetOpen(true);
    };

    const handleCloseSheet = () => {
      setBottomSheetOpen(false);
    };

    window.addEventListener('openTacticalBottomSheet', handleOpenSheet);
    window.addEventListener('closeTacticalBottomSheet', handleCloseSheet);

    return () => {
      window.removeEventListener('openTacticalBottomSheet', handleOpenSheet);
      window.removeEventListener('closeTacticalBottomSheet', handleCloseSheet);
    };
  }, []);

  // ☁️ 挂载时从云端拉取 Dark 2D 点位
  useEffect(() => {
    const fetchCloudPoints = async () => {
      try {
        const res = await fetch('/api/points?scope=dark2d');
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            setCustomPoints(json.data);
            storage.save('earth_terminal_dark2d_points', json.data);
          }
        }
      } catch (_) {
        // 云端未连接时使用本地 localStorage 兜底
      }
    };
    fetchCloudPoints();
  }, []);

  // 🔄 处理点位更新（乐观更新：先本地，再异步推云端）
  const handlePointsUpdate = (newPoints) => {
    setCustomPoints(newPoints);
    storage.save('earth_terminal_dark2d_points', newPoints);
    fetch('/api/points?scope=dark2d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPoints)
    }).catch(() => {});
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
  const [clickedCoord, setClickedCoord] = useState(null); // 🖱️ 点击的坐标（显示面板用）

  // 🖱️ 地图点击处理 - 不创建标记点，只显示坐标面板
  const handleMapClick = ({ longitude, latitude }) => {
    setClickedCoord({ longitude, latitude });
  };

  // 📍 位置搜索处理（使用统一的地理编码工具）
  const handleSearch = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const result = await geocodeRequest(query, 'nominatim');

      if (result) {
        const { lat, lon, displayName } = result;
        const newCenter = [lon, lat];
        const newZoom = 12;

        setMapCenter(newCenter);
        setMapZoom(newZoom);
        setSearchQuery(displayName.split(',')[0]); // 使用简短名称

        // 🔍 确保切换到地图视图
        setActiveTab('map');
      } else {
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

  // 📍 定位自身
  const handleLocate = async () => {
    setIsLocating(true);
    try {
      const position = await getCurrentPosition({ fallbackToIP: true });
      setMapCenter([position.longitude, position.latitude]);
      setMapZoom(position.accuracy === 'low' ? 10 : 13);

      // 📍 设置用户位置（用于渲染幽灵蓝标记）
      setUserLocation({
        latitude: position.latitude,
        longitude: position.longitude
      });

      // 显示定位方式提示
      const method = position.method === 'gps' ? 'GPS' : 'IP 地址';
      if (position.warning) {
        // 延迟显示警告，不打断用户
        setTimeout(() => {
          const notice = document.createElement('div');
          notice.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(14, 165, 233, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 10000;
            animation: fadeInOut 3s forwards;
          `;
          notice.textContent = `📍 ${position.warning}`;
          document.body.appendChild(notice);
          setTimeout(() => notice.remove(), 3000);
        }, 100);
      }
    } catch (error) {
      console.error('❌ 定位失败:', error);
      alert(error.message);
    } finally {
      setIsLocating(false);
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
        flexShrink: 0,
        ...TACTICAL_STYLES.panel.base
      }}>
        {/* 标题与状态行 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <h1 style={{
            margin: '0',
            fontSize: '18px',
            color: TACTICAL_STYLES.colors.amber,
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
            <div style={{ fontSize: '10px', color: TACTICAL_STYLES.colors.amber, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <div style={{ width: '6px', height: '6px', backgroundColor: TACTICAL_STYLES.colors.amber, borderRadius: '50%', boxShadow: `0 0 8px ${TACTICAL_STYLES.colors.amber}` }}></div>
              SYS.ONLINE // TARGETS: {customPoints.length}
            </div>

            {/* 🚪 紧急脱出按钮 */}
            {onExit && (
              <button
                onClick={handleExit}
                style={{
                  ...TACTICAL_STYLES.button.base,
                  ...TACTICAL_STYLES.button.danger
                }}
              >
                ⚠️ EXIT
              </button>
            )}
          </div>
        </div>

        {/* 控制按钮群 */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* 位置搜索模块 */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: TACTICAL_STYLES.colors.grayText, fontSize: '10px', letterSpacing: '1px' }}>ZONE</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', color: TACTICAL_STYLES.colors.grayText, pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchSubmit}
                placeholder="搜索城市/地点..."
                disabled={isSearching}
                style={{
                  ...TACTICAL_STYLES.input.base,
                  paddingLeft: '24px',
                  minWidth: '150px',
                  cursor: isSearching ? 'wait' : 'text',
                  opacity: isSearching ? 0.6 : 1
                }}
              />
            </div>
          </div>

          {/* 📍 定位按钮 */}
          <button
            onClick={handleLocate}
            disabled={isLocating}
            style={{
              ...TACTICAL_STYLES.button.base,
              ...TACTICAL_STYLES.button.primary,
              backgroundColor: isLocating ? 'rgba(251, 191, 36, 0.2)' : TACTICAL_STYLES.button.primary.backgroundColor,
              opacity: isLocating ? 0.7 : 1,
              cursor: isLocating ? 'wait' : 'pointer',
              gap: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isLocating ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
            {isLocating ? 'LOCATING...' : 'LOCATE'}
          </button>

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

          {/* 视图切换开关 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexGrow: 1, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setActiveTab('map')}
              style={{
                ...TACTICAL_STYLES.button.base,
                ...(activeTab === 'map' ? TACTICAL_STYLES.button.active : TACTICAL_STYLES.button.secondary),
                gap: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Map size={12} /> TACTICAL
            </button>
            <button
              onClick={() => setActiveTab('data')}
              style={{
                ...TACTICAL_STYLES.button.base,
                ...(activeTab === 'data' ? TACTICAL_STYLES.button.active : TACTICAL_STYLES.button.secondary),
                gap: '4px',
                display: 'flex',
                alignItems: 'center'
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
            
            <MapboxMapTactical
              styleUrl={mapStyles[currentStyle]}
              center={mapCenter}
              zoom={mapZoom}
              customPoints={customPoints}
              onMapClick={handleMapClick}
              clickedCoord={clickedCoord}
              userLocation={userLocation}
            />
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

      {/* 📱 移动端战术抽屉 */}
      <TacticalBottomSheet
        open={bottomSheetOpen}
        htmlContent={bottomSheetContent}
        onDismiss={() => setBottomSheetOpen(false)}
      />

      {/* 全局样式 */}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          90% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </div>
  );
};
