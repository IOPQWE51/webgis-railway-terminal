import { useEffect, useRef, useReducer, useState } from 'react';
import { X, Eye, EyeOff, Sparkles } from 'lucide-react';
import { getMascot } from './mascots.js';
import { nextCatState } from './catStateMachine.js';

// 🤖 Turnstile 人机验证站点密钥（构建期注入；未配置=验证关闭，后端同步跳过）
// 🧪 测试后门：URL 带 ?test=1 时换用官方"永远通过"密钥（组件秒绿勾，无需真实挑战），
//    便于本机/线上自动化回归——不带参数的普通访客照常走真实验证，防线不撤
const TURNSTILE_TEST_SITEKEY = '1x00000000000000000000AA';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
    ? (new URLSearchParams(window.location.search).get('test') === '114514' ? TURNSTILE_TEST_SITEKEY : import.meta.env.VITE_TURNSTILE_SITE_KEY)
    : '';

// 🛰️ 全屏认证覆盖层：吉祥物陪你建立上行链路
// 🎭 吉祥物经 mascots.js 注册表解析（换角色零改本组件）；六态状态机为角色通用协议
const mascot = getMascot();
const MascotComponent = mascot.component;
const { tagline: MASCOT_TAGLINE } = mascot;

export default function LoginOverlay({ onClose, onAuthenticated }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [wantResend, setWantResend] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'error' | 'ok', text }
    const [busy, setBusy] = useState(false);
    const [cat, dispatchCat] = useReducer(nextCatState, { name: 'idle', inputLength: 0 });
    const [turnstileToken, setTurnstileToken] = useState('');

    const usernameRef = useRef(null);
    const overlayRef = useRef(null);
    const successTimerRef = useRef(null);
    const turnstileContainerRef = useRef(null);
    const turnstileWidgetRef = useRef(null);

    // Fix 3：mount 即聚焦用户名，键盘用户打开弹层后可直接输入，不必先 Tab 寻址
    useEffect(() => {
        usernameRef.current?.focus();
    }, []);

    // Fix 4：卸载（Esc/关闭按钮）时清掉 success 跳转定时器，防止组件移除后仍触发 onAuthenticated
    useEffect(() => () => clearTimeout(successTimerRef.current), []);

    // 🤖 Turnstile 组件渲染：脚本按需注入；令牌单次有效，提交失败后须 reset 重取
    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) return undefined;
        const renderWidget = () => {
            if (window.turnstile && turnstileContainerRef.current && !turnstileWidgetRef.current) {
                turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    theme: 'light',
                    callback: (token) => setTurnstileToken(token),
                    'expired-callback': () => setTurnstileToken(''),
                    // 🔍 组件加载/校验失败时把错误码亮到界面上（如 110200=域名未加入白名单），不再只露出神秘的 Troubleshoot 链接
                    'error-callback': (code) => {
                        setTurnstileToken('');
                        setMessage({ type: 'error', text: `人机验证组件异常（代码 ${code}）——请把该代码告知站长修复` });
                    }
                });
            }
        };
        if (window.turnstile) {
            renderWidget();
        } else {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.onload = renderWidget;
            document.head.appendChild(script);
        }
        return () => {
            if (turnstileWidgetRef.current && window.turnstile) {
                window.turnstile.remove(turnstileWidgetRef.current);
                turnstileWidgetRef.current = null;
            }
        };
    }, []);

    // Fix 4：busy 复位后、onAuthenticated 触发前的 success 窗口内锁住整个表单，防再提交
    const locked = busy || cat.name === 'success';

    // Fix 3：Esc 直接关闭；Tab 被拦截在覆盖层内首尾循环（焦点陷阱），
    // 防止焦点漂移到覆盖层背后的页面内容
    const handleOverlayKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (e.key !== 'Tab' || !overlayRef.current) return;
        // 覆盖层内可聚焦元素：关闭按钮、用户名/密码输入框、提交按钮、登录/注册切换
        const focusables = overlayRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;
        if (e.shiftKey) {
            if (current === first || !overlayRef.current.contains(current)) {
                e.preventDefault();
                last.focus();
            }
        } else if (current === last || !overlayRef.current.contains(current)) {
            e.preventDefault();
            first.focus();
        }
    };

    const switchMode = (next) => {
        setMode(next);
        setMessage(null);
        setWantResend(false);
        dispatchCat({ type: 'RESET' });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (locked) return; // Fix 4：busy 与 success 窗口都拒绝重复提交
        // 🤖 Turnstile 开启时必须已取到令牌（组件未就绪则按钮本就 disabled，此处兜底）
        if (TURNSTILE_SITE_KEY && !turnstileToken) return;
        setBusy(true);
        setMessage(null);
        dispatchCat({ type: 'SUBMIT' });
        try {
            // 📧 按模式组装负载：
            // - login: 代号+密钥；register: 代号+密钥+可选邮箱
            // - reset: 代号或注册邮箱（二选一，后端支持邮箱反查代号）
            // - verify-email: 代号+6位码；重发时代号+resend:1
            const body = mode === 'reset'
                ? { username: username || undefined, email: email.trim() || undefined, turnstileToken }
                : mode === 'register'
                    ? { username, password, email: email.trim() || undefined, turnstileToken }
                    : mode === 'verify'
                        ? (wantResend
                            ? { username, resend: '1', turnstileToken }
                            : { username, code: verifyCode.trim(), turnstileToken })
                        : { username, password, turnstileToken };
            const res = await fetch(`/api/auth?action=${mode === 'verify' ? 'verify-email' : mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                dispatchCat({ type: 'SUBMIT_SUCCESS' });
                if (mode === 'reset') {
                    // 🐾 找回不建立会话：展示战报后切回登录，等用户查邮件
                    setMessage({ type: 'ok', text: data.message || '重置邮件已发送，请查收邮箱' });
                    setBusy(false);
                    return;
                }
                setMessage({
                    type: 'ok',
                    text: mode === 'register'
                        ? `账号 ${data.username} 注册成功${email.trim() ? '，验证码已发往邮箱，请切到「验证」完成绑定' : ''}`
                        : '登录成功，云端同步已开启'
                });
                // Fix 4：timer 存 ref，卸载时由 useEffect cleanup 兜底清除
                successTimerRef.current = setTimeout(() => onAuthenticated(data.username), 1100);
                return;
            }
            dispatchCat({ type: 'SUBMIT_FAIL' });
            // 🤖 令牌被 siteverify 单次消费/已过期：失败后 reset 组件重取新令牌
            if (TURNSTILE_SITE_KEY && window.turnstile && turnstileWidgetRef.current) {
                window.turnstile.reset(turnstileWidgetRef.current);
            }
            setTurnstileToken('');
            // Fix 6：限流器 429 的中文提示在 message 字段（error 为英文 'Too many requests'），故优先取 message
            setMessage({ type: 'error', text: data.message || data.error || '请求失败，请稍后再试' });
        } catch {
            dispatchCat({ type: 'SUBMIT_FAIL' });
            setMessage({ type: 'error', text: '网络连接异常，请稍后重试' });
        } finally {
            setBusy(false);
        }
    };

    return (
        // Fix 3：keydown 挂在 role=dialog 容器上，Esc 关闭 + Tab 焦点陷阱
        // 纵深防御：z-[4000] 高于战术层 z-[3000]/z-[3001]（TacticalBottomSheet），
        // 未来即使战术模式内重新开放认证入口，弹层也不会被战术 UI 盖住
        <div
            ref={overlayRef}
            onKeyDown={handleOverlayKeyDown}
            className="fixed inset-0 z-[4000] flex items-center justify-center bg-ink/35 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="账号登录"
        >
            {/* 🎭 双栏分屏登录卡片：左侧互动几何小人舞台 + 右侧极简表单 */}
            <div className="relative w-full max-w-[820px] max-h-[calc(100dvh-2rem)] overflow-y-auto md:overflow-hidden bg-paper-2 border border-line rounded-[2rem] shadow-2xl grid grid-cols-1 md:grid-cols-2 custom-scrollbar">
                <button
                    onClick={onClose}
                    aria-label="关闭"
                    className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-paper-3/80 hover:bg-paper-3 text-ink-3 hover:text-ink transition-colors flex items-center justify-center"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* 左栏：轻盈浅灰舞台 + 互动几何小人 */}
                <div className="relative flex flex-col items-center justify-end bg-[#EEF1F6] pt-6 px-4 md:pt-10 md:px-6 overflow-hidden min-h-[190px] md:min-h-[520px]">
                    <div className="absolute top-5 left-6 hidden md:flex items-baseline gap-1 text-lg select-none">
                        <span className="font-display text-sora-deep">Earth</span>
                        <span className="font-display text-ink">Terminal</span>
                    </div>
                    <div className="origin-bottom scale-[0.58] sm:scale-[0.7] md:scale-100 -mb-1">
                        <MascotComponent
                            state={cat.name}
                            inputLength={cat.inputLength}
                            showPassword={showPassword}
                        />
                    </div>
                </div>

                {/* 右栏：干净克制的登录表单 */}
                <div className="flex flex-col justify-center p-6 sm:p-9 md:p-10 md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto custom-scrollbar">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-paper-3 text-ink mb-3">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <h2 className="text-ink text-2xl font-black tracking-tight">
                            {mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账号' : mode === 'reset' ? '找回密码' : '验证邮箱'}
                        </h2>
                        <p className="text-ink-3 text-xs mt-1.5">{MASCOT_TAGLINE}</p>
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <label className="block">
                            <span className="text-ink-2 text-xs font-bold">用户名</span>
                            <input
                                ref={usernameRef}
                                type="text"
                                value={username}
                                autoComplete="username"
                                spellCheck="false"
                                disabled={locked}
                                placeholder={mode === 'reset' ? '输入用户名（忘了可留空，填下方邮箱）' : '例如 traveler_01（3-24 位小写字母/数字/-/_）'}
                                onChange={(e) => { setUsername(e.target.value); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                                onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: username.length })}
                                onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                                className="mt-1 w-full bg-transparent border-0 border-b border-line focus:border-ink px-1 py-2 text-ink text-sm outline-none transition-colors placeholder:text-ink-3/60"
                            />
                        </label>

                        {(mode === 'register' || mode === 'reset') && (
                            <label className="block">
                                <span className="text-ink-2 text-xs font-bold">
                                    {mode === 'register' ? '邮箱（选填，用于找回密码）' : '注册邮箱（忘记用户名时填写）'}
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    autoComplete="email"
                                    disabled={locked}
                                    placeholder={mode === 'register' ? '用于接收密码重置邮件，也可不填' : '填写注册邮箱即可找回（与用户名二选一）'}
                                    onChange={(e) => { setEmail(e.target.value); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                                    onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: email.length })}
                                    onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                                    className="mt-1 w-full bg-transparent border-0 border-b border-line focus:border-ink px-1 py-2 text-ink text-sm outline-none transition-colors placeholder:text-ink-3/60"
                                />
                            </label>
                        )}

                        {mode === 'verify' && !wantResend && (
                            <label className="block">
                                <span className="text-ink-2 text-xs font-bold">邮件验证码</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={verifyCode}
                                    disabled={locked}
                                    placeholder="输入邮件收到的 6 位数字"
                                    onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                                    onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: verifyCode.length })}
                                    onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                                    className="mt-1 w-full bg-transparent border-0 border-b border-line focus:border-ink px-1 py-2 tracking-[0.5em] text-center text-ink text-sm font-mono outline-none transition-colors placeholder:text-ink-3/60 placeholder:tracking-normal placeholder:font-sans"
                                />
                            </label>
                        )}

                        {(mode === 'login' || mode === 'register') && (
                            <label className="block">
                                <span className="text-ink-2 text-xs font-bold">密码</span>
                                <div className="relative mt-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                        disabled={locked}
                                        placeholder="至少 8 位"
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => dispatchCat({ type: 'PASSWORD_FOCUS' })}
                                        onBlur={() => dispatchCat({ type: 'PASSWORD_BLUR' })}
                                        className="w-full bg-transparent border-0 border-b border-line focus:border-ink px-1 py-2 pr-9 text-ink text-sm outline-none transition-colors placeholder:text-ink-3/60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </label>
                        )}

                        {mode === 'verify' && (
                            <button type="button" onClick={() => { setWantResend(v => !v); setMessage(null); }} className="w-full text-center text-xs text-sora-deep hover:text-sora">
                                {wantResend ? '← 返回输入验证码' : '没收到验证码？点此重发 →'}
                            </button>
                        )}

                        {TURNSTILE_SITE_KEY && <div ref={turnstileContainerRef} className="flex justify-center items-center min-h-[65px]" />}

                        <p
                            aria-live="polite"
                            className={`text-xs font-bold min-h-[1rem] ${message?.type === 'error' ? 'text-koi' : 'text-wakaba'}`}
                        >
                            {message ? message.text : '\u00A0'}
                        </p>

                        <button
                            type="submit"
                            disabled={locked || (mode !== 'reset' && !username) || (mode === 'reset' && !username && !email.trim()) || ((mode === 'login' || mode === 'register') && !password) || (mode === 'verify' && !wantResend && verifyCode.length !== 6) || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
                            className="w-full py-3 rounded-full bg-ink text-white font-bold text-sm shadow-lift hover:bg-sora-deep disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                        >
                            {mode === 'login' ? '登录'
                                : mode === 'register' ? '注册账号'
                                : mode === 'reset' ? '发送重置邮件'
                                : wantResend ? '重新发送验证码' : '完成邮箱验证'}
                        </button>
                    </form>

                    <div className="flex justify-center gap-1.5 mt-5 pt-4 border-t border-line/70">
                        {[
                            { id: 'login', label: '登录' },
                            { id: 'register', label: '注册' },
                            { id: 'reset', label: '找回' },
                            { id: 'verify', label: '验证' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => switchMode(item.id)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                    mode === item.id
                                        ? 'bg-sora-soft text-sora-deep'
                                        : 'text-ink-3 hover:text-ink hover:bg-paper-3'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <p className="text-ink-3 text-[11px] text-center mt-3">
                        {mode === 'reset'
                            ? '用户名与注册邮箱二选一 · 仅已验证邮箱可收到重置邮件'
                            : mode === 'verify'
                                ? '输入用户名与邮件里的 6 位验证码 · 未收到可重发'
                                : '未登录时收藏保存在本机 · 登录后自动云端同步'}
                    </p>
                </div>
            </div>
        </div>
    );
}
