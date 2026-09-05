// api/usage-monitor.js
// 📊 API用量监控 - 定期检查各API使用情况，发送警告

import { isMonitorAuthorized } from './_lib/validation.js';

/**
 * Mapbox用量监控
 * 免费额度：100,000次/月
 * 警告阈值：70,000（70%）、85,000（85%）、95,000（95%）
 */
export default async function handler(req, res) {
    // 允许跨域请求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // 验证密钥（防止滥用）
    // 安全约定：服务端未配置 MONITOR_SECRET_KEY 时一律拒绝，
    // 绝不回退到硬编码默认值（旧版的 'monitor_secret_change_me' 回退已移除）。
    const { key } = req.query;
    if (!isMonitorAuthorized(key, process.env.MONITOR_SECRET_KEY)) {
        return res.status(403).json({ error: 'Forbidden: Invalid monitor key' });
    }

    try {
        // 📊 收集各API用量数据
        const usageReport = {
            timestamp: new Date().toISOString(),
            apis: {},
            alerts: []
        };

        // 1️⃣ Mapbox 用量监控
        const mapboxUsage = await getMapboxUsage();
        usageReport.apis.mapbox = mapboxUsage;

        // 检查是否需要发送警告
        if (mapboxUsage.currentMonth > 95000) {
            usageReport.alerts.push({
                api: 'mapbox',
                level: 'critical',
                message: `🚨 Mapbox用量已达 ${mapboxUsage.currentMonth}/100,000 (${mapboxUsage.percentage}%)`,
                recommendation: '立即检查是否有异常流量，考虑启用更严格的速率限制'
            });
        } else if (mapboxUsage.currentMonth > 85000) {
            usageReport.alerts.push({
                api: 'mapbox',
                level: 'warning',
                message: `⚠️ Mapbox用量已达 ${mapboxUsage.currentMonth}/100,000 (${mapboxUsage.percentage}%)`,
                recommendation: '关注用量增长趋势，准备升级方案或优化缓存策略'
            });
        } else if (mapboxUsage.currentMonth > 70000) {
            usageReport.alerts.push({
                api: 'mapbox',
                level: 'info',
                message: `ℹ️ Mapbox用量已达 ${mapboxUsage.currentMonth}/100,000 (${mapboxUsage.percentage}%)`,
                recommendation: '用量正常，继续监控'
            });
        }

        // 2️⃣ WeatherAPI 用量监控
        const weatherUsage = await getWeatherAPIUsage();
        usageReport.apis.weather = weatherUsage;

        if (weatherUsage.currentMonth > 900000) {
            usageReport.alerts.push({
                api: 'weather',
                level: 'warning',
                message: `⚠️ WeatherAPI用量已达 ${weatherUsage.currentMonth}/1,000,000 (${weatherUsage.percentage}%)`,
                recommendation: '检查缓存命中率，考虑延长缓存时间'
            });
        }

        // 3️⃣ 总结
        usageReport.summary = {
            totalAPIs: Object.keys(usageReport.apis).length,
            alertsCount: usageReport.alerts.length,
            status: usageReport.alerts.length > 0 ? 'attention_needed' : 'healthy'
        };

        // 📧 如果有警告，发送邮件（可选）
        if (usageReport.alerts.length > 0) {
            await sendUsageAlert(usageReport);
        }

        res.status(200).json(usageReport);

    } catch (error) {
        console.error('❌ 用量监控失败:', error.message);
        res.status(500).json({
            error: 'Usage monitoring failed'
        });
    }
}

/**
 * 获取 Mapbox 用量数据
 * 注意：这需要 Mapbox API 支持，或者手动估算
 */
async function getMapboxUsage() {
    // 方法1：通过 Mapbox Statistics API（如果有）
    // 方法2：基于请求日志估算（Vercel Analytics）
    // 方法3：简单的估算

    // 这里使用估算方法（实际应该从 Mapbox Dashboard 获取）
    const estimated = {
        currentMonth: 9000, // 估算值：100用户/天 × 3次 × 30天
        limit: 100000,
        percentage: '9%',
        projected: 9000, // 月底预测
        status: 'healthy'
    };

    // 如果有 Mapbox token，可以尝试获取真实数据
    // TODO: 实现 Mapbox Statistics API 调用

    return estimated;
}

/**
 * 获取 WeatherAPI 用量数据
 */
async function getWeatherAPIUsage() {
    const estimated = {
        currentMonth: 9000, // 与 Mapbox 相同
        limit: 1000000,
        percentage: '0.9%',
        projected: 9000,
        status: 'healthy'
    };

    return estimated;
}

/**
 * 发送用量警告邮件
 * @param {Object} report - 用量报告
 */
async function sendUsageAlert(report) {
    // 方法1：使用 SendGrid
    // 方法2：使用 Resend
    // 方法3：使用 Vercel Cron Job + Webhook

    console.log('📧 用量警告:', report.alerts);

    // TODO: 实现邮件发送逻辑（届时再引入 generateEmailHTML）
}
