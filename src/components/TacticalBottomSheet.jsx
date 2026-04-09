import { useState, useEffect, useRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

const TacticalBottomSheet = ({ open, htmlContent, onDismiss }) => {
  // 档位配置
  const SNAP_POINTS = {
    HIDDEN: 0,
    SCOUT: 25,
    MIDDLE: 55,
    BATTLE: 92
  };

  const [currentSnap, setCurrentSnap] = useState('SCOUT');
  const [sheetHeight, setSheetHeight] = useState(25);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({ startY: 0, startHeight: 0 });

  useEffect(() => {
    if (open) {
      setCurrentSnap('SCOUT');
      setSheetHeight(25);
    }
  }, [open]);

  useEffect(() => {
    if (!isDragging) {
      setSheetHeight(SNAP_POINTS[currentSnap]);
    }
  }, [currentSnap, isDragging]);

  const onDragStart = (clientY) => {
    setIsDragging(true);
    dragRef.current = { startY: clientY, startHeight: sheetHeight };
  };

  const onDragMove = (clientY) => {
    if (!isDragging) return;
    const deltaY = clientY - dragRef.current.startY;
    const deltaVH = (deltaY / window.innerHeight) * 100;
    
    let newHeight = dragRef.current.startHeight - deltaVH;
    if (newHeight > 95) newHeight = 95;
    if (newHeight < 10) newHeight = 10;

    setSheetHeight(newHeight);
  };

  const onDragEnd = () => {
    setIsDragging(false);

    // 根据高度判断吸附到哪个档位
    if (sheetHeight < 12) {
      // 吸附到隐藏档
      onDismiss();
    } else if (sheetHeight < 40) {
      // 吸附到侦察档
      setCurrentSnap('SCOUT');
      setSheetHeight(25);
    } else if (sheetHeight < 75) {
      // 吸附到中间档
      setCurrentSnap('MIDDLE');
      setSheetHeight(55);
    } else {
      // 吸附到作战档
      setCurrentSnap('BATTLE');
      setSheetHeight(92);
    }
  };

  // 事件防劫持监听
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => { e.preventDefault(); onDragMove(e.clientY); };
    const handleTouchMove = (e) => { 
      if (e.cancelable) e.preventDefault(); 
      onDragMove(e.touches[0].clientY); 
    };
    const handleMouseUp = () => onDragEnd();
    const handleTouchEnd = () => onDragEnd();

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, sheetHeight]);

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onDismiss}
      />

      {/* 抽屉机甲主体 */}
      <div
        className={`fixed bottom-0 left-0 w-full z-[3001] flex flex-col overflow-hidden ${
          isDragging ? '' : 'transition-all duration-300 ease-out'
        }`}
        style={{
          height: `${sheetHeight}dvh`,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          backgroundColor: '#f8fafc', // 强制给主体一个底色
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.8)'
        }}
      >
        {/* 🚀 核心修复：顶部拉环区 (全内联样式，绝对防弹) */}
        <div
          style={{
            width: '100%',
            height: '48px', // 加宽触控区域
            backgroundColor: '#0f172a', // 强制深色头部，让金条显现
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none', // 强制禁用浏览器自带下拉刷新
            userSelect: 'none',
            borderBottom: '1px solid #fbbf24' // 琥珀金分割线
          }}
          onMouseDown={(e) => onDragStart(e.clientY)}
          onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
        >
          {/* 🌟 绝对可见的发光指示器 (金条) */}
          <div
            style={{
              width: '60px',
              height: isDragging ? '8px' : '5px',
              backgroundColor: '#fbbf24',
              borderRadius: '999px',
              boxShadow: '0 0 12px #fbbf24',
              transition: 'all 0.2s ease-out'
            }}
          ></div>

          {/* 左侧状态文字 */}
          <div style={{ position: 'absolute', left: '20px', color: '#fbbf24', opacity: 0.5, fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '2px' }}>
            {currentSnap === 'BATTLE' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {currentSnap === 'SCOUT' ? 'RECON' : currentSnap === 'MIDDLE' ? 'MIDDLE' : 'FULL'}
          </div>

          {/* 右侧关闭按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            style={{
              position: 'absolute',
              right: '15px',
              padding: '6px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容注入区 */}
        <div className="flex-1 overflow-y-auto p-4 pb-10">
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
      </div>
    </>
  );
};

export default TacticalBottomSheet;