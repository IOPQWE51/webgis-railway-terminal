import './StationMasterCat.css';

// 🐱 猫站长：SVG 分层角色，state 由 catStateMachine 驱动
// inputLength 用于瞳孔跟随输入（0-24 映射到 ±6px 视线偏移）
const StationMasterCat = ({ state = 'idle', inputLength = 0 }) => {
    const pupilShift = Math.max(-6, Math.min(6, (Math.min(inputLength, 24) / 24) * 12 - 6));
    return (
        <div className={`smc smc--${state}`} aria-hidden="true">
            <svg viewBox="0 0 220 210" className="smc__svg">
                {/* 尾巴 */}
                <g className="smc__tail">
                    <path d="M158 168 Q 196 160 190 122" fill="none" stroke="#e8a13d" strokeWidth="14" strokeLinecap="round" />
                    <path d="M190 122 Q 188 110 178 108" fill="none" stroke="#6b5b4e" strokeWidth="14" strokeLinecap="round" />
                </g>
                {/* 身体与花斑 */}
                <ellipse cx="110" cy="165" rx="50" ry="36" fill="#f5e9d7" />
                <ellipse cx="86" cy="150" rx="16" ry="20" fill="#e8a13d" opacity="0.85" />
                <ellipse cx="134" cy="172" rx="14" ry="16" fill="#6b5b4e" opacity="0.8" />
                {/* 站长领巾 + 铃铛 */}
                <path d="M84 138 Q 110 152 136 138 L 136 150 Q 110 164 84 150 Z" fill="#c2452d" />
                <circle cx="110" cy="152" r="5" fill="#fbbf24" />
                {/* 双爪（covering 时上移捂眼） */}
                <g className="smc__paw smc__paw--l"><ellipse cx="86" cy="150" rx="13" ry="10" fill="#f5e9d7" stroke="#d9c6a8" /></g>
                <g className="smc__paw smc__paw--r"><ellipse cx="134" cy="150" rx="13" ry="10" fill="#f5e9d7" stroke="#d9c6a8" /></g>
                {/* 头 */}
                <g className="smc__head">
                    <path d="M76 66 L84 30 L108 56 Z" fill="#f5e9d7" />
                    <path d="M82 58 L86 40 L100 55 Z" fill="#e8a1a1" />
                    <path d="M144 66 L136 30 L112 56 Z" fill="#f5e9d7" />
                    <path d="M138 58 L134 40 L120 55 Z" fill="#e8a1a1" />
                    <circle cx="110" cy="95" r="44" fill="#f5e9d7" />
                    <path d="M70 80 Q 84 60 104 66 L 96 96 Q 78 96 70 80 Z" fill="#e8a13d" opacity="0.9" />
                    <path d="M150 80 Q 136 60 116 66 L 124 96 Q 142 96 150 80 Z" fill="#6b5b4e" opacity="0.85" />
                    {/* 左眼 */}
                    <g className="smc__eye">
                        <ellipse cx="93" cy="92" rx="9" ry="10" fill="#fffdf6" />
                        <g className="smc__pupil" style={{ transform: `translateX(${pupilShift}px)` }}>
                            <circle cx="93" cy="93" r="4.5" fill="#2b2620" />
                            <circle cx="94.5" cy="91.5" r="1.4" fill="#fff" />
                        </g>
                        <rect className="smc__lid" x="83" y="82" width="20" height="20" fill="#f5e9d7" />
                    </g>
                    {/* 右眼 */}
                    <g className="smc__eye">
                        <ellipse cx="127" cy="92" rx="9" ry="10" fill="#fffdf6" />
                        <g className="smc__pupil" style={{ transform: `translateX(${pupilShift}px)` }}>
                            <circle cx="127" cy="93" r="4.5" fill="#2b2620" />
                            <circle cx="128.5" cy="91.5" r="1.4" fill="#fff" />
                        </g>
                        <rect className="smc__lid" x="117" y="82" width="20" height="20" fill="#f5e9d7" />
                    </g>
                    {/* success 弯月眼 */}
                    <g className="smc__happy">
                        <path d="M86 93 Q 93 86 100 93" fill="none" stroke="#2b2620" strokeWidth="3" strokeLinecap="round" />
                        <path d="M120 93 Q 127 86 134 93" fill="none" stroke="#2b2620" strokeWidth="3" strokeLinecap="round" />
                    </g>
                    {/* 鼻与嘴 */}
                    <path d="M106 106 L114 106 L110 111 Z" fill="#e88b8b" />
                    <path d="M110 111 Q 110 116 104 117 M110 111 Q 110 116 116 117" fill="none" stroke="#8a7a63" strokeWidth="1.6" strokeLinecap="round" />
                    {/* 胡须 */}
                    <g className="smc__whiskers" stroke="#b7a689" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M74 104 L52 100" /><path d="M74 110 L54 112" /><path d="M74 116 L56 122" />
                        <path d="M146 104 L168 100" /><path d="M146 110 L166 112" /><path d="M146 116 L164 122" />
                    </g>
                    {/* 站长制帽 */}
                    <path d="M78 56 Q 110 34 142 56 L 142 64 Q 110 46 78 64 Z" fill="#1e293b" />
                    <rect x="74" y="58" width="72" height="9" rx="4" fill="#0f172a" />
                    <circle cx="110" cy="44" r="6" fill="#fbbf24" />
                    {/* loading 头顶雷达 */}
                    <g className="smc__radar">
                        <circle cx="166" cy="52" r="10" fill="none" stroke="#fbbf24" strokeWidth="2" />
                        <line x1="166" y1="52" x2="166" y2="42" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                    </g>
                </g>
                {/* error HUD 红环 */}
                <circle className="smc__alert-ring" cx="110" cy="110" r="86" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 10" />
            </svg>
        </div>
    );
};

export default StationMasterCat;
