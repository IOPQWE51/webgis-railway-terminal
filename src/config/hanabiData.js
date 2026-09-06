// 花火大会本地数据库 —— 从 HanabiRadar.jsx 抽出，供花火情报局与今日去这卡共用
// 未来可写脚本自动同步 hanabi.cloud 的数据；经纬度为河川敷燃放点的近似坐标
export const HANABI_DATA = [
    { id: 1, name: "长冈祭大花火大会", date: "2026-08-02", location: "新潟县长冈市信浓川河川敷", scale: "约20000发", status: "confirmed", lat: 37.4792, lon: 138.8543 },
    { id: 2, name: "大曲之花火 (全国花火竞技大会)", date: "2026-08-29", location: "秋田县大仙市雄物川河畔", scale: "约18000发", status: "confirmed", lat: 39.5028, lon: 140.4889 },
    { id: 3, name: "土浦全国花火竞技大会", date: "2026-11-07", location: "茨城县土浦市樱川畔", scale: "约20000发", status: "planned", lat: 36.0836, lon: 140.2000 },
    { id: 4, name: "隅田川花火大会", date: "2026-07-25", location: "东京都墨田区", scale: "约20000发", status: "confirmed", lat: 35.7101, lon: 139.8016 },
];
