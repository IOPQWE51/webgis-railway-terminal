// src/utils/decisiveMoments.js

export const decisiveMomentRules = [
    {
        id: "cyberpunk_rain",
        conditions: {
            weather: ['Rain', 'Drizzle', 'Moderate rain', 'Light rain'], // 匹配 WeatherAPI 的词汇
            category: ['station', 'spot', 'anime']
        },
        output: "🌧️ 赛博朋克触发：寻找路面积水，利用车站/路灯霓虹灯拍摄高反差倒影！"
    },
    {
        id: "snow_anime",
        conditions: {
            weather: ['Snow', 'Light snow', 'Heavy snow'],
            category: ['anime', 'spot']
        },
        output: "❄️ 圣地白雪触发：二次元取景地遇上降雪，日系极简高调大片诞生！"
    },
    {
        id: "morning_fog",
        conditions: {
            minHumidity: 90,
            maxVisibility: 5000,
            timeWindow: ['dawn', 'goldenHourEnd']
        },
        output: "☁️ 晨雾云海预警：高湿度叠加清晨低温，极大概率出现平流雾或局部云海！"
    },
    {
        id: "burning_clouds",
        conditions: {
            minClouds: 30,
            maxClouds: 70,
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🔥 火烧云预警：完美云量叠加黄金时刻，准备广角镜头迎接漫天红霞！"
    }
];