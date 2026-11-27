// src/utils/railPassCalc.js
// 🎟️ 铁路通票半自动回本估算器（极简可维护版：聚焦规则最清晰的日本 JR + 欧洲 Eurail）
// ⚠️ 参考估算模型：不含早鸟折扣、特价票及部分车次的指定席/跨国强制订座费。

import { buildItineraryDays } from './itinerary';

export const PASS_SYSTEMS = {
  jp: {
    id: 'jp',
    name: '日本 JR 通票',
    icon: '🇯🇵',
    currency: 'JPY',
    symbol: '¥',
    perKmRate: 28,
    minLegFare: 500,
    roundStep: 100,
    passes: [
      { id: 'jr_kansai_wide_5', name: 'JR 关西广域 5 日券', price: 12000, days: 5, scope: '大阪/京都/神户/冈山/仓敷/城崎温泉/高松' },
      { id: 'jr_kansai_hiroshima_5', name: 'JR 关西&广岛 5 日券', price: 17000, days: 5, scope: '关西 + 山阳新干线(新大阪↔广岛) + 宫岛渡轮' },
      { id: 'jr_seishun18', name: '青春 18 通票 (5日)', price: 12050, days: 5, scope: '全国 JR 普通/快速列车（不含新干线与特急）' },
      { id: 'jr_kyushu_all_3', name: 'JR 全九州 3 日券', price: 20000, days: 3, scope: '博多/熊本/鹿儿岛/长崎/由布院等九州全线' },
      { id: 'jr_kyushu_all_5', name: 'JR 全九州 5 日券', price: 24000, days: 5, scope: '九州全线新干线与特色观光特急' },
      { id: 'jr_east_tohoku_5', name: 'JR 东日本东北 5 日券', price: 30000, days: 5, scope: '东京↔仙台/盛冈/青森/秋田新干线与成田特快' },
      { id: 'jr_all_7', name: 'JR 全国 Pass 7 日券', price: 50000, days: 7, scope: '日本全境 JR 干线（不含希望号/瑞穗号特例）' },
      { id: 'jr_all_14', name: 'JR 全国 Pass 14 日券', price: 80000, days: 14, scope: '日本全境 14 日跨大区深度纵贯' },
      { id: 'jr_all_21', name: 'JR 全国 Pass 21 日券', price: 100000, days: 21, scope: '日本全境 21 日环岛铁道游' },
    ],
    presetLegs: [
      { id: 'jp_tyo_kyo', label: '东京 ↔ 京都（新干线）', fare: 14170 },
      { id: 'jp_osa_hir', label: '新大阪 ↔ 广岛（新干线）', fare: 10630 },
      { id: 'jp_hir_fuk', label: '广岛 ↔ 博多（新干线）', fare: 9200 },
      { id: 'jp_osa_oka', label: '新大阪 ↔ 冈山 / 尾道方向', fare: 6460 },
      { id: 'jp_oka_tak', label: '冈山 ↔ 高松（濑户大桥）', fare: 1660 },
      { id: 'jp_tyo_sdj', label: '东京 ↔ 仙台（东北新干线）', fare: 11410 },
      { id: 'jp_tyo_aom', label: '东京 ↔ 新青森（东北新干线）', fare: 17670 },
      { id: 'jp_fuk_kag', label: '博多 ↔ 鹿儿岛中央（九州新干线）', fare: 10850 },
    ],
  },
  eu: {
    id: 'eu',
    name: '欧洲 Eurail 通票',
    icon: '🇪🇺',
    currency: 'EUR',
    symbol: '€',
    perKmRate: 0.22,
    minLegFare: 15,
    roundStep: 5,
    passes: [
      { id: 'eu_flex_4', name: 'Eurail 1个月内任选 4 天', price: 283, days: 4, scope: '成人二等座参考价 · 适合 2–3 国紧凑跨城' },
      { id: 'eu_flex_5', name: 'Eurail 1个月内任选 5 天', price: 316, days: 5, scope: '成人二等座参考价 · 经典 1–2 周欧铁' },
      { id: 'eu_flex_7', name: 'Eurail 1个月内任选 7 天', price: 381, days: 7, scope: '成人二等座参考价 · 法瑞意德多城串游' },
      { id: 'eu_flex_10', name: 'Eurail 2个月内任选 10 天', price: 447, days: 10, scope: '成人二等座参考价 · 长线跨国深度游' },
      { id: 'eu_cont_15', name: 'Eurail 连续 15 天通票', price: 466, days: 15, scope: '成人二等座参考价 · 高频换城与瑞士观光线' },
    ],
    presetLegs: [
      { id: 'eu_lon_par', label: '伦敦 ↔ 巴黎（Eurostar 参考）', fare: 120 },
      { id: 'eu_par_zrh', label: '巴黎 ↔ 苏黎世（TGV Lyria）', fare: 110 },
      { id: 'eu_zrh_mil', label: '苏黎世 ↔ 米兰（跨阿尔卑斯）', fare: 85 },
      { id: 'eu_glacier', label: '采尔马特 ↔ 圣莫里茨（冰川快车基础票）', fare: 159 },
      { id: 'eu_fra_muc', label: '法兰克福 ↔ 慕尼黑（ICE）', fare: 95 },
      { id: 'eu_muc_vie', label: '慕尼黑 ↔ 维也纳（Railjet）', fare: 80 },
      { id: 'eu_mil_rom', label: '米兰 ↔ 罗马（红箭高铁）', fare: 95 },
      { id: 'eu_par_ams', label: '巴黎 ↔ 阿姆斯特丹（Eurostar）', fare: 105 },
    ],
  },
};

