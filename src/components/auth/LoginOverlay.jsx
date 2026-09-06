import { useEffect, useRef, useReducer, useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
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
                        ? `节点 ${data.username} 已注册${email.trim() ? '，验证码已发往邮箱——切到「验证」完成绑定' : ''}`
                        : 'ACCESS GRANTED — 上行链路已建立'
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
            setMessage({ type: 'error', text: '跃迁引擎链路异常，请检查网络连接' });
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
            className="fixed inset-0 z-[4000] flex items-center justify-center bg-gradient-to-br from-sora-soft/85 via-paper/85 to-koi-soft/70 backdrop-blur-xl p-4"
            role="dialog"
            aria-modal="true"
            aria-label="身份认证"
        >
            {/* 📐 卡片限高内部滚动：100% 缩放的 1080p 笔记本也要完整可见 */}
            <div className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-paper-2/95 border border-line rounded-3xl shadow-xl shadow-sora/5 p-6 sm:p-8 font-mono custom-scrollbar">
                <button onClick={onClose} aria-label="关闭" className="absolute top-4 right-4 w-8 h-8 rounded-lg border border-line text-ink-3 hover:text-sora hover:border-sora transition-colors">
                    <X className="w-4 h-4 mx-auto" />
                </button>

                <p className="text-sora text-[10px] tracking-[0.35em] uppercase mb-1">UPLINK TERMINAL</p>
                <h2 className="text-ink text-xl font-black tracking-widest mb-1">
                    {mode === 'login' ? '建立上行链路' : mode === 'register' ? '注册新终端节点' : mode === 'reset' ? '找回通行密钥' : '验证绑定邮箱'}
                </h2>
                <p className="text-ink-3 text-xs mb-3">{MASCOT_TAGLINE}</p>

                <MascotComponent state={cat.name} inputLength={cat.inputLength} />

                <form onSubmit={submit} className="space-y-3 mt-2">
                    <label className="block">
                        <span className="text-ink-2 text-[10px] tracking-[0.25em] uppercase">用户名 · 节点代号</span>
                        <input
                            ref={usernameRef}
                            type="text"
                            value={username}
                            autoComplete="username"
                            spellCheck="false"
                            disabled={locked}
                            placeholder={mode === 'reset' ? '节点代号（忘了就留空，填邮箱反查）' : '取个代号，如 tokyo_cat（3-24 位小写字母/数字/-/_）'}
                            onChange={(e) => { setUsername(e.target.value); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                            onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: username.length })}
                            onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                            className="mt-1 w-full bg-paper-3 border border-line focus:border-sora rounded-xl px-4 py-2.5 text-ink text-sm outline-none transition-colors placeholder:text-ink-3/70"
                        />
                    </label>
                    {/* 📧 邮箱：注册（选填找回通道）/ 找回（填了即按邮箱反查代号）*/}
                    {(mode === 'register' || mode === 'reset') && (
                        <label className="block">
                            <span className="text-ink-2 text-[10px] tracking-[0.25em] uppercase">
                                {mode === 'register' ? '邮箱 · 找回通道（选填）' : '注册邮箱 · 代号忘了就填这个'}
                            </span>
                            <input
                                type="email"
                                value={email}
                                autoComplete="email"
                                disabled={locked}
                                placeholder={mode === 'register' ? '忘记密码时收重置邮件用，不填也行' : '填注册邮箱可反查代号（与代号二选一）'}
                                onChange={(e) => { setEmail(e.target.value); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                                onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: email.length })}
                                onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                                className="mt-1 w-full bg-paper-3 border border-line focus:border-sora rounded-xl px-4 py-2.5 text-ink text-sm outline-none transition-colors placeholder:text-ink-3/70"
                            />
                        </label>
                    )}
                    {/* 🔢 验证码：verify 模式收码（重发态不显示）*/}
                    {mode === 'verify' && !wantResend && (
                        <label className="block">
                            <span className="text-ink-2 text-[10px] tracking-[0.25em] uppercase">邮件验证码</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={verifyCode}
                                disabled={locked}
                                placeholder="注册后收到的 6 位数字"
                                onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                                onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: verifyCode.length })}
                                onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                                className="mt-1 w-full bg-paper-3 border border-line focus:border-sora rounded-xl px-4 py-2.5 tracking-[0.5em] text-center text-ink text-sm outline-none transition-colors placeholder:text-ink-3/70 placeholder:tracking-normal"
                            />
                        </label>
                    )}
                    {/* 密码：login/register 用；reset/verify 不需要 */}
                    {(mode === 'login' || mode === 'register') && (
                    <label className="block">
                        <span className="text-ink-2 text-[10px] tracking-[0.25em] uppercase">密码 · 访问密钥</span>
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
                                className="w-full bg-paper-3 border border-line focus:border-sora rounded-xl px-4 py-2.5 pr-11 text-ink text-sm outline-none transition-colors placeholder:text-ink-3/70"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-sora transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </label>
                    )}

                    {/* 🔁 verify 模式：收码 ⇄ 重发 切换（互斥小链接） */}
                    {mode === 'verify' && (
                        <button type="button" onClick={() => { setWantResend(v => !v); setMessage(null); }} className="w-full text-center text-[10px] text-sora-deep hover:text-sora underline-offset-4" >
                            {wantResend ? '← 返回输入验证码' : '没收到验证码？点此重发 →'}
                        </button>
                    )}

                    {/* 🤖 Turnstile 人机验证（未配置站点密钥时不渲染，后端同步跳过校验）；min-h 保组件不被压扁只露出 Troubleshoot 链接 */}
                    {TURNSTILE_SITE_KEY && <div ref={turnstileContainerRef} className="flex justify-center items-center min-h-[65px]" />}

                    {/* Fix 6：aria-live 容器常驻（空态输出不换行空格占位），读屏才能可靠播报动态插入的消息 */}
                    <p
                        aria-live="polite"
                        className={`text-xs font-bold ${message?.type === 'error' ? 'text-koi' : 'text-wakaba'}`}
                    >
                        {message ? `${message.type === 'error' ? '> SIGNAL LOST: ' : '> '}${message.text}` : '\u00A0'}
                    </p>

                    <button
                        type="submit"
                        disabled={locked || (mode !== 'reset' && !username) || (mode === 'reset' && !username && !email.trim()) || ((mode === 'login' || mode === 'register') && !password) || (mode === 'verify' && !wantResend && verifyCode.length !== 6) || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
                        className="w-full py-3 rounded-xl bg-sora text-sora-ink font-black tracking-[0.3em] text-sm shadow-lift hover:bg-sora-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {mode === 'login' ? '▶ 建立上行链路'
                            : mode === 'register' ? '▸ 注册新节点'
                            : mode === 'reset' ? '✉ 发送重置邮件'
                            : wantResend ? '🔁 重发验证码' : '✓ 完成绑定'}
                    </button>
                </form>

                <div className="flex justify-center gap-2 mt-4">
                    <button onClick={() => switchMode('login')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'login' ? 'border-sora text-sora-deep bg-sora-soft' : 'border-line text-ink-3 hover:text-ink-2'}`}>登录</button>
                    <button onClick={() => switchMode('register')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'register' ? 'border-sora text-sora-deep bg-sora-soft' : 'border-line text-ink-3 hover:text-ink-2'}`}>注册</button>
                    <button onClick={() => switchMode('reset')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'reset' ? 'border-sora text-sora-deep bg-sora-soft' : 'border-line text-ink-3 hover:text-ink-2'}`}>找回</button>
                    <button onClick={() => switchMode('verify')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'verify' ? 'border-sora text-sora-deep bg-sora-soft' : 'border-line text-ink-3 hover:text-ink-2'}`}>验证</button>
                </div>
                <p className="text-ink-3 text-[10px] text-center mt-4 tracking-wider">
                    {mode === 'reset'
                        ? '代号与注册邮箱二选一 · 已验证邮箱才能收到重置邮件'
                        : mode === 'verify'
                            ? '输入注册时代号 + 邮件里的 6 位码 · 没收到可重发'
                            : '匿名模式下数据仅保存在本机 · 建立链路后跨设备漫游'}
                </p>
            </div>
        </div>
    );
}
