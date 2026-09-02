// 精选巡礼番剧名单 —— 纯配置，无运行时依赖
// 全部 bangumiId 已于 2026-09-03 通过 GET api.anitabi.cn/bangumi/{id}/lite 实测验证
//（lite 返回 200 且 litePoints 非空）；points 数为当日巡礼点总量。
// 展示名取 anitabi cn 字段；新增作品前先跑一次 lite 验证再收录。
export const PILGRIMAGE_PICKS = [
  { id: 328609, name: '孤独摇滚！', city: '东京都', color: '#ff428e', points: 414 },
  { id: 207195, name: '摇曳露营△', city: '山梨县', color: '#6a55aa', points: 684 },
  { id: 262897, name: '摇曳露营△ 二期', city: '静冈县', color: '#634e47', points: 738 },
  { id: 115908, name: '吹响吧！上低音号', city: '宇治市', color: '#02a7bd', points: 577 },
  { id: 160209, name: '你的名字。', city: '高山市', color: '#0080ff', points: 113 },
  { id: 10440, name: '未闻花名', city: '秩父市', color: '#002aaa', points: 94 },
  { id: 485, name: '凉宫春日的忧郁', city: '西宫市', color: '#e7170c', points: 76 },
  { id: 126461, name: '樱子小姐的脚下埋着尸体', city: '旭川市', color: '#b03faf', points: 67 },
];
