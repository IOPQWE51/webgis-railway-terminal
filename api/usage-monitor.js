// api/usage-monitor.js
// 📊 API用量监控 - 定期检查各API使用情况，发送警告

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
    const { key } = req.query;
    const MONITOR_KEY = process.env.MONITOR_SECRET_KEY || 'monitor_secret_change_me';

    if (key !== MONITOR_KEY) {
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
        console.error('❌ 用量监控失败:', error);
        res.status(500).json({
            error: 'Usage monitoring failed',
            message: error.message
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

    // TODO: 实现邮件发送逻辑
    // 示例：
    // await fetch('https://api.resend.com/emails', {
    //     method: 'POST',
    //     headers: {
    //         'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    //         'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({
    //         from: 'monitor@jprail.vercel.app',
    //         to: 'your@email.com',
    //         subject: `⚠️ API用量警告 - ${report.summary.alertsCount}个警告`,
    //         html: generateEmailHTML(report)
    //     })
    // });
}

/**
 * 生成邮件HTML
 */
function generateEmailHTML(report) {
    return `
        <h2>📊 API用量监控报告</h2>
        <p><strong>时间：</strong>${report.timestamp}</p>

        <h3>📈 API用量详情</h3>
        <table border="1" cellpadding="10">
            <tr>
                <th>API</th>
                <th>当前用量</th>
                <th>限额</th>
                <th>使用率</th>
                <th>状态</th>
            </tr>
            ${Object.entries(report.apis).map(([name, data]) => `
                <tr>
                    <td>${name}</td>
                    <td>${data.currentMonth?.toLocaleString()}</td>
                    <td>${data.limit?.toLocaleString()}</td>
                    <td>${data.percentage}</td>
                    <td>${data.status}</td>
                </tr>
            `).join('')}
        </table>

        ${report.alerts.length > 0 ? `
            <h3>⚠️ 警告 (${report.alerts.length})</h3>
            <ul>
                ${report.alerts.map(alert => `
                    <li>
                        <strong>${alert.level.toUpperCase()}:</strong>
                        ${alert.message}<br>
                        <em>建议：${alert.recommendation}</em>
                    </li>
                `).join('')}
            </ul>
        ` : '<p>✅ 所有API用量正常</p>'}
    `;
}
