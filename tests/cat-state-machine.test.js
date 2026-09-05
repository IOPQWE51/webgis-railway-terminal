import { describe, it, expect } from 'vitest';
import { nextCatState, CAT_STATES } from '../src/components/auth/catStateMachine.js';

const IDLE = { name: 'idle', inputLength: 0 };

describe('猫站长状态机', () => {
    it('暴露六种状态', () => {
        expect(CAT_STATES).toEqual(['idle', 'watching', 'covering', 'loading', 'error', 'success']);
    });
    it('聚焦用户名 → watching 并携带输入长度', () => {
        expect(nextCatState({ type: 'USERNAME_FOCUS', inputLength: 3 }, IDLE))
            .toEqual({ name: 'watching', inputLength: 3 });
    });
    it('watching 中输入更新长度；idle 收到 INPUT 升回 watching（mode 切换后瞳孔恢复跟随）；loading/covering 等忽略', () => {
        const watching = { name: 'watching', inputLength: 2 };
        expect(nextCatState({ type: 'USERNAME_INPUT', inputLength: 5 }, watching))
            .toEqual({ name: 'watching', inputLength: 5 });
        // mode 切换（RESET→idle）后继续打字：必须重新进入 watching，瞳孔才不会失联
        expect(nextCatState({ type: 'USERNAME_INPUT', inputLength: 5 }, IDLE))
            .toEqual({ name: 'watching', inputLength: 5 });
        const loading = { name: 'loading', inputLength: 0 };
        expect(nextCatState({ type: 'USERNAME_INPUT', inputLength: 5 }, loading)).toBe(loading);
        const covering = { name: 'covering', inputLength: 0 };
        expect(nextCatState({ type: 'USERNAME_INPUT', inputLength: 5 }, covering)).toBe(covering);
    });
    it('用户名失焦回 idle；covering 时忽略', () => {
        expect(nextCatState({ type: 'USERNAME_BLUR' }, { name: 'watching', inputLength: 9 })).toEqual(IDLE);
        expect(nextCatState({ type: 'USERNAME_BLUR' }, { name: 'covering', inputLength: 0 })).toEqual({ name: 'covering', inputLength: 0 });
    });
    it('聚焦密码 → covering（loading/success 中不覆盖）', () => {
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, IDLE)).toEqual({ name: 'covering', inputLength: 0 });
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, { name: 'error', inputLength: 0 })).toEqual({ name: 'covering', inputLength: 0 });
        const loading = { name: 'loading', inputLength: 0 };
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, loading)).toBe(loading);
        const success = { name: 'success', inputLength: 0 };
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, success)).toBe(success);
    });
    it('密码失焦回 idle；提交进入 loading；失败→error；成功→success；RESET 归位', () => {
        expect(nextCatState({ type: 'PASSWORD_BLUR' }, { name: 'covering', inputLength: 0 })).toEqual(IDLE);
        expect(nextCatState({ type: 'SUBMIT' }, IDLE)).toEqual({ name: 'loading', inputLength: 0 });
        expect(nextCatState({ type: 'SUBMIT_FAIL' }, { name: 'loading', inputLength: 0 })).toEqual({ name: 'error', inputLength: 0 });
        expect(nextCatState({ type: 'SUBMIT_SUCCESS' }, { name: 'loading', inputLength: 0 })).toEqual({ name: 'success', inputLength: 0 });
        expect(nextCatState({ type: 'RESET' }, { name: 'error', inputLength: 0 })).toEqual(IDLE);
    });
    it('未知事件原样返回', () => {
        expect(nextCatState({ type: 'NOPE' }, IDLE)).toBe(IDLE);
    });
});
