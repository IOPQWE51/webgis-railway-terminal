// api/astronomy.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { lat, lon, date } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "缺少坐标" });

    // 提取极其敏感的 Astronomy API 账号密码
    const appId = process.env.ASTRO_APP_ID;
    const appSecret = process.env.ASTRO_APP_SECRET;
    
    // 银行级加密拼接 (Basic Auth)
    const authString = Buffer.from(`${appId}:${appSecret}`).toString('base64');
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
        // 请求真实天文台数据 (以太阳、月亮等天体位置为例)
        const apiUrl = `https://api.astronomyapi.com/api/v2/bodies/positions?latitude=${lat}&longitude=${lon}&elevation=0&from_date=${targetDate}&to_date=${targetDate}&time=12:00:00`;

        const astroRes = await fetch(apiUrl, {
            headers: { 'Authorization': `Basic ${authString}` }
        });
        
        const astroData = await astroRes.json();
        
        res.status(200).json(astroData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "云端天文台连接失败" });
    }
}