// src/components/QrViewShare.jsx
// 🔳 视角分享二维码：把当前地址栏（含 #lat=..&mode=tactical 深链接）变成手机可扫的码。
// 电脑上规划好视角 → 掏出手机扫码 → 同一视角直达。两轨道共用：
//   variant="light" 主地图控制台（浅色卡）；variant="dark" 战术 HUD（暗色终端卡）
//
// 依赖：零。qrEncode 纯函数生成矩阵，SVG rect 逐格渲染（模块数 ≤57×57，rect 量可接受）

import { useEffect, useMemo, useRef, useState } from 'react';
import { QrCode, X, Copy, Check } from 'lucide-react';
import { qrMatrix } from '../utils/qrEncode';

const PALETTES = {
  light: {
    card: 'bg-white border-gray-200 shadow-xl',
    text: 'text-gray-600',
    hint: 'text-gray-400',
    icon: 'text-cyan-600 hover:bg-cyan-50',
    qrBg: '#ffffff',
    qrFg: '#0f172a',
    label: 'text-gray-500',
    copyBtn: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  },
  dark: {
    card: 'bg-black/90 border-[rgba(251,191,36,0.3)] shadow-2xl backdrop-blur-md',
    text: 'text-[#fbbf24]',
    hint: 'text-[#64748b]',
    icon: 'text-[#fbbf24] hover:bg-[rgba(251,191,36,0.1)]',
    qrBg: '#050505',
    qrFg: '#fbbf24',
    label: 'text-[#94a3b8]',
    copyBtn: 'bg-[rgba(251,191,36,0.15)] text-[#fbbf24] hover:bg-[rgba(251,191,36,0.25)]',
  },
};

const QrViewShare = ({ variant = 'light', size = 180 }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // 📍 fixed 定位锚点：打开瞬间按按钮视口坐标计算（absolute 会被面板
  // overflow 滚动容器裁顶——线上实测弹出卡上半截被吃掉的教训）
  const btnRef = useRef(null);
  const [anchor, setAnchor] = useState(null); // { left, bottom, upward }
  const pal = PALETTES[variant];

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const popupH = size + 150; // 码 + 标题/按钮/提示的估算高度
      const upward = r.top > popupH + 16; // 上方放得下就向上弹，否则向下
      setAnchor({
        left: Math.min(Math.max(r.left + r.width / 2, 140), window.innerWidth - 140),
        bottom: window.innerHeight - (upward ? r.top : r.bottom) + (upward ? 8 : -8),
        upward,
      });
    }
    setOpen(true);
  };

  // 滚动/缩放时锚点失效 → 直接收起（比错位更体面）
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // 当前完整 URL（含 hash）——打开面板时快照，拖图不会边扫边变
  const shareUrl = useMemo(() => {
    if (!open) return '';
    return window.location.origin + window.location.pathname + window.location.hash;
  }, [open]);

  // 矩阵只在打开且有 URL 时生成；渲染失败（超长等）回退提示
  const matrix = useMemo(() => {
    if (!open || !shareUrl) return null;
    try {
      return qrMatrix(shareUrl);
    } catch {
      return null;
    }
  }, [open, shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* 剪贴板被拒（http/权限）时静默——用户可手选地址栏 */ }
  };

  const qrSvg = matrix && (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${matrix.length + 8} ${matrix.length + 8}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="视角分享二维码"
    >
      {/* 4 模块静区（QR 规范要求 ≥4）用底色 rect 表达 */}
      <rect width={matrix.length + 8} height={matrix.length + 8} fill={pal.qrBg} />
      {matrix.map((row, r) =>
        row.map((v, c) =>
          v === 1 ? (
            <rect key={`${r}-${c}`} x={c + 4} y={r + 4} width={1} height={1} fill={pal.qrFg} />
          ) : null
        )
      )}
    </svg>
  );

  return (
    <div>
      {/* 触发按钮：与所在面板的按钮体系风格一致 */}
      <button
        ref={btnRef}
        onClick={toggle}
        className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${pal.icon} ${variant === 'dark' ? 'border border-[rgba(251,191,36,0.3)] tracking-widest' : 'bg-white border border-gray-200 shadow-sm hover:shadow'}`}
        aria-expanded={open}
        title="把当前视角变成二维码，手机扫码直达"
      >
        <QrCode className="w-4 h-4" />
        {variant === 'dark' ? 'QR_SHARE' : '视角二维码'}
      </button>

      {/* fixed 定位：逃出面板 overflow 裁剪，按打开时的按钮视口坐标锚定 */}
      {open && anchor && (
        <div
          className={`fixed z-[3000] rounded-2xl p-4 w-max max-w-[260px] flex flex-col items-center gap-3 animate-in fade-in duration-200 ${pal.card}`}
          style={{
            left: anchor.left,
            ...(anchor.upward
              ? { bottom: anchor.bottom }
              : { top: window.innerHeight - anchor.bottom }),
          }}
          role="dialog"
          aria-label="视角分享二维码"
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-1 rounded-full text-current opacity-40 hover:opacity-100 transition-opacity"
            aria-label="关闭二维码"
          >
            <X className="w-4 h-4" />
          </button>

          {qrSvg ? (
            <>
              <div className={`text-[11px] font-bold tracking-widest ${pal.text}`}>
                {variant === 'dark' ? '◉ SCAN TO SYNC VIEW' : '扫码同步此视角'}
              </div>
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: variant === 'dark' ? 'rgba(251,191,36,0.25)' : '#e5e7eb' }}>
                {qrSvg}
              </div>
              <button
                onClick={copyLink}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${pal.copyBtn}`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '已复制' : '复制链接'}
              </button>
              <div className={`text-[10px] leading-relaxed text-center ${pal.hint}`}>
                {variant === 'dark' ? '同一战术视角直达对方设备' : '手机扫码打开同一视角，电脑规划 → 手机带走'}
              </div>
            </>
          ) : (
            <div className={`text-xs ${pal.hint}`}>当前地址过长，无法生成二维码，请复制地址栏分享</div>
          )}
        </div>
      )}
    </div>
  );
};

export default QrViewShare;
