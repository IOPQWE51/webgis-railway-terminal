import { useEffect, useRef, useReducer, useState } from 'react';
import { X } from 'lucide-react';
import StationMasterCat from './StationMasterCat.jsx';
import { nextCatState } from './catStateMachine.js';

// 🛰️ 全屏认证覆盖层：猫站长陪你建立上行链路
export default function LoginOverlay({ onClose, onAuthenticated }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState(null); // { type: 'error' | 'ok', text }
    const [busy, setBusy] = useState(false);
    const [cat, dispatchCat] = useReducer(nextCatState, { name: 'idle', inputLength: 0 });

    const usernameRef = useRef(null);
    const overlayRef = useRef(null);
    const successTimerRef = useRef(null);

    // Fix 3：mount 即聚焦用户名，键盘用户打开弹层后可直接输入，不必先 Tab 寻址
    useEffect(() => {
        usernameRef.current?.focus();
    }, []);

    // Fix 4：卸载（Esc/关闭按钮）时清掉 success 跳转定时器，防止组件移除后仍触发 onAuthenticated
    useEffect(() => () => clearTimeout(successTimerRef.current), []);

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
        dispatchCat({ type: 'RESET' });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (locked) return; // Fix 4：busy 与 success 窗口都拒绝重复提交
        setBusy(true);
        setMessage(null);
        dispatchCat({ type: 'SUBMIT' });
        try {
            const res = await fetch(`/api/auth?action=${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                dispatchCat({ type: 'SUBMIT_SUCCESS' });
                setMessage({
                    type: 'ok',
                    text: mode === 'register' ? `节点 ${data.username} 已注册，正在认领点位库...` : 'ACCESS GRANTED — 上行链路已建立'
                });
                // Fix 4：timer 存 ref，卸载时由 useEffect cleanup 兜底清除
                successTimerRef.current = setTimeout(() => onAuthenticated(data.username), 1100);
                return;
            }
            dispatchCat({ type: 'SUBMIT_FAIL' });
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
            className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
            role="dialog"
            aria-modal="true"
            aria-label="身份认证"
        >
            <div className="relative w-full max-w-md bg-zinc-900 border border-amber-400/40 rounded-3xl shadow-2xl p-8 font-mono">
                <button onClick={onClose} aria-label="关闭" className="absolute top-4 right-4 w-8 h-8 rounded-lg border border-zinc-700 text-zinc-400 hover:text-amber-300 hover:border-amber-400/50 transition-colors">
                    <X className="w-4 h-4 mx-auto" />
                </button>

                <p className="text-amber-400 text-[10px] tracking-[0.35em] uppercase mb-1">UPLINK TERMINAL</p>
                <h2 className="text-amber-300 text-xl font-black tracking-widest mb-1">
                    {mode === 'login' ? '建立上行链路' : '注册新终端节点'}
                </h2>
                <p className="text-zinc-500 text-xs mb-4">STATION MASTER ON DUTY · 猫站长值机中</p>

                <StationMasterCat state={cat.name} inputLength={cat.inputLength} />

                <form onSubmit={submit} className="space-y-3 mt-2">
                    <label className="block">
                        <span className="text-zinc-400 text-[10px] tracking-[0.25em] uppercase">节点代号 NODE ID</span>
                        <input
                            ref={usernameRef}
                            type="text"
                            value={username}
                            autoComplete="username"
                            spellCheck="false"
                            disabled={locked}
                            onChange={(e) => { setUsername(e.target.value); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                            onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: username.length })}
                            onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                            className="mt-1 w-full bg-black/60 border border-zinc-700 focus:border-amber-400/60 rounded-xl px-4 py-2.5 text-amber-200 text-sm outline-none transition-colors"
                        />
                    </label>
                    <label className="block">
                        <span className="text-zinc-400 text-[10px] tracking-[0.25em] uppercase">访问密钥 ACCESS KEY</span>
                        <input
                            type="password"
                            value={password}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            disabled={locked}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => dispatchCat({ type: 'PASSWORD_FOCUS' })}
                            onBlur={() => dispatchCat({ type: 'PASSWORD_BLUR' })}
                            className="mt-1 w-full bg-black/60 border border-zinc-700 focus:border-amber-400/60 rounded-xl px-4 py-2.5 text-amber-200 text-sm outline-none transition-colors"
                        />
                    </label>

                    {/* Fix 6：aria-live 容器常驻（空态输出不换行空格占位），读屏才能可靠播报动态插入的消息 */}
                    <p
                        aria-live="polite"
                        className={`text-xs font-bold ${message?.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}
                    >
                        {message ? `${message.type === 'error' ? '> SIGNAL LOST: ' : '> '}${message.text}` : '\u00A0'}
                    </p>

                    <button
                        type="submit"
                        disabled={locked || !username || !password}
                        className="w-full py-3 rounded-xl bg-amber-400 text-zinc-900 font-black tracking-[0.3em] text-sm hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        {mode === 'login' ? '▶ 建立上行链路' : '▸ 注册新节点'}
                    </button>
                </form>

                <div className="flex justify-center gap-2 mt-4">
                    <button onClick={() => switchMode('login')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'login' ? 'border-amber-400/60 text-amber-300' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>登录</button>
                    <button onClick={() => switchMode('register')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'register' ? 'border-amber-400/60 text-amber-300' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>注册</button>
                </div>
                <p className="text-zinc-600 text-[10px] text-center mt-4 tracking-wider">匿名模式下数据仅保存在本机 · 建立链路后跨设备漫游</p>
            </div>
        </div>
    );
}
