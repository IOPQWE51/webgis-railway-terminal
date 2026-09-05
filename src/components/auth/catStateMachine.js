// 🐱 猫站长状态机：纯函数 reducer，跟随登录表单事件在六态间流转
// idle 待机 / watching 盯输入 / covering 捂眼 / loading 呼叫卫星 / error 摇头 / success 庆祝

export const CAT_STATES = ['idle', 'watching', 'covering', 'loading', 'error', 'success'];

export function nextCatState(event, state) {
    switch (event.type) {
        case 'USERNAME_FOCUS':
            return { name: 'watching', inputLength: event.inputLength ?? 0 };
        case 'USERNAME_INPUT':
            // watching 中更新长度；idle 态收到输入（mode 切换 RESET 后继续打字）升回 watching，
            // 否则瞳孔跟随失联，需 blur+refocus 才能恢复
            return state.name === 'watching' || state.name === 'idle'
                ? { name: 'watching', inputLength: event.inputLength ?? 0 }
                : state;
        case 'USERNAME_BLUR':
            return state.name === 'watching' ? { name: 'idle', inputLength: 0 } : state;
        case 'PASSWORD_FOCUS':
            return state.name === 'loading' || state.name === 'success'
                ? state
                : { name: 'covering', inputLength: 0 };
        case 'PASSWORD_BLUR':
            return state.name === 'covering' ? { name: 'idle', inputLength: 0 } : state;
        case 'SUBMIT':
            return { name: 'loading', inputLength: 0 };
        case 'SUBMIT_FAIL':
            return { name: 'error', inputLength: 0 };
        case 'SUBMIT_SUCCESS':
            return { name: 'success', inputLength: 0 };
        case 'RESET':
            return { name: 'idle', inputLength: 0 };
        default:
            return state;
    }
}
