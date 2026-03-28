/**
 * 全局侧栏 / 底部抽屉：把原 Leaflet Popup 内容渲染进 #cyber-panel-content
 */

export const openCyberPanel = (html) => {
    const panel = document.getElementById('cyber-panel');
    const content = document.getElementById('cyber-panel-content');
    if (!panel || !content) return;
    content.innerHTML = html;
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
};

export const closeCyberPanel = () => {
    const panel = document.getElementById('cyber-panel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    const content = document.getElementById('cyber-panel-content');
    if (content) content.innerHTML = '';
};
