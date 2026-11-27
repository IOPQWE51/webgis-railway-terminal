// src/utils/pointsExport.js
// 📤 点位一键导出（JSON/CSV）—— 纯序列化 + Blob 下载触发
// 设计契约见 specs/2026-09-06-points-model-v2-design.md §3.3

const CSV_HEADER = 'name,lat,lon,category,group,source';
const BOM = '\uFEFF';

/** CSV 单元格转义：含逗号/引号/换行 → 双引号包裹，内部引号翻倍 */
export function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 点位数组 → UTF-8 BOM CSV 文本（Excel 中文直开不乱码） */
export function toCSV(points) {
  const rows = (Array.isArray(points) ? points : [])
    .map((p) => [p.name, p.lat, p.lon, p.category, p.group || '', p.source || ''].map(csvEscape).join(','));
  return BOM + [CSV_HEADER, ...rows].join('\n');
}

/** 点位数组 → JSON 文本（完整字段，可直接作为未来导入格式） */
export function toJSON(points) {
  return JSON.stringify(Array.isArray(points) ? points : [], null, 2);
}

/** 导出文件名：earth-terminal-points-YYYYMMDD.<ext> */
export function exportFileName(base, ext, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${base}-${y}${m}${d}.${ext}`;
}

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** 点位数组 → GPX 1.1（可直接导入手机户外地图、Garmin 或相机轨迹工具） */
export function toGPX(points) {
  const list = (Array.isArray(points) ? points : []).filter(
    (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)
  );
  const wpts = list
    .map((p) => {
      const descParts = [
        p.day ? `行程:${p.day}` : '',
        p.timeSlot ? `时段:${p.timeSlot}` : '',
        p.focalLength ? `焦段:${p.focalLength}` : '',
        p.notes || '',
        p.group ? `分组:${p.group}` : '',
      ].filter(Boolean);
      const descXml = descParts.length > 0 ? `<desc>${xmlEscape(descParts.join(' · '))}</desc>` : '';
      return `  <wpt lat="${p.lat}" lon="${p.lon}"><name>${xmlEscape(p.name || '未命名点位')}</name>${descXml}<type>${xmlEscape(p.category || 'spot')}</type></wpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="EarthTerminal" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n</gpx>`;
}

/** 点位数组 → KML 2.2（可直接导入 Google Earth / Google My Maps） */
export function toKML(points) {
  const list = (Array.isArray(points) ? points : []).filter(
    (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)
  );
  const placemarks = list
    .map((p) => {
      const desc = [p.day, p.timeSlot, p.focalLength, p.notes, p.source].filter(Boolean).join(' · ');
      return `    <Placemark><name>${xmlEscape(p.name || '未命名点位')}</name><description>${xmlEscape(desc)}</description><Point><coordinates>${p.lon},${p.lat},0</coordinates></Point></Placemark>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>EarthTerminal Points</name>\n${placemarks}\n  </Document>\n</kml>`;
}

const icsEscape = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

/** 将按天行程导出为标准 RFC 5545 .ics 日历文件（支持 Apple Calendar / Google Calendar） */
export function toICS(days = [], startDateStr = '') {
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)
    ? new Date(`${startDateStr}T00:00:00Z`)
    : new Date();
  const y0 = baseDate.getUTCFullYear();
  const m0 = baseDate.getUTCMonth();
  const d0 = baseDate.getUTCDate();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const events = [];
  (Array.isArray(days) ? days : []).forEach((dayGroup, dayIdx) => {
    const dt = new Date(Date.UTC(y0, m0, d0 + dayIdx));
    const dtNext = new Date(Date.UTC(y0, m0, d0 + dayIdx + 1));
    const fmtDay = (x) =>
      `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`;
    const dtStart = fmtDay(dt);
    const dtEnd = fmtDay(dtNext);

    (dayGroup.stops || []).forEach((pt, idx) => {
      const summary = `${dayGroup.day} · ${pt.timeSlot ? `[${pt.timeSlot}] ` : ''}${pt.name || '行程点'}`;
      const desc = [
        pt.focalLength ? `焦段: ${pt.focalLength}` : '',
        pt.notes ? `备注: ${pt.notes}` : '',
        Number.isFinite(pt.budget) ? `预算: ${pt.budget} ${pt.currency || 'CNY'}` : '',
        `坐标: ${pt.lat?.toFixed(5)}, ${pt.lon?.toFixed(5)}`,
      ].filter(Boolean).join('\\n');

      events.push([
        'BEGIN:VEVENT',
        `UID:et-${dayIdx}-${idx}-${String(pt.id || idx).replace(/[^a-zA-Z0-9_-]/g, '')}@earthterminal`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${icsEscape(summary)}`,
        `LOCATION:${icsEscape(`${pt.name || ''} (${pt.lat?.toFixed(4)}, ${pt.lon?.toFixed(4)})`)}`,
        `DESCRIPTION:${icsEscape(desc)}`,
        'END:VEVENT',
      ].join('\r\n'));
    });
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EarthTerminal//Itinerary//CN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/** 触发浏览器下载（纯前端 Blob，零网络请求） */
export function downloadTextFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
