// src/utils/decisiveMoments.js
// 🎬 v2.0+ 决定性瞬间规则库 - 100+ 全球摄影触发器

export const decisiveMomentRules = [
    // ======== 原始 4 个核心规则 ========
    {
        id: "cyberpunk_rain",
        conditions: {
            weather: ['Rain', 'Drizzle', 'Moderate rain', 'Light rain'],
            category: ['station', 'spot', 'anime']
        },
        output: "🌧️ 赛博朋克触发：寻找路面积水，利用车站/路灯霓虹灯拍摄高反差倒影！| 低角度贴近水面后期拖尾 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "snow_anime",
        conditions: {
            weather: ['Snow', 'Light snow', 'Heavy snow'],
            category: ['anime', 'spot']
        },
        output: "❄️ 圣地白雪触发：二次元取景地遇上降雪，日系极简高调大片诞生！| 微距拍冰晶细节，广角拍全景 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "morning_fog",
        conditions: {
            minHumidity: 90,
            maxVisibility: 5000,
            timeWindow: ['dawn', 'goldenHourEnd']
        },
        output: "☁️ 晨雾云海预警：高湿度叠加清晨低温，极大概率出现平流雾或局部云海！| 长焦压缩，留白构图 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "burning_clouds",
        conditions: {
            minClouds: 30,
            maxClouds: 70,
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🔥 火烧云预警：完美云量叠加黄金时刻，准备广角镜头迎接漫天红霞！| 广角，利用线条引导 | 稀有度: ⭐⭐⭐⭐"
    },

    // ======== 极地与天体现象 ========
    {
        id: "aurora_nordic",
        conditions: {
            weather: ['Clear'],
            minLatitude: 60,
            season: ['winter'],
            isNight: true,
            requiresGeomagneticActivity: true
        },
        output: "🌌 北极光舞动：天气晴朗 + 地磁活动强 → 绿色光带横贯夜空 | 三脚架+广角大光圈，ISO 1600-3200，快门10-20秒 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "aurora_southern",
        conditions: {
            weather: ['Clear'],
            maxLatitude: -50,
            season: ['winter'],
            isNight: true,
            requiresGeomagneticActivity: true
        },
        output: "🌌 南极光粉紫：天气晴朗 + 地磁活动强 → 粉色与紫色交织 | 与北极光类似，注意南半球季节 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "milkyway_arch",
        conditions: {
            season: ['summer'],
            minMoonPhase: 0,
            maxMoonPhase: 0.2,
            isNight: true,
            requiresLowLightPollution: true,
            weather: ['Clear']
        },
        output: "🌠 银河拱桥：银河季 + 光污染低 + 新月 → 银河拱桥横跨天际 | 星空参数，广角，后期拼接 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "meteor_shower",
        conditions: {
            weather: ['Clear'],
            isNight: true,
            minMoonPhase: 0,
            maxMoonPhase: 0.2,
            requiresMeteorEvent: true
        },
        output: "💫 流星划空：流星雨极大期 + 天气晴朗 + 新月 → 流星划过夜空 | 间隔拍摄，长时间曝光 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "solar_eclipse",
        conditions: {
            weather: ['Clear'],
            requiresSolarEclipse: true
        },
        output: "☀️ 日全食：日食 + 天气晴朗 → 日食，太阳被月亮遮挡 | 使用巴德膜，注意安全 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "lunar_eclipse",
        conditions: {
            weather: ['Clear'],
            isNight: true,
            requiresLunarEclipse: true
        },
        output: "🔴 红月亮：月食 + 天气晴朗 → 月食，红月亮 | 长焦，曝光补偿 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "super_moon",
        conditions: {
            isNight: true,
            requiresSuperMoon: true,
            category: ['spot', 'station']
        },
        output: "🌕 超级月亮：超级月亮 + 地标建筑 → 超级月亮与地标同框 | 长焦，精确计算位置 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "comet",
        conditions: {
            weather: ['Clear'],
            isNight: true,
            requiresCometEvent: true
        },
        output: "☄️ 彗星出现：彗星出现 + 天气晴朗 + 夜晚 → 彗星划过天际，彗尾可见 | 星空参数，追踪拍摄 | 稀有度: ⭐⭐⭐⭐⭐"
    },

    // ======== 水景与瀑布 ========
    {
        id: "rainbow_waterfall",
        conditions: {
            hasWaterfall: true,
            weather: ['Rainy'],
            timeWindow: ['goldenHour', 'sunset'],
            sunElevationMax: 30
        },
        output: "🌈 瀑布彩虹：雨后放晴 + 太阳高度角 < 30° + 瀑布 → 瀑布前出现完整彩虹 | 偏振镜消除水雾反光 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "frozen_waterfall",
        conditions: {
            hasWaterfall: true,
            season: ['winter'],
            maxTemp: -10
        },
        output: "❄️ 冰封瀑布：冬季 + 气温 < -10°C + 瀑布 → 瀑布完全冰封，冰柱晶莹剔透 | 微距拍冰晶细节 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "waterfall_ice",
        conditions: {
            hasWaterfall: true,
            season: ['winter'],
            maxTemp: -5
        },
        output: "🧊 瀑布冰川：瀑布地标 + 冬季 + 气温极低 → 瀑布结冰，冰柱壮观 | 广角，注意防寒 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "waterfall_rainbow",
        conditions: {
            hasWaterfall: true,
            weather: ['Clear'],
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🌈 瀑布虹光：瀑布地标 + 天气晴朗 + 阳光角度合适 → 瀑布前出现彩虹 | 偏振镜，寻找最佳角度 | 稀有度: ⭐⭐⭐⭐"
    },

    // ======== 樱花樱吹雪 ========
    {
        id: "sakura_blossom_rain",
        conditions: {
            season: ['spring'],
            requiresSakuraFull: true,
            requiresWindyWeather: true
        },
        output: "🌸 樱吹雪：春季 + 樱花满开 + 微风 → 花瓣随风飘落 | 快门1/500秒凝固，或1/15秒拖尾效果 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "sakura_rain",
        conditions: {
            season: ['spring'],
            requiresSakuraFull: true,
            weather: ['Rainy']
        },
        output: "🌸 雨打樱花：春季 + 樱花满开 + 雨天 → 雨打樱花，花瓣沾满水珠 | 微距拍水珠中的倒影 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "sakura_golden",
        conditions: {
            season: ['spring'],
            requiresSakuraFull: true,
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🌸 樱花金粉：春季 + 樱花满开 + 黄金时刻 → 樱花被夕阳染成金粉色 | 侧逆光拍摄，花瓣透亮 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "sakura_blue",
        conditions: {
            season: ['spring'],
            requiresSakuraFull: true,
            timeWindow: ['dusk', 'nightStarting'],
            category: ['spot']
        },
        output: "🌸 夜樱蓝调：春季 + 樱花满开 + 蓝调时刻 + 城市灯光 → 蓝紫色天空与粉色樱花、暖色灯光交织 | 三脚架，小光圈 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "sakura_night_illumination",
        conditions: {
            season: ['spring'],
            requiresSakuraFull: true,
            isNight: true,
            category: ['spot']
        },
        output: "🌸 夜樱灯光：春季 + 樱花满开 + 夜樱点灯 → 夜樱在灯光下梦幻 | 三脚架，高ISO | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "cherry_blossom_river",
        conditions: {
            season: ['spring'],
            requiresSakuraFull: true,
            hasWaterfall: false,
            category: ['spot']
        },
        output: "🌸 花瓣河面：春季 + 樱花满开 + 河流 + 落花 → 花瓣飘落水面，形成粉色河面 | 偏振镜，俯拍或平视 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "train_sakura",
        conditions: {
            season: ['spring'],
            requiresSakuraFull: true,
            weather: ['Clear'],
            category: ['station']
        },
        output: "🚂 列车樱花隧道：晴朗 + 铁道 + 春季 + 樱花满开 → 列车穿过樱花隧道，花瓣飘落 | 预判列车时间，连拍模式 | 稀有度: ⭐⭐⭐⭐⭐"
    },

    // ======== 秋季枫叶 ========
    {
        id: "autumn_leaves_fog",
        conditions: {
            season: ['autumn'],
            requiresMapleLeaves: true,
            minHumidity: 85,
            timeWindow: ['dawn', 'sunrise']
        },
        output: "🍁 雾中红叶：秋季 + 红叶见顷 + 晨雾 → 红叶在雾中若隐若现，意境朦胧 | 长焦压缩，留白构图 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "autumn_leaves_golden",
        conditions: {
            season: ['autumn'],
            requiresMapleLeaves: true,
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🍁 枫叶金光：秋季 + 红叶见顷 + 黄金时刻 → 红叶被夕阳打亮，色彩艳丽 | 逆光拍摄，利用光影 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "autumn_leaves_illumination",
        conditions: {
            season: ['autumn'],
            requiresMapleLeaves: true,
            isNight: true,
            category: ['spot']
        },
        output: "🍁 夜枫灯光：秋季 + 红叶见顷 + 夜晚 + 点灯 → 夜枫被灯光照亮，天空深蓝 | 三脚架，曝光补偿-0.7 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "autumn_night_illumination",
        conditions: {
            season: ['autumn'],
            requiresMapleLeaves: true,
            isNight: true,
            category: ['spot']
        },
        output: "🍁 秋嗎夜景：秋季 + 红叶见顷 + 夜枫点灯 → 夜枫与灯光交织 | 三脚架，曝光补偿 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "maple_tunnel",
        conditions: {
            season: ['autumn'],
            requiresMapleLeaves: true,
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🍁 枫叶隧道：秋季 + 红叶见顷 + 道路 + 黄金时刻 → 红叶隧道，阳光穿透树叶 | 长焦压缩，逆光拍摄 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "autumn_grass",
        conditions: {
            season: ['autumn'],
            category: ['spot'],
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🌾 金色芒草：秋季 + 芒草地标 + 黄金时刻 → 芒草在夕阳下发光，风吹草浪 | 长焦，捕捉光影 | 稀有度: ⭐⭐⭐"
    },

    // ======== 冬季与雪景 ========
    {
        id: "winter_snow_temple",
        conditions: {
            season: ['winter'],
            weather: ['Snow'],
            hasShrine: true
        },
        output: "⛩️ 雪中神社：雪天 + 神社 + 红色主色调 → 朱红建筑与白雪，日式极简美学 | 适当过曝半档 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "winter_snow_bamboo",
        conditions: {
            season: ['winter'],
            weather: ['Snow'],
            isForest: true
        },
        output: "🎋 雪竹林：雪天 + 竹林 → 积雪压弯竹枝，形成天然弧形画框 | 黑白模式或低饱和度 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "winter_ice_bubble",
        conditions: {
            season: ['winter'],
            minTemp: -20,
            category: ['spot']
        },
        output: "❄️ 冰面气泡：冬季 + 冰湖 + 气温极低 → 湖面冰层中封存的气泡，层层叠叠 | 低角度贴近冰面 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "winter_illumination",
        conditions: {
            season: ['winter'],
            isNight: true,
            category: ['spot']
        },
        output: "✨ 冬季灯饰：冬季 + 圣诞灯饰 + 蓝调时刻 → 圣诞灯饰与深蓝天空 | 小光圈星芒 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "winter_night_illumination",
        conditions: {
            season: ['winter'],
            weather: ['Snow'],
            isNight: true,
            category: ['spot']
        },
        output: "❄️ 雪地灯饰：冬季 + 灯饰 + 雪景 → 雪地与灯饰相映 | 小光圈，星芒 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "snow_monkey",
        conditions: {
            season: ['winter'],
            weather: ['Snow'],
            timeWindow: ['dawn', 'sunrise'],
            category: ['spot']
        },
        output: "🐵 雪猴温泉：冬季 + 温泉 + 雪猴 + 清晨 → 雪猴泡温泉，表情生动 | 长焦，捕捉猴子神态 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "snow_oldtown",
        conditions: {
            season: ['winter'],
            weather: ['Snow'],
            category: ['spot']
        },
        output: "🏘️ 雪中古镇：雪天 + 历史街区 + 积雪 > 5cm → 传统建筑屋顶积雪，与现代街景形成对比 | 适当过曝0.7档 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "glacier_calving",
        conditions: {
            minTemp: 0,
            timeWindow: ['dawn', 'sunrise'],
            category: ['spot']
        },
        output: "🧊 冰川崩解：冰川 + 气温 > 0°C + 早晨 → 冰川崩解入海，激起巨大水花 | 长焦+高速连拍 | 稀有度: ⭐⭐⭐⭐⭐"
    },

    // ======== 花海与花季 ========
    {
        id: "flower_field",
        conditions: {
            season: ['spring', 'summer'],
            requiresFlowerField: true,
            weather: ['Clear']
        },
        output: "🌼 花海盛开：花田 + 春季 + 天气晴朗 → 漫山遍野的花海，色彩饱和 | 低角度仰拍 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "tulip_field",
        conditions: {
            season: ['spring'],
            requiresTulipField: true,
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🌷 郁金香花田：花田 + 春季 + 郁金香盛开 + 黄金时刻 → 郁金香花田被暖色光线打亮 | 低角度平视，利用花海线条 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "poppy_field",
        conditions: {
            season: ['spring'],
            requiresPoppyField: true,
            weather: ['Clear']
        },
        output: "🔴 罂粟花海：花田 + 春季 + 罂粟花盛开 → 红色罂粟花海与蓝天形成强烈对比 | 广角俯拍 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "lavender_sunset",
        conditions: {
            season: ['summer'],
            requiresLavenderField: true,
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "💜 薰衣草紫夕：花田 + 夏季 + 薰衣草盛开 + 黄金时刻 → 薰衣草花田被夕阳染成紫色 | 广角低角度 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "sunflower_noon",
        conditions: {
            season: ['summer'],
            requiresSunflowerField: true,
            timeWindow: ['solarNoon']
        },
        output: "🌻 向日葵正午：花田 + 夏季 + 向日葵盛开 + 正午 → 向日葵花海，正午强光下花瓣透亮 | 低角度仰拍 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "hydrangea_rain",
        conditions: {
            season: ['summer'],
            requiresHydrangeaField: true,
            weather: ['Rainy']
        },
        output: "💙 雨中紫阳花：夏季 + 紫阳花地标 + 雨天 → 雨中紫阳花更显艳丽，水珠挂在花瓣上 | 微距拍摄 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "wisteria_tunnel",
        conditions: {
            season: ['spring'],
            requiresWisteriaFlower: true,
            weather: ['Clear']
        },
        output: "💜 紫藤花隧道：春季 + 紫藤花隧道 + 晴天 → 紫藤花隧道，花穗垂落 | 广角，利用线条 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "rose_garden",
        conditions: {
            season: ['spring', 'summer'],
            requiresRoseGarden: true,
            timeWindow: ['dawn', 'sunrise']
        },
        output: "🌹 玫瑰晨露：春季/夏季 + 玫瑰园 + 清晨 → 玫瑰带露，香气弥漫 | 微距，逆光 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "blooming_cactus",
        conditions: {
            season: ['spring'],
            category: ['spot'],
            requiresCactusFlower: true
        },
        output: "🌵 仙人掌开花：沙漠 + 春季 + 仙人掌开花 → 仙人掌花朵绽放，色彩鲜艳 | 微距，注意刺 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "flower_meadow",
        conditions: {
            season: ['summer'],
            requiresWildFlower: true,
            timeWindow: ['goldenHour', 'sunset']
        },
        output: "🌸 野花草甸：草甸 + 夏季 + 野花盛开 + 黄金时刻 → 花海与夕阳 | 广角，低角度 | 稀有度: ⭐⭐⭐"
    },

    // ======== 火焰与光影 ========
    {
        id: "cyber punk_reflection",
        conditions: {
            weather: ['Rainy'],
            category: ['spot'],
            isNight: true
        },
        output: "🌆 赛博霓虹倒影：雨天 + 霓虹灯街道 + 夜晚 → 雨后积水倒映霓虹灯光，赛博朋克感拉满 | 低角度贴近水面，f/8小光圈 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "fire_dance",
        conditions: {
            isNight: true,
            category: ['spot'],
            requiresFireDanceEvent: true
        },
        output: "🔥 火舞轨迹：火舞表演 + 夜晚 + 海滩 → 火舞表演，火焰轨迹 | 慢门1/15秒捕捉火圈 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "volcano_eruption",
        conditions: {
            isNight: true,
            requiresVolcanoEruption: true
        },
        output: "🌋 火山喷发：火山 + 正在喷发 + 夜晚 → 火山口喷发，熔岩与星空同框 | 长焦，注意安全距离 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "light_trail",
        conditions: {
            isNight: true,
            category: ['spot'],
            requiresHighTraffic: true
        },
        output: "✨ 车流灯轨：夜晚 + 十字路口 + 车流密集 → 车流灯轨，城市脉搏的线条 | 三脚架，快门10-30秒，小光圈 | 稀有度: ⭐⭐⭐"
    },

    // ======== 生物与非洲 ========
    {
        id: "firefly_forest",
        conditions: {
            season: ['summer'],
            isForest: true,
            isNight: true,
            minHumidity: 80
        },
        output: "🟢 萤火虫森林：夏季 + 森林 + 湿度 > 80% + 夜晚 → 萤火虫森林，点点绿光在暗夜中流动 | 三脚架，大光圈，长曝光堆栈 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "summer_firefly",
        conditions: {
            season: ['summer'],
            isNight: true,
            minMoonPhase: 0,
            maxMoonPhase: 0.1,
            minHumidity: 80
        },
        output: "🟢 夏季萤火：夏季 + 萤火虫栖息地 + 无月 + 湿度高 → 萤火虫飞舞 | 大光圈，长曝光堆栈 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "whale_breach",
        conditions: {
            isCoastal: true,
            season: ['spring'],
            timeWindow: ['dawn', 'sunrise'],
            requiresWhaleEvent: true
        },
        output: "🐋 鲸鱼跃出：海岸 + 春季 + 鲸鱼出没 + 早晨 → 鲸鱼跃出海面，阳光打亮水花 | 长焦400mm以上，连拍模式 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "red_crab_migration",
        conditions: {
            isCoastal: true,
            season: ['autumn'],
            timeWindow: ['dawn', 'sunrise'],
            requiresCrabMigration: true
        },
        output: "🦀 红蟹迁徙：海滩 + 秋季 + 红蟹迁徙 + 黎明 → 红蟹迁徙，成千上万只铺满海滩 | 广角低机位 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "penguin_march",
        conditions: {
            maxLatitude: -50,
            season: ['spring'],
            timeWindow: ['dawn', 'sunset'],
            requiresPenguinEvent: true
        },
        output: "🐧 企鹅行进：南极/亚南极 + 企鹅栖息地 + 繁殖季节 + 日出/日落 → 企鹅队列行进，暖色光线 | 长焦，低角度 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "elephant_sunset",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot'],
            requiresElephantEvent: true
        },
        output: "🐘 草原象群：非洲草原 + 大象群 + 黄金时刻 → 大象群在夕阳下剪影 | 广角或长焦，剪影构图 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "lion_rock",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🦁 狮子王岩：狮子王岩 + 黄金时刻 → 狮子王岩被夕阳染红 | 广角，前景空旷 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "winter_bird",
        conditions: {
            season: ['winter'],
            isCoastal: true,
            minHumidity: 70,
            timeWindow: ['dawn', 'sunrise']
        },
        output: "🦢 晨雾天鹅：冬季 + 天鹅栖息地 + 晨雾 → 天鹅在雾中游弋，仙境感 | 长焦，低角度 | 稀有度: ⭐⭐⭐⭐"
    },

    // ======== 地标与建筑 ========
    {
        id: "fuji_snowcap",
        conditions: {
            requiresMountFuji: true,
            season: ['winter'],
            weather: ['Clear'],
            category: ['spot']
        },
        output: "🗻 富士雪顶：富士山 + 冬季 + 雪后初晴 → 富士山积雪清晰，空气通透 | 长焦，偏振镜 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "fuji_reflection",
        conditions: {
            requiresMountFuji: true,
            isCoastal: false,
            weather: ['Clear'],
            timeWindow: ['dawn', 'sunrise'],
            category: ['spot']
        },
        output: "🗻 逆富士倒影：富士山 + 无风 + 湖泊 + 清晨 → 逆富士倒影，山体完整 | 偏振镜，水平构图 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "fuji_clouds",
        conditions: {
            requiresMountFuji: true,
            minClouds: 30,
            maxClouds: 70,
            category: ['spot']
        },
        output: "🗻 富士云帽：富士山 + 天气变化 + 云帽出现 → 富士山戴云帽，独特形态 | 长焦，捕捉云帽形状 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "torii_sunset",
        conditions: {
            isCoastal: true,
            timeWindow: ['goldenHour', 'sunset'],
            hasShrine: true
        },
        output: "⛩️ 鸟居夕阳：海上鸟居 + 黄金时刻 + 退潮 → 鸟居与夕阳、沙滩倒影 | 低角度，广角 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "temple_silhouette",
        conditions: {
            timeWindow: ['sunset'],
            hasShrine: true
        },
        output: "⛩️ 寺庙剪影：寺庙 + 日落 + 天空绚烂 → 寺庙剪影与绚烂天空 | 广角，剪影构图 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "mist_temple",
        conditions: {
            season: ['autumn'],
            hasShrine: true,
            minHumidity: 80,
            requiresMapleLeaves: true
        },
        output: "⛩️ 雾中古刹：雾天 + 寺庙 + 秋季 + 红叶+晨雾 → 水墨画意境 | 长焦压缩，增加留白 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "moon_torii",
        conditions: {
            isCoastal: true,
            isNight: true,
            hasShrine: true,
            minMoonPhase: 0.8,
            maxMoonPhase: 1
        },
        output: "🌕 月亮鸟居：满月 + 海上鸟居 + 月亮与鸟居对齐 → 满月从海上鸟居中穿过 | 长焦200mm以上 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "moon_pagoda",
        conditions: {
            isNight: true,
            category: ['spot'],
            minMoonPhase: 0.9,
            maxMoonPhase: 1
        },
        output: "🌕 月亮塔顶：满月 + 塔类地标 + 夜晚 → 月亮正好悬在塔尖 | 长焦，精确计算位置 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "moon_cityscape",
        conditions: {
            isNight: true,
            minMoonPhase: 0.9,
            maxMoonPhase: 1,
            category: ['spot']
        },
        output: "🌕 超级月亮城市：满月 + 城市天际线 + 月出/月落 → 月亮与城市建筑大小对比 | 长焦200mm以上 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "castle_sunset",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🏰 城堡夕照：城堡 + 黄金时刻 → 城堡剪影与夕阳 | 广角，注意构图 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "lighthouse_sunset",
        conditions: {
            isCoastal: true,
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🔴 灯塔夕照：灯塔 + 黄金时刻 → 灯塔与夕阳 | 广角或长焦 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "lighthouse_storm",
        conditions: {
            isCoastal: true,
            isNight: true,
            weather: ['Rainy'],
            requiresStormWeather: true,
            category: ['spot']
        },
        output: "🔴 风暴灯塔：灯塔 + 风暴天气 + 夜晚 → 灯塔光束穿透巨浪和雨雾 | 长曝光，捕捉光束 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "windmill_sunset",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🌐 风车日落：风车 + 黄金时刻 + 天空绚烂 → 风车剪影与夕阳 | 长焦，压缩 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "bridge_sunset",
        conditions: {
            hasBridge: true,
            timeWindow: ['goldenHour', 'sunset'],
            requiresHighTraffic: true
        },
        output: "🌉 桥梁灯轨：桥梁 + 黄金时刻 + 车流 → 桥梁与车灯，暖色天空 | 慢门，三脚架 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "bluehour_bridge",
        conditions: {
            hasBridge: true,
            timeWindow: ['dusk', 'nightStarting']
        },
        output: "🌉 蓝调桥梁：蓝调时刻 + 桥梁 + 灯光刚亮 → 天空深蓝，桥梁暖色灯光，冷暖对比 | 三脚架，小光圈f/11 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "fog_skyscraper",
        conditions: {
            minHumidity: 85,
            timeWindow: ['dawn', 'sunrise'],
            category: ['spot']
        },
        output: "🌫️ 摩天楼穿雾：雾天 + 摩天大楼 + 黎明 → 高楼穿出雾层，宛如天空之城 | 登高望远，长焦压缩 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "city_reflection",
        conditions: {
            weather: ['Clear'],
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🏙️ 城市倒影：无风 + 湖泊与城市 + 黄金时刻 → 城市建筑倒映在平静湖面，完美对称 | 偏振镜减少水面反光 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "northern_light_city",
        conditions: {
            minLatitude: 60,
            isNight: true,
            season: ['winter'],
            category: ['spot'],
            requiresGeomagneticActivity: true
        },
        output: "🌌 极光城市：极光 + 城市地标 + 冬季 → 极光与城市灯光同框 | 广角，注意光污染 | 稀有度: ⭐⭐⭐⭐"
    },

    // ======== 山水风景 ========
    {
        id: "fjord_reflection",
        conditions: {
            weather: ['Clear'],
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "⛰️ 峡湾倒影：峡湾 + 无风 + 黄金时刻 → 峡湾水面如镜，倒映山峦 | 偏振镜，水平构图 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "cliff_sunset",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            weather: ['Clear'],
            category: ['spot']
        },
        output: "🏔️ 悬崖日落：悬崖 + 黄金时刻 + 天气晴朗 → 夕阳坠入海平面，悬崖剪影 | 广角，注意安全 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "mountain_sunrise",
        conditions: {
            timeWindow: ['dawn', 'sunrise'],
            minClouds: 20,
            maxClouds: 60
        },
        output: "⛰️ 日出云海：山地 + 日出 + 云海 → 日出云海，金色山峰 | 广角，渐变ND | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "mountain_sunset",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            minClouds: 30,
            maxClouds: 80
        },
        output: "⛰️ 山峰火烧云：山地 + 日落 + 火烧云 → 火烧云映红山峰 | 广角，长焦 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "valley_fog",
        conditions: {
            minHumidity: 80,
            timeWindow: ['dawn', 'sunrise'],
            category: ['spot']
        },
        output: "🌫️ 山谷晨雾：山谷 + 晨雾 + 日出 → 雾在山谷中流动 | 广角，长焦 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "river_fog",
        conditions: {
            minHumidity: 85,
            season: ['winter'],
            timeWindow: ['dawn', 'sunrise']
        },
        output: "🌫️ 雾锁江面：河流 + 晨雾 + 冬季 → 雾锁江面，渔船朦胧 | 长焦，留白 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "lake_fog",
        conditions: {
            minHumidity: 85,
            timeWindow: ['dawn', 'sunrise'],
            category: ['spot']
        },
        output: "🌫️ 湖面晨雾：湖泊 + 晨雾 + 日出 → 雾中湖面，倒影模糊 | 广角，偏振镜 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "cave_lightbeam",
        conditions: {
            timeWindow: ['solarNoon'],
            category: ['spot']
        },
        output: "💡 洞穴光柱：洞穴 + 正午 + 阳光角度合适 → 光束从洞口射入，形成丁达尔效应 | 三脚架，小光圈 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "rice_terraces",
        conditions: {
            season: ['spring', 'autumn'],
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🌾 梯田水镜：梯田 + 春季/秋季 + 日出/日落 → 梯田水面反射天空色彩，线条优美 | 广角，利用线条引导 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "coast_sunrise",
        conditions: {
            isCoastal: true,
            timeWindow: ['dawn', 'sunrise'],
            weather: ['Clear']
        },
        output: "🌅 海岸日出：海岸 + 日出 + 无云 → 太阳从海平面升起 | 渐变ND镜，广角 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "coast_sunset",
        conditions: {
            isCoastal: true,
            timeWindow: ['goldenHour', 'sunset'],
            weather: ['Clear']
        },
        output: "🌅 海岸日落：海岸 + 日落 + 无云 → 太阳坠入海面 | 长焦，捕捉光球 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "salt_flat_reflection",
        conditions: {
            weather: ['Clear'],
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "✨ 盐沼镜面：盐沼 + 雨季过后 + 无风 + 日落 → 盐沼镜面，天空倒映 | 广角，低角度 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "rock_arch_sunset",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            weather: ['Clear']
        },
        output: "🪨 拱门日落：拱门 + 黄金时刻 + 天气晴朗 → 拱门与夕阳 | 长焦，压缩空间 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "canyon_light",
        conditions: {
            timeWindow: ['solarNoon'],
            weather: ['Clear']
        },
        output: "🏜️ 峡谷光束：峡谷 + 正午 + 阳光射入谷底 → 光束照亮峡谷 | 广角，小光圈 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "ancient_tree",
        conditions: {
            minHumidity: 70,
            timeWindow: ['goldenHour', 'sunrise'],
            isForest: true
        },
        output: "🌳 古树晨光：古树 + 晨雾 + 黄金时刻 → 古树在雾中，阳光穿透枝叶 | 广角，侧逆光 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "forest_path",
        conditions: {
            isForest: true,
            timeWindow: ['dawn', 'sunrise'],
            minHumidity: 60
        },
        output: "🌲 林间光柱：森林 + 晨光 + 丁达尔效应 → 林间光柱，神秘感 | 小光圈，三脚架 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "geyser_eruption",
        conditions: {
            minTemp: 0,
            timeWindow: ['dawn', 'sunrise']
        },
        output: "💨 间歇泉喷发：间歇泉 + 清晨 + 低温 → 蒸汽与晨光形成光柱 | 高速快门，捕捉瞬间 | 稀有度: ⭐⭐⭐"
    },

    // ======== 特殊活动与节日 ========
    {
        id: "hanabi_reflection",
        conditions: {
            isCoastal: false,
            category: ['spot'],
            requiresFireworksEvent: true,
            weather: ['Clear']
        },
        output: "🎆 烟花积水倒影：花火大会 + 雨后放晴 + 城市 → 烟花倒映在积水地面，双重爆炸 | 广角低机位 | 稀有度: ⭐⭐⭐⭐⭐"
    },
    {
        id: "festival_procession",
        conditions: {
            timeWindow: ['dusk', 'nightStarting'],
            requiresFestivalEvent: true,
            category: ['spot']
        },
        output: "🏮 祭典游行：祭典活动 + 傍晚 + 街道 → 传统服饰与灯笼游行 | 慢门1/30秒拖曳灯笼轨迹 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "lantern_festival",
        conditions: {
            isNight: true,
            requiresLanternFestival: true,
            category: ['spot']
        },
        output: "🏮 灯笼节：灯笼节 + 夜晚 + 古街 → 万盏灯笼亮起，红火一片 | 广角，小光圈星芒 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "ice_festival",
        conditions: {
            season: ['winter'],
            isNight: true,
            requiresIceFestival: true,
            category: ['spot']
        },
        output: "❄️ 冰雕节灯光：冰雕节 + 夜晚 + 灯光 → 冰雕在彩灯下晶莹剔透 | 三脚架，白平衡调整 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "snow_sculpture",
        conditions: {
            season: ['winter'],
            weather: ['Snow'],
            requiresSnowSculpture: true,
            category: ['spot']
        },
        output: "⛄ 雪雕艺术：雪雕节 + 白天 + 阳光 → 雪雕细节清晰 | 偏振镜，侧光拍摄 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "carnival_night",
        conditions: {
            isNight: true,
            requiresCarnivalEvent: true,
            category: ['spot']
        },
        output: "🎡 狂欢节夜景：狂欢节活动 + 夜晚 + 街道 → 花车游行，色彩与灯光交织 | 追焦摄影，快门1/60秒跟随主体 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "market_rain",
        conditions: {
            timeWindow: ['sunrise', 'solarNoon'],
            weather: ['Rainy'],
            requiresMarketEvent: true,
            category: ['spot']
        },
        output: "🌂 市集雨景：市集活动 + 雨天 + 街道 → 雨伞色彩与摊位灯光 | 高ISO，捕捉人物表情 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "market_morning",
        conditions: {
            timeWindow: ['dawn', 'sunrise'],
            requiresMarketEvent: true,
            category: ['spot']
        },
        output: "🏪 清晨市集：市场 + 清晨 + 阳光斜射 → 市场光影，人物生动 | 高ISO，抓拍 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "newyear_bell",
        conditions: {
            season: ['winter'],
            isNight: true,
            hasShrine: true,
            requiresNewYearEvent: true
        },
        output: "🔔 除夕撞钟：除夕活动 + 寺庙 + 夜晚 → 除夕撞钟，香火缭绕 | 注意寺庙摄影规定 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "hot_air_balloon",
        conditions: {
            weather: ['Clear'],
            timeWindow: ['dawn', 'sunrise'],
            requiresHotAirBalloonEvent: true
        },
        output: "🎈 热气球黎明：热气球节 + 黎明 + 无风 → 热气球升空，日出背景 | 广角低角度，气球与朝阳 | 稀有度: ⭐⭐⭐⭐"
    },

    // ======== 城市与夜景 ========
    {
        id: "city_rain_night",
        conditions: {
            isNight: true,
            weather: ['Rainy'],
            category: ['spot']
        },
        output: "🌆 雨夜都市：城市街道 + 雨天 + 夜晚 → 雨夜街道，灯光倒影 | 高ISO，捕捉氛围 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "street_art_crowd",
        conditions: {
            timeWindow: ['sunrise', 'sunset'],
            requiresStreetArt: true,
            category: ['spot']
        },
        output: "🎨 涂鸦人群：涂鸦墙 + 活动日 + 白天 → 街头艺人表演，色彩丰富 | 抓拍人物表情 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "modern_architecture",
        conditions: {
            timeWindow: ['dusk', 'nightStarting'],
            category: ['spot']
        },
        output: "🏢 现代建筑夜景：现代建筑 + 蓝调时刻 + 灯光 → 建筑灯光与蓝色天空 | 小光圈，三脚架 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "historical_building",
        conditions: {
            timeWindow: ['dusk', 'nightStarting'],
            hasShrine: true
        },
        output: "🏛️ 历史建筑夜景：历史建筑 + 蓝调时刻 + 灯光 → 建筑与天空 | 小光圈，三脚架 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "port_sunrise",
        conditions: {
            isCoastal: true,
            timeWindow: ['dawn', 'sunrise'],
            requiresPort: true
        },
        output: "⛴️ 港口日出：港口 + 日出 + 渔船 → 渔船剪影与日出 | 广角，低角度 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "airplane_takeoff",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            requiresAirport: true,
            category: ['airport']
        },
        output: "✈️ 飞机日落：机场 + 日落 + 飞机起降 → 飞机剪影与夕阳 | 长焦，高速快门 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "railway_station",
        conditions: {
            timeWindow: ['dusk', 'nightStarting'],
            category: ['station']
        },
        output: "🚂 火车站蓝调：火车站 + 蓝调时刻 + 列车灯光 → 列车与灯光 | 三脚架，慢门 | 稀有度: ⭐⭐⭐"
    },
    {
        id: "subway_entrance",
        conditions: {
            isNight: true,
            weather: ['Rainy'],
            category: ['spot']
        },
        output: "🚇 地铁入口雨景：地铁入口 + 雨天 + 夜晚 → 雨伞，灯光，倒影 | 高ISO，抓拍 | 稀有度: ⭐⭐⭐"
    },

    // ======== 沙漠与极端环境 ========
    {
        id: "sandstorm_golden",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            weather: ['Dust'],
            requiresDesert: true
        },
        output: "🌪️ 沙暴金黄：沙尘暴 + 沙漠 + 黄金时刻 → 沙暴与夕阳，金黄与暗红交织的末日感 | 保护相机，高速快门1/1000秒 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "desert_starry",
        conditions: {
            weather: ['Clear'],
            isNight: true,
            minMoonPhase: 0,
            maxMoonPhase: 0.2,
            requiresDesert: true,
            requiresLowLightPollution: true
        },
        output: "💫 沙漠星空：沙漠 + 无月 + 光污染低 → 沙漠星空，银河与沙丘线条 | 广角，前景沙丘，长曝光 | 稀有度: ⭐⭐⭐⭐"
    },
    {
        id: "cliff_bridge",
        conditions: {
            timeWindow: ['goldenHour', 'sunset'],
            category: ['spot']
        },
        output: "🌉 断桥夕照：断桥 + 日落 + 剪影 → 断桥剪影与夕阳 | 广角，剪影 | 稀有度: ⭐⭐⭐"
    }
];

// 📊 性能提示：规则库已包含 100+ 决定性瞬间触发器
// 建议在 photoEngine.js 中：
// 1. 补充新的条件匹配逻辑 (见文档)
// 2. 添加数据源兼容性检查
// 3. 实现优先级排序 (稀有度高的优先触发)