/**
 * Dark 2D 战术 HUD 全息悬浮窗
 *
 * 风格定义:
 * - 深空暗场: #050505 / #0f172a 背景色
 * - 琥珀鎏金: #fbbf24 主题色
 * - 机甲切割: 24px 圆角、锐利边框
 * - 幽灵视效: 背景模糊、半透明
 */

import { useEffect, useState } from 'react';
import { X, Target, Train, MapPin, AlertTriangle, Navigation } from 'lucide-react';
import { detectRegion, formatCoordinate } from '../utils/regionDetector';

const DarkTacticalHUD = ({ stationData, onClose }) => {
  const [regionInfo, setRegionInfo] = useState(null);
  const [isPulseActive, setIsPulseActive] = useState(true);

  // 检测地区信息
  useEffect(() => {
    if (stationData?.lat && stationData?.lon) {
      const info = detectRegion(stationData.lat, stationData.lon);
      setRegionInfo(info);
    }
  }, [stationData]);

  // 脉冲动画控制
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setIsPulseActive(prev => !prev);
    }, 1000);
    return () => clearInterval(pulseInterval);
  }, []);

  if (!stationData) return null;

  const { name, lat, lon, category, source } = stationData;
  const coords = formatCoordinate(lat, lon);

  // 类别图标映射
  const categoryIcons = {
    station: '🚉',
    airport: '✈️',
    anime: '🌸',
    hotel: '🏨',
    spot: '📍',
  };

  const icon = categoryIcons[category] || '📍';

  return (
    <>
      {/* PC端: 右侧面板 */}
      <div className="hidden lg:block">
        <div
          className="fixed top-20 right-4 w-80 z-[5000]"
          style={{
            fontFamily: '"Courier New", Courier, monospace',
          }}
        >
          {/* HUD 主体 */}
          <div
            style={{
              background: 'linear-gradient(145deg, #0a0a0a, #0f172a)',
              border: '1px solid rgba(251, 191, 36, 0.4)',
              borderRadius: '16px',
              boxShadow: '0 0 40px rgba(251, 191, 36, 0.15), inset 0 0 60px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
          >
            {/* 顶部状态栏 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'rgba(251, 191, 36, 0.08)',
                borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    background: isPulseActive ? '#fbbf24' : '#f59e0b',
                    borderRadius: '50%',
                    boxShadow: isPulseActive ? '0 0 12px #fbbf24' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
                <span
                  style={{
                    color: '#fbbf24',
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  }}
                >
                  Target Locked
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.color = '#fbbf24'}
                onMouseLeave={(e) => e.target.style.color = '#64748b'}
              >
                <X size={16} />
              </button>
            </div>

            {/* 内容区域 */}
            <div style={{ padding: '20px' }}>
              {/* 站点名称 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '32px' }}>{icon}</span>
                <div>
                  <div
                    style={{
                      color: '#f8fafc',
                      fontSize: '18px',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: '11px',
                      marginTop: '2px',
                    }}
                  >
                    {source || 'Dark 2D 标记'}
                  </div>
                </div>
              </div>

              {/* 分割线 */}
              <div
                style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.3), transparent)',
                  margin: '12px 0',
                }}
              />

              {/* 坐标信息 */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    color: '#64748b',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '1px',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}
                >
                  坐标信息
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    color: '#fbbf24',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={12} />
                    {coords.lat}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={12} />
                    {coords.lon}
                  </div>
                </div>
              </div>

              {/* 地区信息 */}
              {regionInfo && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        color: '#64748b',
                        fontSize: '10px',
                        fontWeight: '700',
                        letterSpacing: '1px',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      区域信息
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          background: 'rgba(251, 191, 36, 0.1)',
                          color: '#fbbf24',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          border: '1px solid rgba(251, 191, 36, 0.2)',
                        }}
                      >
                        {regionInfo.continent}
                      </span>
                      <span
                        style={{
                          background: 'rgba(251, 191, 36, 0.1)',
                          color: '#fbbf24',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          border: '1px solid rgba(251, 191, 36, 0.2)',
                        }}
                      >
                        {regionInfo.countryName}
                      </span>
                      {regionInfo.regionName && (
                        <span
                          style={{
                            background: 'rgba(14, 165, 233, 0.1)',
                            color: '#0ea5e9',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            border: '1px solid rgba(14, 165, 233, 0.2)',
                          }}
                        >
                          {regionInfo.regionName}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 换乘线路 (待接入 API) */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    color: '#64748b',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '1px',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Train size={10} />
                  换乘线路
                </div>
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px dashed rgba(251, 191, 36, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontSize: '11px' }}>
                    <AlertTriangle size={12} />
                    <span>API 数据待接入</span>
                  </div>
                  {regionInfo?.apiProvider && (
                    <div style={{ marginTop: '6px', color: '#475569', fontSize: '10px' }}>
                      预计使用: {regionInfo.apiProvider}
                    </div>
                  )}
                </div>
              </div>

              {/* 热门目的地 (待接入 API) */}
              <div>
                <div
                  style={{
                    color: '#64748b',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '1px',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Navigation size={10} />
                  热门目的地
                </div>
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px dashed rgba(251, 191, 36, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontSize: '11px' }}>
                    <AlertTriangle size={12} />
                    <span>API 数据待接入</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部装饰线 */}
            <div
              style={{
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 移动端: 使用 TacticalBottomSheet */}
      <div className="lg:hidden">
        {/* 移动端通过事件广播触发 TacticalBottomSheet */}
        {(() => {
          const mobileContent = `
            <div style="padding: 20px; font-family: 'Courier New', monospace;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">${icon}</span>
                <div>
                  <div style="color: #f8fafc; font-size: 18px; font-weight: 700;">${name}</div>
                  <div style="color: #64748b; font-size: 11px;">${source || 'Dark 2D 标记'}</div>
                </div>
              </div>
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.3), transparent); margin: 12px 0;"></div>
              <div style="color: #fbbf24; font-size: 12px; margin-bottom: 8px;">
                坐标: ${coords.full}
              </div>
              ${regionInfo ? `
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
                  <span style="background: rgba(251, 191, 36, 0.1); color: #fbbf24; padding: 4px 10px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(251, 191, 36, 0.2);">
                    ${regionInfo.continent}
                  </span>
                  <span style="background: rgba(251, 191, 36, 0.1); color: #fbbf24; padding: 4px 10px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(251, 191, 36, 0.2);">
                    ${regionInfo.countryName}
                  </span>
                  ${regionInfo.regionName ? `
                    <span style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; padding: 4px 10px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(14, 165, 233, 0.2);">
                      ${regionInfo.regionName}
                    </span>
                  ` : ''}
                </div>
              ` : ''}
              <div style="background: rgba(0, 0, 0, 0.3); border: 1px dashed rgba(251, 191, 36, 0.2); border-radius: 8px; padding: 12px; text-align: center; margin-top: 16px;">
                <div style="color: #64748b; font-size: 11px;">⚠️ 换乘与热门目的地 API 待接入</div>
                ${regionInfo?.apiProvider ? `<div style="color: #475569; font-size: 10px; margin-top: 6px;">预计使用: ${regionInfo.apiProvider}</div>` : ''}
              </div>
            </div>
          `;

          // 触发移动端抽屉
          window.dispatchEvent(new CustomEvent('openTacticalBottomSheet', { detail: mobileContent }));

          return null;
        })()}
      </div>

      {/* 全局样式 */}
      <style>{`
        @keyframes hudScanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes hudPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
};

export default DarkTacticalHUD;
