// src/hooks/usePoints.js
// 🎯 统一点位库 hook（施工图 #9）—— 主地图与 dark2d 战术库共用一条同步链
//
// 统一前两轨各自为政：App.jsx 手写全链（含 v2 合并/盖戳/会话自愈），
// MapTactical.jsx 只有裸版（拉云覆盖 + 无守卫直写）。
// 统一后两轨零成本获得：
//   1. v2 LWW 合并（mergeOnPull，同 id updatedAt 新者胜）
//   2. 写前内容变化点盖 updatedAt 戳
//   3. 三个防御：空云库守卫（[] 不清本地）/ 会话过期自愈（401 翻匿名）/
//      登出不清点位（session 与点位生命周期解耦）
// scope：'main' → points:<u> + earth_terminal_custom_points
//        'dark2d' → points:<u>:dark2d + earth_terminal_dark2d_points
//
// 注意：本 hook 自带 session 状态（auth me 探测）—— App 侧由本 hook 接管会话徽章数据源。

import { useState, useEffect, useRef, useCallback } from 'react';
import { storage } from '../utils/performanceHelpers';
import { mergeOnPull } from '../utils/pointsMerge';

const CONFIG = {
  main: { storageKey: 'earth_terminal_custom_points', query: '', legacyKey: 'railway_custom_points' },
  dark2d: { storageKey: 'earth_terminal_dark2d_points', query: '?scope=dark2d', legacyKey: null },
};

/** 初始点位：新键直读；主轨空则一次性搬家旧键（railway_custom_points 时代数据不丢） */
function loadInitialPoints(cfg) {
  const saved = storage.load(cfg.storageKey, null);
  if (!saved && cfg.legacyKey) {
    const oldData = storage.load(cfg.legacyKey, null);
    if (Array.isArray(oldData) && oldData.length > 0) {
      storage.save(cfg.storageKey, oldData);
      return oldData;
    }
  }
  return saved || [];
}

export function usePoints(scope = 'main') {
  const cfg = CONFIG[scope] || CONFIG.main;

  const [points, setPoints] = useState(() => loadInitialPoints(cfg));
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // 渲染期同步 ref：合并/盖戳读最新点位，避免 stale 闭包（对齐 App 原 sessionRef 模式；
  // ⚠️ 必须声明在 points 之后 —— 前置引用未声明 state 是 TDZ 白屏事故的直接根因）
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // 🛰️ 会话恢复：GET /api/auth?action=me（匿名/本地模式静默通过）
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth?action=me');
        if (res.ok) {
          const json = await res.json();
          if (json.username) setSession(json.username);
        }
      } catch {
        /* 认证服务未连接 = 本地沙盒模式 */
      } finally {
        setSessionChecked(true);
      }
    })();
  }, []);

  // ☁️ 登录拉云：v2 合并 + 差异回推；匿名不发云请求
  useEffect(() => {
    if (!session) return undefined;
    (async () => {
      setIsCloudSyncing(true);
      try {
        const res = await fetch(`/api/points${cfg.query}`);
        if (res.ok) {
          const json = await res.json();
          // 🈳 空云库守卫：[] 视为"云端还没有数据"而非"清空指令"
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            const merged = mergeOnPull(pointsRef.current, json.data);
            setPoints(merged);
            storage.save(cfg.storageKey, merged);
            // 合并结果与云端有差异时回推落库
            if (merged.length !== json.data.length ||
                JSON.stringify(merged) !== JSON.stringify(json.data)) {
              fetch(`/api/points${cfg.query}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(merged),
              }).catch(() => {});
            }
          }
        }
      } catch {
        /* 云端未连接 = 本地沙盒模式 */
      } finally {
        setIsCloudSyncing(false);
      }
    })();
  }, [session, cfg.query, cfg.storageKey]);

  // 🔵 数据更新中枢：乐观本地 → 匿名止步 / 登录则盖戳推云
  const updatePoints = useCallback((newPointsArray) => {
    setPoints(newPointsArray);
    storage.save(cfg.storageKey, newPointsArray);

    if (!sessionRef.current) return; // 匿名：仅本地

    // ⏱️ 写前只对内容变化点盖 updatedAt
    const prev = new Map(pointsRef.current.map((p) => [String(p.id), p]));
    const stamped = newPointsArray.map((p) => {
      const old = prev.get(String(p.id));
      const changed = !old || old.name !== p.name || old.lat !== p.lat || old.lon !== p.lon
        || old.category !== p.category || (old.group || '') !== (p.group || '');
      return changed ? { ...p, updatedAt: Date.now() } : p;
    });

    (async () => {
      try {
        const res = await fetch(`/api/points${cfg.query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stamped),
        });
        if (res.status === 401) setSession(null); // 🔑 会话过期自愈
      } catch {
        /* 云端写失败只警告不弹窗 */
      }
    })();
  }, [cfg.query, cfg.storageKey]);

  // 🚪 登出：服务端清 Cookie；点位与本地缓存原样保留
  const logout = useCallback(async () => {
    try { await fetch('/api/auth?action=logout', { method: 'POST' }); } catch { /* 忽略网络错误 */ }
    setSession(null);
  }, []);

  return { points, updatePoints, session, setSession, sessionChecked, isCloudSyncing, logout };
}

export default usePoints;