/** 对比单程合计与所选通票参考价 */
export function evaluatePassComparison(pass, legs = []) {
  const passPrice = Number(pass?.price) || 0;
  const singleTotal = (Array.isArray(legs) ? legs : []).reduce((sum, leg) => {
    const fare = Math.max(0, Number(leg?.fare) || 0);
    const count = Math.max(0, Number(leg?.count) || 0);
    return sum + fare * count;
  }, 0);

  const roundedSingle = Math.round(singleTotal);
  const diff = roundedSingle - passPrice;
  const worthwhile = roundedSingle >= passPrice && passPrice > 0;
  const ratio = passPrice > 0 ? Math.round((roundedSingle / passPrice) * 100) : 0;

  let verdict = '添加几段计划搭乘的区段即可测算回本情况';
  if (roundedSingle > 0 && passPrice > 0) {
    if (diff >= passPrice * 0.15) {
      verdict = '非常划算：通票明显低于单程合计，建议优先考虑通票';
    } else if (diff >= 0) {
      verdict = '基本回本：略省或打平，若需额外付订座费请一并核算';
    } else {
      verdict = '建议单买：单程总价低于通票，直接分段购票更省钱';
    }
  }

  return {
    singleTotal: roundedSingle,
    passPrice,
    diff,
    savings: Math.max(0, diff),
    loss: Math.max(0, -diff),
    worthwhile,
    ratio,
    verdict,
  };
}

/** 根据行程按天编排中的相邻站点，按直线距离半自动预填参考区段与票价（用户可逐项微调） */
export function buildLegsFromItinerary(customPoints = [], systemId = 'jp') {
  const sys = PASS_SYSTEMS[systemId] || PASS_SYSTEMS.jp;
  const { days } = buildItineraryDays(customPoints);
  const legs = [];

  for (const dayGroup of days) {
    for (let i = 1; i < dayGroup.stops.length; i += 1) {
      const prev = dayGroup.stops[i - 1];
      const curr = dayGroup.stops[i];
      const dist = curr.legFromPrevKm;
      if (!Number.isFinite(dist) || dist < 5) continue;
      // 仅对铁道/未指定交通方式的跨城段做估算（忽略步行/航班）
      if (curr.transitMode && curr.transitMode !== 'rail') continue;
      const rawFare = dist * 1.18 * sys.perKmRate;
      const estFare = Math.max(
        sys.minLegFare,
        Math.round(rawFare / sys.roundStep) * sys.roundStep
      );
      legs.push({
        id: `itin_${dayGroup.day}_${i}_${curr.id}`,
        label: `${prev.name} → ${curr.name}（约 ${Math.round(dist)} km）`,
        fare: estFare,
        count: 1,
      });
    }
  }
  return legs;
}
