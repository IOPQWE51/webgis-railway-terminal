import { useEffect, useRef, useState } from 'react';
import './AnimatedCharacters.css';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * 🎭 互动几何小人团队（灵感源自经典 Animated Characters Login）
 * - 平时跟随鼠标视线并自然眨眼
 * - 输入用户名时好奇前倾、视线随字符推进
 * - 输入密码 / 点开显示密码时主动扭头回避视线
 * - 提交中轻跳、报错轻晃、登录成功欢呼跳跃
 */
export default function AnimatedCharacters({ state = 'idle', inputLength = 0, showPassword = false }) {
    const stageRef = useRef(null);
    const [pointer, setPointer] = useState({ x: 0, y: 0 }); // 归一化 [-1, 1]
    const [blinkPurple, setBlinkPurple] = useState(false);
    const [blinkBlack, setBlinkBlack] = useState(false);

    // 跟随鼠标移动（仅桌面细指针响应，避免移动端抖动）
    useEffect(() => {
        const onMove = (e) => {
            const el = stageRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const nx = clamp((e.clientX - cx) / 320, -1, 1);
            const ny = clamp((e.clientY - cy) / 260, -1, 1);
            setPointer({ x: nx, y: ny });
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        return () => window.removeEventListener('mousemove', onMove);
    }, []);

    // 独立错峰自然眨眼
    useEffect(() => {
        let t1;
        let t2;
        const schedule = (setter, baseMs) => {
            const delay = baseMs + Math.random() * 2400;
            return setTimeout(() => {
                setter(true);
                setTimeout(() => {
                    setter(false);
                    if (setter === setBlinkPurple) t1 = schedule(setter, baseMs);
                    else t2 = schedule(setter, baseMs);
                }, 130);
            }, delay);
        };
        t1 = schedule(setBlinkPurple, 2600);
        t2 = schedule(setBlinkBlack, 3400);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);

    // 计算当前视线向量 (gx, gy) ∈ [-1, 1]
    const isPasswordExposed = state === 'covering' && showPassword;
    const isPasswordHidden = state === 'covering' && !showPassword;
    const isWatching = state === 'watching';

    let gx = pointer.x;
    let gy = pointer.y;

    if (isPasswordExposed) {
        // 密码明文展示 → 集体礼貌扭头向左看
        gx = -1;
        gy = -0.35;
    } else if (isPasswordHidden) {
        // 正在输密码 → 略微低头收敛视线
        gx = -0.55;
        gy = 0.25;
    } else if (isWatching) {
        // 正在输用户名 → 好奇向右望向输入框，随字数微调高度
        const progress = clamp(inputLength / 20, 0, 1);
        gx = 0.78 + progress * 0.22;
        gy = -0.1 + progress * 0.28;
    } else if (state === 'success') {
        gx = 0;
        gy = -0.5;
    }

    // 身体微倾姿态（transform: skewX / translate）
    const purpleBody = isPasswordExposed
        ? 'skewX(6deg) translateX(-8px)'
        : isWatching
            ? 'skewX(-7deg) translateX(10px)'
            : isPasswordHidden
                ? 'skewX(3deg) translateX(-3px)'
                : `skewX(${(-gx * 3.5).toFixed(1)}deg)`;

    const blackBody = isPasswordExposed
        ? 'skewX(5deg) translateX(-6px)'
        : isWatching
            ? 'skewX(-5deg) translateX(7px)'
            : `skewX(${(-gx * 2.5).toFixed(1)}deg)`;

    const orangeBody = isPasswordExposed
        ? 'skewX(4deg) translateX(-5px)'
        : isWatching
            ? 'skewX(-4deg) translateX(6px)'
            : `skewX(${(-gx * 2).toFixed(1)}deg)`;

    const yellowBody = isPasswordExposed
        ? 'skewX(6deg) translateX(-7px)'
        : isWatching
            ? 'skewX(-5deg) translateX(6px)'
            : `skewX(${(-gx * 2.5).toFixed(1)}deg)`;

    // 瞳孔偏移（像素）
    const px = (gx * 3.2).toFixed(1);
    const py = (gy * 2.8).toFixed(1);

    // 脸部整体微移（增加立体转向感）
    const fx = (gx * 7).toFixed(1);
    const fy = (gy * 4.5).toFixed(1);

    return (
        <div
            ref={stageRef}
            className={`ac-stage state-${state}`}
            aria-hidden="true"
        >
            {/* 1. 紫色高个子 */}
            <div className="ac-char ac-purple" style={{ transform: purpleBody }}>
                <div
                    className="ac-face flex flex-col items-center gap-1.5"
                    style={{ top: '26px', left: '46px', transform: `translate(${fx}px, ${fy}px)` }}
                >
                    <div className="flex items-center gap-3.5">
                        <div className={`ac-eye-white ${blinkPurple ? 'is-blinking' : ''}`}>
                            <div className="ac-pupil" style={{ transform: `translate(${px}px, ${py}px)` }} />
                        </div>
                        <div className={`ac-eye-white ${blinkPurple ? 'is-blinking' : ''}`}>
                            <div className="ac-pupil" style={{ transform: `translate(${px}px, ${py}px)` }} />
                        </div>
                    </div>
                    {/* 极简竖条嘴 */}
                    <div
                        className="bg-[#181a20] rounded-full transition-all duration-200"
                        style={{
                            width: state === 'success' ? '12px' : '4px',
                            height: state === 'success' ? '6px' : '16px',
                            borderRadius: state === 'success' ? '0 0 99px 99px' : '99px',
                        }}
                    />
                </div>
            </div>

            {/* 2. 炭黑中个子 */}
            <div className="ac-char ac-black" style={{ transform: blackBody }}>
                <div
                    className="ac-face flex items-center gap-2.5"
                    style={{ top: '22px', left: '26px', transform: `translate(${fx}px, ${fy}px)` }}
                >
                    <div className={`ac-eye-white ${blinkBlack ? 'is-blinking' : ''}`}>
                        <div className="ac-pupil" style={{ transform: `translate(${px}px, ${py}px)` }} />
                    </div>
                    <div className={`ac-eye-white ${blinkBlack ? 'is-blinking' : ''}`}>
                        <div className="ac-pupil" style={{ transform: `translate(${px}px, ${py}px)` }} />
                    </div>
                </div>
            </div>

            {/* 3. 暖橙半圆团子 */}
            <div className="ac-char ac-orange" style={{ transform: orangeBody }}>
                <div
                    className="ac-face flex items-center gap-3.5"
                    style={{ top: '34px', left: '72px', transform: `translate(${(gx * 9).toFixed(1)}px, ${(gy * 5).toFixed(1)}px)` }}
                >
                    <div className="ac-eye-dot" />
                    {/* 中间小圆嘴（略低一点形成俏皮三角） */}
                    <div
                        className="rounded-full bg-[#181a20] transition-transform duration-200"
                        style={{
                            width: state === 'success' ? '11px' : '7px',
                            height: state === 'success' ? '7px' : '7px',
                            transform: 'translateY(6px)',
                        }}
                    />
                    <div className="ac-eye-dot" />
                </div>
            </div>

            {/* 4. 明黄小鸟块 */}
            <div className="ac-char ac-yellow" style={{ transform: yellowBody }}>
                <div
                    className="ac-face flex items-center"
                    style={{ top: '30px', left: '44px', transform: `translate(${(gx * 6).toFixed(1)}px, ${(gy * 4).toFixed(1)}px)` }}
                >
                    <div className="ac-eye-dot" />
                </div>
                {/* 标志性黑色横喙 */}
                <div
                    className="ac-face bg-[#181a20] rounded-full"
                    style={{
                        top: '56px',
                        left: isPasswordExposed ? '18px' : '58px',
                        width: '34px',
                        height: '5px',
                        transform: `translate(${(gx * 5).toFixed(1)}px, ${(gy * 3).toFixed(1)}px)`,
                    }}
                />
            </div>
        </div>
    );
}
