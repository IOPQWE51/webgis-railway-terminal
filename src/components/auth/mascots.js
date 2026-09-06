// 🎭 吉祥物角色注册表
// LoginOverlay 只依赖两个 props：state（六态）+ inputLength（瞳孔/视线跟随）。
// 想换角色 = 在这里加一个条目 + 把 MASCOT_ID 改成它的 id，登录弹窗其余代码零改动。
//
// 每个角色条目约定：
//   component  — React 组件，签名 ({ state, inputLength }) => JSX
//                state ∈ CAT_STATES: idle | watching | covering | loading | error | success
//   tagline    — 弹窗副标语（跟角色称呼联动的那一行小字）
//   credit?    — 可选来源署名（原创角色留空；引用他人作品请自行确认授权并注明）

import StationMasterCat from './StationMasterCat.jsx';

export const MASCOTS = {
    // 🐱 初代：猫站长（原创 SVG，六态全动画）
    'station-master-cat': {
        component: StationMasterCat,
        tagline: 'STATION MASTER ON DUTY · 猫站长值机中',
    },
};

// 🎯 当前启用的角色 —— 换人改这一行就行
export const MASCOT_ID = 'station-master-cat';

export function getMascot(id = MASCOT_ID) {
    return MASCOTS[id] || MASCOTS[MASCOT_ID];
}
