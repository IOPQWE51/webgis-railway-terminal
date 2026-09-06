import { describe, it, expect } from 'vitest';
import { nextCatState, CAT_STATES } from '../src/components/auth/catStateMachine.js';

const IDLE = { name: 'idle', inputLength: 0 };
// 约定：nextCatState(state, event) —— 与 useReducer 的 reducer(state, action) 签名一致

describe('猫站长状态机', () => {
    it('暴露六种状态', () => {
        expect(CAT_STATES).toEqual(['idle', 'watching', 'covering', 'loading', 'error', 'success']);
    });
    it('聚焦用户名 → watching 并携带输入长度', () => {
        expect(nextCatState(IDLE, { type: 'USERNAME_FOCUS', inputLength: 3 }))
            .toEqual({ name: 'watching', inputLength: 3 });
    });
    it('watching 中输入更新长度；idle 收到 INPUT 升回 watching（mode 切换后瞳孔恢复跟随）；loading/covering 等忽略', () => {
        const watching = { name: 'watching', inputLength: 2 };
        expect(nextCatState(watching, { type: 'USERNAME_INPUT', inputLength: 5 }))
            .toEqual({ name: 'watching', inputLength: 5 });
        // mode 切换（RESET→idle）后继续打字：必须重新进入 watching，瞳孔才不会失联
        expect(nextCatState(IDLE, { type: 'USERNAME_INPUT', inputLength: 5 }))
            .toEqual({ name: 'watching', inputLength: 5 });
        const loading = { name: 'loading', inputLength: 0 };
        expect(nextCatState(loading, { type: 'USERNAME_INPUT', inputLength: 5 })).toBe(loading);
        const covering = { name: 'covering', inputLength: 0 };
        expect(nextCatState(covering, { type: 'USERNAME_INPUT', inputLength: 5 })).toBe(covering);
    });
    it('用户名失焦回 idle；covering 时忽略', () => {
        expect(nextCatState({ name: 'watching', inputLength: 9 }, { type: 'USERNAME_BLUR' })).toEqual(IDLE);
        expect(nextCatState({ name: 'covering', inputLength: 0 }, { type: 'USERNAME_BLUR' })).toEqual({ name: 'covering', inputLength: 0 });
    });
    it('聚焦密码 → covering（loading/success 中不覆盖）', () => {
        expect(nextCatState(IDLE, { type: 'PASSWORD_FOCUS' })).toEqual({ name: 'covering', inputLength: 0 });
        expect(nextCatState({ name: 'error', inputLength: 0 }, { type: 'PASSWORD_FOCUS' })).toEqual({ name: 'covering', inputLength: 0 });
        const loading = { name: 'loading', inputLength: 0 };
        expect(nextCatState(loading, { type: 'PASSWORD_FOCUS' })).toBe(loading);
        const success = { name: 'success', inputLength: 0 };
        expect(nextCatState(success, { type: 'PASSWORD_FOCUS' })).toBe(success);
    });
    it('密码失焦回 idle；提交进入 loading；失败→error；成功→success；RESET 归位', () => {
        expect(nextCatState({ name: 'covering', inputLength: 0 }, { type: 'PASSWORD_BLUR' })).toEqual(IDLE);
        expect(nextCatState(IDLE, { type: 'SUBMIT' })).toEqual({ name: 'loading', inputLength: 0 });
        expect(nextCatState({ name: 'loading', inputLength: 0 }, { type: 'SUBMIT_FAIL' })).toEqual({ name: 'error', inputLength: 0 });
        expect(nextCatState({ name: 'loading', inputLength: 0 }, { type: 'SUBMIT_SUCCESS' })).toEqual({ name: 'success', inputLength: 0 });
        expect(nextCatState({ name: 'error', inputLength: 0 }, { type: 'RESET' })).toEqual(IDLE);
    });
    it('未知事件原样返回', () => {
        expect(nextCatState(IDLE, { type: 'NOPE' })).toBe(IDLE);
    });
});
