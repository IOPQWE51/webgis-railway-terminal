import { describe, it, expect } from 'vitest';
import {
  MAX_POINTS,
  validatePointsPayload,
  getClientIp,
  parseCoords,
  isMonitorAuthorized,
} from '../api/_lib/validation.js';

const validPoint = {
  id: 'custom_123',
  name: '东京站',
  lat: 35.6812,
  lon: 139.7671,
  category: 'station',
  source: '手动捕获',
};

describe('validatePointsPayload', () => {
  it('拒绝非数组输入', () => {
    expect(validatePointsPayload({}).ok).toBe(false);
    expect(validatePointsPayload('points').ok).toBe(false);
    expect(validatePointsPayload(null).ok).toBe(false);
  });

  it('接受空数组（只读清空是合法操作）', () => {
    expect(validatePointsPayload([])).toEqual({ ok: true, points: [] });
  });

  it('接受合法点位，输出与输入等价', () => {
    const r = validatePointsPayload([validPoint]);
    expect(r.ok).toBe(true);
    expect(r.points).toEqual([validPoint]);
  });

  it('剔除白名单以外的多余字段', () => {
    const r = validatePointsPayload([{ ...validPoint, isAdmin: true, note: 'hack' }]);
    expect(r.ok).toBe(true);
    expect(r.points[0]).toEqual(validPoint);
  });

  // ── v2 数据模型：group / updatedAt / importedAt（specs/2026-09-06-points-model-v2-design.md §2）──
  it('v2 可选字段 group/updatedAt/importedAt 通过白名单', () => {
    const r = validatePointsPayload([{
      ...validPoint,
      group: '关东之行',
      updatedAt: 1725628800000,
      importedAt: 1725542400000,
    }]);
    expect(r.ok).toBe(true);
    expect(r.points[0].group).toBe('关东之行');
    expect(r.points[0].updatedAt).toBe(1725628800000);
    expect(r.points[0].importedAt).toBe(1725542400000);
  });

  it('group 超长（>24）整体拒绝，与其他文本字段同策略', () => {
    const r = validatePointsPayload([{ ...validPoint, group: 'g'.repeat(25) }]);
    expect(r.ok).toBe(false);
  });

  it('updatedAt/importedAt 非数值整体拒绝', () => {
    expect(validatePointsPayload([{ ...validPoint, updatedAt: '不是时间' }]).ok).toBe(false);
    expect(validatePointsPayload([{ ...validPoint, importedAt: NaN }]).ok).toBe(false);
  });

  it('group 空串视为未分组，输出与 v1 等价；v1 旧点位（无新字段）合法', () => {
    const r = validatePointsPayload([{ ...validPoint, group: '' }]);
    expect(r.ok).toBe(true);
    expect(r.points[0]).toEqual(validPoint);
    expect(validatePointsPayload([validPoint]).ok).toBe(true);
  });

  it('数字字符串坐标被强制转换为数值', () => {
    const r = validatePointsPayload([{ ...validPoint, lat: '35.6812', lon: '139.7671' }]);
    expect(r.ok).toBe(true);
    expect(r.points[0].lat).toBe(35.6812);
    expect(r.points[0].lon).toBe(139.7671);
  });

  it.each([
    ['纬度超过北界', { ...validPoint, lat: 90.01 }],
    ['纬度超过南界', { ...validPoint, lat: -90.5 }],
    ['经度超过东界', { ...validPoint, lon: 180.1 }],
    ['经度超过西界', { ...validPoint, lon: -180.5 }],
    ['纬度为 NaN', { ...validPoint, lat: NaN }],
    ['纬度非数字', { ...validPoint, lat: 'abc' }],
    ['name 为空', { ...validPoint, name: '' }],
    ['name 超长', { ...validPoint, name: 'x'.repeat(121) }],
    ['id 缺失', { ...validPoint, id: undefined }],
    ['id 超长', { ...validPoint, id: 'y'.repeat(65) }],
    ['category 超长', { ...validPoint, category: 'z'.repeat(33) }],
    ['item 不是对象', '东京站'],
    ['item 是数组', [validPoint]],
  ])('%s 时整体拒绝并给出原因', (_label, bad) => {
    const r = validatePointsPayload([bad]);
    expect(r.ok).toBe(false);
    expect(typeof r.error).toBe('string');
    expect(r.error.length).toBeGreaterThan(0);
  });

  it(`点位数量超过上限 ${MAX_POINTS} 时整体拒绝`, () => {
    const many = Array.from({ length: MAX_POINTS + 1 }, () => ({ ...validPoint }));
    const r = validatePointsPayload(many);
    expect(r.ok).toBe(false);
  });

  it('恰好等于上限时放行', () => {
    const many = Array.from({ length: MAX_POINTS }, () => ({ ...validPoint }));
    expect(validatePointsPayload(many).ok).toBe(true);
  });
});

describe('getClientIp', () => {
  it('取 x-forwarded-for 链的最后一跳（平台追加的真实 IP）', () => {
    expect(getClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 10.0.0.9' })).toBe('10.0.0.9');
  });

  it('单值 x-forwarded-for 原样返回', () => {
    expect(getClientIp({ 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('没有 xff 时回退 x-real-ip', () => {
    expect(getClientIp({ 'x-real-ip': '8.8.8.8' })).toBe('8.8.8.8');
  });

  it('两者都缺失时返回 unknown', () => {
    expect(getClientIp({})).toBe('unknown');
  });

  it('xff 为空字符串视为不存在，仍走 x-real-ip 回退', () => {
    expect(getClientIp({ 'x-forwarded-for': '', 'x-real-ip': '8.8.4.4' })).toBe('8.8.4.4');
  });
});

describe('parseCoords', () => {
  it('解析合法字符串坐标为数值对象', () => {
    expect(parseCoords({ lat: '35.6', lon: '139.7' })).toEqual({ lat: 35.6, lon: 139.7 });
  });

  it('接受数字类型的 query 值', () => {
    expect(parseCoords({ lat: 12.3, lon: -45.6 })).toEqual({ lat: 12.3, lon: -45.6 });
  });

  it('越界、缺失或非法输入返回 null', () => {
    expect(parseCoords({ lat: '91', lon: '0' })).toBeNull();
    expect(parseCoords({ lat: '0', lon: '-180.5' })).toBeNull();
    expect(parseCoords({ lon: '10' })).toBeNull();
    expect(parseCoords({ lat: 'x', lon: '10' })).toBeNull();
  });
});

describe('isMonitorAuthorized', () => {
  it('服务端密钥未配置时一律拒绝（即使请求带历史默认值）', () => {
    expect(isMonitorAuthorized('monitor_secret_change_me', undefined)).toBe(false);
    expect(isMonitorAuthorized('monitor_secret_change_me', '')).toBe(false);
  });

  it('服务端密钥已配置时严格相等才放行', () => {
    expect(isMonitorAuthorized('s3cret', 's3cret')).toBe(true);
    expect(isMonitorAuthorized('wrong', 's3cret')).toBe(false);
  });
});
