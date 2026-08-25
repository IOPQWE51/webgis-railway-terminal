import { describe, it, expect } from 'vitest';
import {
  checkConditions,
  calculateMatchScore,
  matchRules,
  getTopSuggestions,
  groupSuggestionsByRarity,
} from '../src/utils/ruleMatcher.js';

// ---- 手工规则夹具：不依赖 215 条真实规则库的语义，只测引擎本身的行为契约 ----

const RULE_CLEAR_SKY_3STAR = {
  id: 'r_clear',
  conditions: { weather: ['clear', 'sunny'] },
  output: '⭐⭐⭐ 晴空摄影：顺光拍雪山',
};
const RULE_HUMID_RANGE_1STAR = {
  id: 'r_humid',
  conditions: { minHumidity: 70 },
  output: '⭐ 星雾弥漫',
};
const RAINBOW_5STAR = {
  id: 'r_rainbow',
  conditions: { weather: ['rain'], season: ['summer'], timeWindow: ['afternoon'] },
  output: '⭐⭐⭐⭐⭐ 彩虹：雨后东向逆光',
};

describe('checkConditions', () => {
  it('条件未定义（null/undefined）视为通过', () => {
    const r = checkConditions({ weather: null }, { weather: [] });
    expect(r.matched).toBe(true);
    expect(r.details.weather.status).toBe('passed');
  });

  it('数组条件取交集且大小写不敏感', () => {
    expect(checkConditions({ weather: ['Clear', 'Sunny'] }, { weather: ['clear'] }).matched).toBe(true);
    expect(checkConditions({ weather: ['fog'] }, { weather: ['clear'] }).matched).toBe(false);
    // 规则期望数组但输入不是数组 → 不匹配
    expect(checkConditions({ weather: ['fog'] }, { weather: 'fog' }).matched).toBe(false);
  });

  it('requires* / has* / is* 走严格相等', () => {
    expect(checkConditions({ requiresCoastal: true }, { requiresCoastal: true }).matched).toBe(true);
    expect(checkConditions({ requiresCoastal: true }, { requiresCoastal: false }).matched).toBe(false);
    expect(checkConditions({ hasWaterfall: true }, { hasWaterfall: true }).matched).toBe(true);
    expect(checkConditions({ isNight: true }, { isNight: false }).matched).toBe(false);
  });

  it('min/max 成对出现时按范围判定（字段名大小写/别名兼容）', () => {
    const r = checkConditions({ minTemp: 5, maxTemp: 30 }, { temp: 20 });
    expect(r.matched).toBe(true);
    expect(r.details.temp.status).toBe('passed');

    const cold = checkConditions({ minTemp: 5, maxTemp: 30 }, { temp: 2 });
    expect(cold.matched).toBe(false);
    expect(cold.details.temp.status).toBe('failed');
  });

  it('只有单边边界时也正确判定', () => {
    expect(checkConditions({ minHumidity: 70 }, { humidity: 85 }).matched).toBe(true);
    expect(checkConditions({ minHumidity: 70 }, { humidity: 50 }).matched).toBe(false);
    expect(checkConditions({ maxWindSpeed: 20 }, { windSpeed: 35 }).matched).toBe(false);
  });

  it('范围条件遇到非数值输入时不匹配', () => {
    expect(checkConditions({ minTemp: 5 }, { temp: 'warm' }).matched).toBe(false);
  });

  it('范围字段在环境数据中缺失时不影响整体匹配', () => {
    // 引擎现状：inputValue === undefined 时跳过范围检查
    expect(checkConditions({ minMoonPhase: 0.5 }, {}).matched).toBe(true);
  });

  it('回归哨兵：0°C 是合法温度，不得被 falsy 短路跳过范围检查', () => {
    // 引擎曾用 || 拼接查找链，0 被当作缺失 → maxTemp:-10 的极寒规则误命中 0°C 环境
    expect(checkConditions({ minTemp: -5, maxTemp: 5 }, { temp: 0 }).matched).toBe(true);
    expect(checkConditions({ maxTemp: -10 }, { temp: 0 }).matched).toBe(false);
    expect(checkConditions({ minTemp: 1 }, { temp: 0 }).matched).toBe(false);
  });

  it('回归哨兵：camelCase 多词字段（windSpeed）能正确配对 min/max 前缀', () => {
    // 引擎的 normalizeFieldName 会全转小写，旧版查不到 windSpeed 导致范围被静默跳过
    expect(checkConditions({ minWindSpeed: 3 }, { windSpeed: 6 }).matched).toBe(true);
    expect(checkConditions({ minWindSpeed: 3 }, { windSpeed: 1 }).matched).toBe(false);
  });
});

