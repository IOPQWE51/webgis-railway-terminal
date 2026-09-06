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
