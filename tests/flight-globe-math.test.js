import { describe, it, expect } from 'vitest';
import {
  latLonToCartesian,
  computeSubsolarPoint,
  sampleFlightArc3D,
  computeFlightTelemetry,
  formatUtcClock,
} from '../src/utils/flightGlobeMath';

describe('flightGlobeMath: 3D 航线地球球面数学与昼夜晨昏线', () => {
  it('latLonToCartesian 与 Three.js SphereGeometry 坐标系严格对齐', () => {
    // 北极 (+90°N) -> (0, +1, 0)
    const np = latLonToCartesian(90, 0, 1);
    expect(np.x).toBeCloseTo(0, 5);
    expect(np.y).toBeCloseTo(1, 5);
    expect(np.z).toBeCloseTo(0, 5);

    // 赤道本初子午线 (0°, 0°) -> (+1, 0, 0)
    const eq0 = latLonToCartesian(0, 0, 1);
    expect(eq0.x).toBeCloseTo(1, 5);
    expect(eq0.y).toBeCloseTo(0, 5);
    expect(eq0.z).toBeCloseTo(0, 5);

    // 赤道东经 90° (0°, +90°) -> (0, 0, -1)
    const eq90 = latLonToCartesian(0, 90, 1);
    expect(eq90.x).toBeCloseTo(0, 5);
    expect(eq90.y).toBeCloseTo(0, 5);
    expect(eq90.z).toBeCloseTo(-1, 5);
  });

  it('computeSubsolarPoint 在 UTC 12:00 直射 0° 经线，UTC 00:00 直射 180° 经线', () => {
    const juneSolstice = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
    const noon = computeSubsolarPoint(juneSolstice, 12);
    expect(noon.lon).toBeCloseTo(0, 2);
    expect(noon.lat).toBeGreaterThan(20); // 夏至北回归线附近
    expect(Math.hypot(noon.direction.x, noon.direction.y, noon.direction.z)).toBeCloseTo(1, 5);

    const midnight = computeSubsolarPoint(juneSolstice, 0);
    expect(Math.abs(midnight.lon)).toBeCloseTo(180, 2);
  });

  it('sampleFlightArc3D 生成带弧顶巡航高度的 3D 大圆点列', () => {
    const from = { lat: 31.1443, lon: 121.8083 }; // PVG
    const to = { lat: 40.6413, lon: -73.7781 }; // JFK
    const pts = sampleFlightArc3D(from, to, { segments: 64, earthRadius: 1 });
    expect(pts.length).toBe(65);
    // 起终点贴近地表 (r ≈ 1)
    expect(Math.hypot(pts[0].x, pts[0].y, pts[0].z)).toBeCloseTo(1, 4);
    expect(Math.hypot(pts[64].x, pts[64].y, pts[64].z)).toBeCloseTo(1, 4);
    // 中点抬升显著高于地表
    const midR = Math.hypot(pts[32].x, pts[32].y, pts[32].z);
    expect(midR).toBeGreaterThan(1.1);
    expect(midR).toBeLessThanOrEqual(1.25);
  });

  it('computeFlightTelemetry 正确区分起飞爬升、平飞巡航、下降进近与昼夜空域', () => {
    const sunDir = { x: 1, y: 0, z: 0 };

    const climb = computeFlightTelemetry(0.05, 5000, { x: 1, y: 0, z: 0 }, sunDir);
    expect(climb.phase).toBe('起飞爬升');
    expect(climb.pitchDeg).toBeGreaterThan(0);
    expect(climb.lightingZone).toBe('☀️ 白昼空域');

    const cruise = computeFlightTelemetry(0.5, 5000, { x: 0, y: 1, z: 0 }, sunDir);
    expect(cruise.phase).toBe('平飞巡航');
    expect(cruise.pitchDeg).toBe(0);
    expect(cruise.altitudeFt).toBe(39000);
    expect(cruise.lightingZone).toBe('🌅 晨昏交界带');

    const descent = computeFlightTelemetry(0.95, 5000, { x: -1, y: 0, z: 0 }, sunDir);
    expect(descent.phase).toBe('下降进近');
    expect(descent.pitchDeg).toBeLessThan(0);
    expect(descent.lightingZone).toBe('🌙 夜间空域');
  });

  it('formatUtcClock 规范格式化 24h UTC 时钟', () => {
    expect(formatUtcClock(0)).toBe('00:00 UTC');
    expect(formatUtcClock(13.5)).toBe('13:30 UTC');
    expect(formatUtcClock(25.25)).toBe('01:15 UTC');
  });
});