describe('calculateMatchScore', () => {
  it('未匹配直接 0 分', () => {
    expect(calculateMatchScore({}, {}, { matched: false, details: {} }, 5)).toBe(0);
  });

  it('基础分 80，稀有度 ±10/星并夹取到 [0,120]', () => {
    const ctx = { matched: true, details: {} };
    expect(calculateMatchScore({}, {}, ctx, 3)).toBe(80);
    expect(calculateMatchScore({}, {}, ctx, 5)).toBe(100);
    expect(calculateMatchScore({}, {}, ctx, 1)).toBe(60);
  });

  it('加权项按文档累加：天气+10 季节+5 时间窗+15 地标+8', () => {
    const ctx = {
      matched: true,
      details: {
        weather: { status: 'passed' },
        season: { status: 'passed' },
        timeWindow: { status: 'passed' },
        hasShrine: { status: 'passed' },
      },
    };
    // 80 + 10 + 5 + 15 + 8 = 118（3星无稀有加成）
    expect(calculateMatchScore({}, {}, ctx, 3)).toBe(118);
  });

  it('分数上界 120：五星 + 全部加权项会被夹取', () => {
    const ctx = {
      matched: true,
      details: {
        weather: { status: 'passed' },
        season: { status: 'passed' },
        timeWindow: { status: 'passed' },
        hasWaterfall: { status: 'passed' },
        hasShrine: { status: 'passed' },
      },
    };
    // 80+20+10+5+15+8+8 = 146 → 120
    expect(calculateMatchScore({}, {}, ctx, 5)).toBe(120);
  });
});

describe('matchRules', () => {
  const rules = [
    RAINBOW_5STAR,
    RULE_CLEAR_SKY_3STAR,
    RULE_HUMID_RANGE_1STAR,
  ];

  it('只返回匹配的规则并按分数降序', () => {
    // humidity 给出明确低值，让 r_humid 的范围条件失败而被排除
    const matches = matchRules(
      { weather: ['clear'], humidity: 30 },
      rules,
      { minScore: 0 }
    );
    expect(matches.map(m => m.id)).toEqual(['r_clear']);
  });

  it('默认阈值 50 分以下被过滤（一星规则 80-20=60 可过）', () => {
    const matches = matchRules({ humidity: 90 }, rules, { minScore: 0 });
    expect(matches.map(m => m.id)).toContain('r_humid');
    // 抬高阈值后同一条被滤掉
    expect(matchRules({ humidity: 90 }, rules, { minScore: 61 })).not.toContainEqual(
      expect.objectContaining({ id: 'r_humid' })
    );
  });

  it('五星彩虹规则在完整环境下命中并携带稀有度', () => {
    const matches = matchRules(
      { weather: ['rain'], season: ['summer'], timeWindow: ['afternoon'] },
      rules,
      { minScore: 0 }
    );
    const rainbow = matches.find(m => m.id === 'r_rainbow');
    expect(rainbow.rarity).toBe(5);
    expect(rainbow.score).toBeGreaterThanOrEqual(100);
  });

  it('没有 conditions 字段的规则被安全跳过', () => {
    const matches = matchRules({ weather: ['clear'] }, [
      { id: 'broken' },
      RULE_CLEAR_SKY_3STAR,
    ], { minScore: 0 });
    expect(matches).toHaveLength(1);
  });

  it('output 不是字符串时稀有度回退为 3 星', () => {
    // 用 sky 字段避开 weather 命中后的 +10 加权，隔离验证基础分
    const matches = matchRules({ sky: ['clear'] }, [
      { id: 'no_output', conditions: { sky: ['clear'] }, output: null },
    ], { minScore: 0 });
    expect(matches[0].rarity).toBe(3);
    expect(matches[0].score).toBe(80);
  });
});

describe('getTopSuggestions 双重排序', () => {
  it('先按稀有度降序，同稀有度内按分数降序', () => {
    const rules = [
      { id: 'low_star_high_score', conditions: { weather: ['a'] }, output: '⭐ A' },   // 60 分 1星
      { id: 'five_star', conditions: { weather: ['b'] }, output: '⭐⭐⭐⭐⭐ B' },       // 100 分 5星
      { id: 'three_star_mid', conditions: { weather: ['c'] }, output: '⭐⭐⭐ C' },     // 80 分 3星
    ];
    const env = { weather: ['a', 'b', 'c'] };
    const top = getTopSuggestions(env, 3, { minScore: 0 }, rules);
    expect(top.map(t => t.id)).toEqual(['five_star', 'three_star_mid', 'low_star_high_score']);
  });
});

describe('groupSuggestionsByRarity', () => {
  it('按星级落入正确的桶', () => {
    const rules = [
      { id: 'g5', conditions: { w: ['x'] }, output: '⭐⭐⭐⭐⭐ L' },
      { id: 'g4', conditions: { w: ['x'] }, output: '⭐⭐⭐⭐ E' },
      { id: 'g2', conditions: { w: ['x'] }, output: '⭐⭐ U' },
    ];
    const grouped = groupSuggestionsByRarity({ w: ['x'] }, rules);
    expect(grouped.legendary.map(m => m.id)).toEqual(['g5']);
    expect(grouped.epic.map(m => m.id)).toEqual(['g4']);
    expect(grouped.common.map(m => m.id)).toEqual([]); // 没有 1 星规则
    expect(grouped.uncommon.map(m => m.id)).toEqual(['g2']);
  });
});
