// src/pages/MapTactical.jsx
// 🗺️ 战术地图页面

import { useState, useEffect, useMemo } from 'react';
import MapboxMapTactical from '../components/MapboxMapTactical';
import DataCenter from '../components/DataCenter';
import TacticalBottomSheet from '../components/TacticalBottomSheet';
import { Map, Database, Search, Crosshair, Loader2 } from 'lucide-react';
import { storage, debounce } from '../utils/performanceHelpers';
import { searchPlace } from '../utils/geocode';
import { useGeolocation } from '../hooks/useGeolocation';
import { TACTICAL_STYLES } from '../config/mapConstants';
import { parseViewHash, serializeViewHash, OWN_VIEW_FINGERPRINT } from '../utils/urlState';
import QrViewShare from '../components/QrViewShare';

// 🏠 记住上次战术视角（本机持久，与主地图的视角指纹同仓不同 key）
const TACTICAL_LAST_VIEW = 'et_tactical_last_view';

export default function MapTactical({ customPoints: _initialPoints = [], onPointsUpdate: _onPointsUpdate, onExit }) {
  // 🎯 Dark 2D 模式使用独立的点位存储（不继承主地图的点）
  const [customPoints, setCustomPoints] = useState(() => {
    return storage.load('earth_terminal_dark2d_points', []);
  });
  const [activeTab, setActiveTab] = useState('map'); // 'map' 或 'data'
  // 🧭 默认视角三连：分享链接 hash（mode=tactical）> 上次战术视角（本机记住）> 东京湾
  // （全球出行工具的"第一站"不应硬编码成单一城市——分享/上次视角命中时永远优先）
  const [mapCenter, setMapCenter] = useState(() => {
    const fromHash = parseViewHash(window.location.hash);
    if (fromHash?.lat !== null && fromHash?.lon !== null) return [fromHash.lon, fromHash.lat];
    const last = storage.load(TACTICAL_LAST_VIEW, null);
    if (Array.isArray(last) && Number.isFinite(last[0]) && Number.isFinite(last[1])) return last;
    return [139.7671, 35.6812]; // 东京站（全球工具的第一站默认，非"某国第一城"叙事）
  });
  const [mapZoom, setMapZoom] = useState(() => {
    const fromHash = parseViewHash(window.location.hash);
    if (fromHash?.lat !== null && fromHash?.lon !== null && fromHash.z !== null) return fromHash.z;
    const last = storage.load('et_tactical_last_zoom', null);
    return (typeof last === 'number' && Number.isFinite(last) && last >= 0) ? last : 4; // 全球概览级
  });
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

  // 🔗 视角变化 → URL hash（mode=tactical，复制地址栏即可分享战术视角）
  //  + 本机"上次视角"记忆（下次进入直接回到上次位置，与主地图同一套哲学）
  //  + 视角指纹（自己收藏夹打开不弹分享面板——与 App.jsx 启动恢复逻辑共用判断）
  // 防抖 600ms 与主地图对齐；注意这里的参数是 [lng, lat]（Mapbox 惯例），
  // 序列化时翻转成 lat/lon（URL 惯例）
  const handleViewChange = ({ center, zoom }) => {
    if (!Array.isArray(center)) return;
    const [lng, lat] = center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const next = serializeViewHash({ lat, lon: lng, z: zoom, mode: 'tactical' });
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
    try {
      window.localStorage.setItem(OWN_VIEW_FINGERPRINT, next);
      window.localStorage.setItem(TACTICAL_LAST_VIEW, JSON.stringify([lng, lat]));
      window.localStorage.setItem('et_tactical_last_zoom', String(Math.round(zoom)));
    } catch { /* 隐私模式忽略 */ }
  };
  // 防抖 600ms 与主地图哲学对齐：拖动中不刷地址栏，拖完落定再写
  const debouncedViewChange = useMemo(() => debounce(handleViewChange, 600), []);

  // 📍 位置搜索处理（统一链路：代理优先 + Nominatim 兜底）
  const handleSearch = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const result = await searchPlace(query);

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

  // 📍 定位自身（统一 hook：GPS → IP 兜底，与主地图共用）
  const { locate } = useGeolocation();
  const handleLocate = async () => {
    setIsLocating(true);
    try {
      const position = await locate({ fallbackToIP: true });
      if (!position) return; // 失败原因已由 hook 记录，此处静默退出

      setMapCenter([position.longitude, position.latitude]);
      setMapZoom(position.accuracy === 'low' ? 10 : 13);

      // 📍 设置用户位置（用于渲染幽灵蓝标记）
      setUserLocation({
        latitude: position.latitude,
        longitude: position.longitude
      });

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
  // 修复：原为 useState（误用），副作用只在首渲执行一次，customPoints 变化时闭包捕获旧点位；
  // 且卸载时不清理 window.__locatePointOnMap，退出战术模式后会残留指向已失效 setter 的野指针。
  useEffect(() => {
    window.__locatePointOnMap = (pointId) => {
      const point = customPoints.find(p => p.id === pointId);
      if (point) {
        setMapCenter([point.lon, point.lat]);
        setMapZoom(15);
        setActiveTab('map');
      }
    };

    // 卸载时清理，避免退回常规模式时残留野指针（主 App 的 useEffect 会重新挂回自己的实现）
    return () => {
      delete window.__locatePointOnMap;
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
              onViewChange={debouncedViewChange}
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
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0
      }}>
        <span>SYS_STATUS: NORMAL</span>
        <span style={{ wordBreak: 'break-all' }}>LAT: {mapCenter[1].toFixed(4)} // LNG: {mapCenter[0].toFixed(4)} // Z: {mapZoom}</span>
        {/* 🔳 战术视角二维码：向上弹出（琥珀暗色变体，战术 HUD 风格） */}
        <div style={{ width: '170px', flexShrink: 0 }}>
          <QrViewShare variant="dark" size={170} />
        </div>
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
