/**
 * 战术全息面板路由中心
 * 桌面端：渲染进右侧 DOM (#cyber-panel)
 * 移动端：发射广播，唤醒 React 战术抽屉
 */

export const openCyberPanel = (html) => {
    // 🕵️ 动态侦测：判断是否为移动端 (屏幕宽度 < 1024px)
    if (window.innerWidth < 1024) {
        // 【移动端】阻断原生 DOM，发射全息抽屉唤醒信号！
        const event = new CustomEvent('openTacticalBottomSheet', { detail: html });
        window.dispatchEvent(event);
        
        // 确保旧的面板绝对不出来捣乱
        const oldPanel = document.getElementById('cyber-panel');
        if (oldPanel) oldPanel.classList.add('hidden');
    } else {
        // 【PC端】走原有的右侧面板逻辑
        const panel = document.getElementById('cyber-panel');
        const content = document.getElementById('cyber-panel-content');
        if (panel && content) {
            content.innerHTML = html;
            panel.classList.remove('hidden');
            panel.setAttribute('aria-hidden', 'false');
        }
    }
};

export const closeCyberPanel = () => {
    // 广播关闭信号给移动端抽屉
    const event = new CustomEvent('closeTacticalBottomSheet');
    window.dispatchEvent(event);

    // 关闭 PC 端旧版 DOM 面板
    const panel = document.getElementById('cyber-panel');
    if (panel) {
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
    }
    const content = document.getElementById('cyber-panel-content');
    if (content) content.innerHTML = '';
};