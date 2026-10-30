/**
 * 模拟数据层（演示用）
 * 说明：站点坐标、海南轮廓为近似值；台风路径基于 2024 年摩羯等公开事件整理。
 * 接入真实服务时，由 src/api/index.js 切换为 FastAPI / GEE 接口，页面无需改动。
 */

// 海南岛简化轮廓（[经度, 纬度]，近似）
export const hainanOutline = [
  [110.62, 20.12], [110.98, 20.06], [111.07, 19.86], [110.86, 19.55],
  [110.98, 19.3], [110.62, 18.86], [110.32, 18.46], [110.06, 18.26],
  [109.76, 18.2], [109.4, 18.3], [109.06, 18.46], [108.7, 18.72],
  [108.62, 19.06], [108.76, 19.42], [109.06, 19.66], [109.3, 19.92],
  [109.66, 20.06], [110.1, 20.14], [110.42, 20.16]
]

// 近岸生态监测浮标/站点
export const stations = [
  { id: 'S01', name: '海口湾', lon: 110.27, lat: 20.07, chla: 2.8, spm: 12.4, sst: 28.6, grade: '二类', risk: '低' },
  { id: 'S02', name: '清澜湾', lon: 110.83, lat: 19.55, chla: 4.6, spm: 18.2, sst: 28.9, grade: '二类', risk: '中' },
  { id: 'S03', name: '博鳌近岸', lon: 110.59, lat: 19.15, chla: 1.9, spm: 8.6, sst: 28.4, grade: '一类', risk: '低' },
  { id: 'S04', name: '三亚湾', lon: 109.49, lat: 18.24, chla: 1.2, spm: 6.3, sst: 28.1, grade: '一类', risk: '低' },
  { id: 'S05', name: '洋浦湾', lon: 109.19, lat: 19.74, chla: 3.5, spm: 22.7, sst: 29.2, grade: '二类', risk: '中' },
  { id: 'S06', name: '八所近岸', lon: 108.63, lat: 19.1, chla: 5.8, spm: 26.1, sst: 29.5, grade: '三类', risk: '高' }
]

export const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 各站点叶绿素 a 月序列（mg/m³）
export const chlaSeries = {
  海口湾: [1.8, 1.6, 1.9, 2.3, 2.6, 3.2, 3.8, 3.5, 2.8, 2.4, 2.1, 1.9],
  清澜湾: [2.1, 1.9, 2.4, 3.1, 3.6, 4.5, 5.8, 5.2, 4.6, 3.4, 2.8, 2.3],
  博鳌近岸: [1.1, 1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.3, 1.9, 1.6, 1.3, 1.2],
  三亚湾: [0.8, 0.7, 0.9, 1.1, 1.3, 1.6, 1.9, 1.7, 1.2, 1.0, 0.9, 0.8],
  洋浦湾: [2.2, 2.0, 2.5, 3.0, 3.4, 4.1, 4.9, 4.6, 3.5, 3.0, 2.6, 2.3],
  八所近岸: [2.9, 2.6, 3.3, 4.0, 4.8, 5.9, 7.2, 6.8, 5.8, 4.3, 3.5, 3.1]
}

// 海表温度月序列（℃）
export const sstSeries = {
  海口湾: [21.5, 21.8, 23.6, 26.1, 28.8, 30.2, 30.8, 30.5, 29.4, 27.6, 25.1, 22.8],
  三亚湾: [24.6, 24.9, 26.2, 28.1, 29.6, 30.4, 30.6, 30.2, 29.6, 28.5, 26.9, 25.2]
}

// 水质类别占比（%）
export const waterGradeDist = [
  { name: '一类水质', value: 38 },
  { name: '二类水质', value: 46 },
  { name: '三类水质', value: 13 },
  { name: '四类及劣四类', value: 3 }
]

// 海岸线变迁（典型岸段，m/年，正=淤积 负=侵蚀）
export const shorelineChange = [
  { segment: '海口湾', rate: -0.8 },
  { segment: '铺前湾', rate: -1.5 },
  { segment: '清澜湾', rate: 0.6 },
  { segment: '博鳌岸段', rate: -0.4 },
  { segment: '三亚湾', rate: -0.6 },
  { segment: '莺歌海', rate: 2.1 },
  { segment: '八所岸段', rate: -1.2 },
  { segment: '洋浦湾', rate: 0.9 }
]

// 红树林面积变化（km²）
export const mangroveArea = [
  { year: '2000', area: 42.6 },
  { year: '2005', area: 41.2 },
  { year: '2010', area: 43.8 },
  { year: '2015', area: 47.1 },
  { year: '2020', area: 52.4 },
  { year: '2024', area: 56.8 },
  { year: '2025', area: 57.9 },
  { year: '2026', area: 59.0 }
]

// 历史台风（影响海南岛）
export const typhoonList = [
  { id: '2411', name: '摩羯 YAGI', en: 'YAGI', date: '2024-09-06', landfall: '海南文昌', grade: '超强台风', wind: 62, pressure: 958, status: '历史' },
  { id: '2118', name: '圆规 KOMPASU', en: 'KOMPASU', date: '2021-10-13', landfall: '海南琼海', grade: '台风', wind: 33, pressure: 975, status: '历史' },
  { id: '2220', name: '纳沙 NESAT', en: 'NESAT', date: '2022-10-18', landfall: '广东湛江（严重影响海南）', grade: '强台风', wind: 40, pressure: 965, status: '历史' },
  { id: '2017', name: '沙德尔 SAUDEL', en: 'SAUDEL', date: '2020-10-24', landfall: '海南近海', grade: '强热带风暴', wind: 28, pressure: 980, status: '历史' },
  { id: '1409', name: '威马逊 RAMMASUN', en: 'RAMMASUN', date: '2014-07-18', landfall: '海南文昌', grade: '超强台风', wind: 60, pressure: 910, status: '历史' }
]

// 摩羯台风路径点（UTC+8）
export const yagiTrack = [
  { t: '09-02 08:00', lon: 122.4, lat: 17.2, grade: '热带风暴', wind: 23, pressure: 990, radius: 120 },
  { t: '09-03 08:00', lon: 120.3, lat: 17.6, grade: '强热带风暴', wind: 30, pressure: 980, radius: 150 },
  { t: '09-04 08:00', lon: 117.8, lat: 18.1, grade: '台风', wind: 38, pressure: 965, radius: 180 },
  { t: '09-05 08:00', lon: 115.0, lat: 18.6, grade: '强台风', wind: 48, pressure: 955, radius: 220 },
  { t: '09-05 20:00', lon: 113.6, lat: 19.0, grade: '超强台风', wind: 58, pressure: 935, radius: 250 },
  { t: '09-06 14:00', lon: 111.5, lat: 19.45, grade: '超强台风', wind: 62, pressure: 932, radius: 260 },
  { t: '09-06 16:20 登陆', lon: 110.78, lat: 19.62, grade: '超强台风(登陆)', wind: 62, pressure: 958, radius: 260 },
  { t: '09-07 04:00', lon: 109.2, lat: 19.95, grade: '强台风', wind: 45, pressure: 960, radius: 200 },
  { t: '09-07 16:00', lon: 107.3, lat: 20.6, grade: '台风', wind: 35, pressure: 970, radius: 170 },
  { t: '09-08 08:00', lon: 105.2, lat: 21.3, grade: '强热带风暴', wind: 28, pressure: 982, radius: 140 }
]

// 实时预警流（模拟）
export const alerts = [
  { level: '红色', type: '风暴潮预警', area: '文昌铺前湾', time: '2024-09-06 10:00', typhoonId: '2411', desc: '预计最高风暴增水 1.8–2.5 m' },
  { level: '红色', type: '台风预警', area: '海口、文昌、澄迈', time: '2024-09-06 08:30', typhoonId: '2411', desc: '超强台风"摩羯"将于傍晚登陆' },
  { level: '橙色', type: '暴雨预警', area: '海南岛北部', time: '2024-09-06 08:00', typhoonId: '2411', desc: '局地累计雨量 300–500 mm' },
  { level: '黄色', type: '赤潮风险提示', area: '八所近岸', time: '2024-09-05 16:00', typhoonId: null, desc: 'Chl-a 持续偏高，注意灾后藻华' },
  { level: '蓝色', type: '海浪预警', area: '琼州海峡', time: '2024-09-05 12:00', typhoonId: '2411', desc: '狂浪到狂涛，客轮停航' }
]

// ===== 灾害评估（摩羯，模拟统计） =====
export const damageSummary = {
  event: '2411 台风"摩羯"',
  affectedCities: 16,
  affectedPopulation: 283.6, // 万人
  economicLoss: 285.6, // 亿元
  inundationArea: 312.8, // km²（Sentinel-1 SAR 提取）
  building: { none: 386500, minor: 92400, major: 21300, destroyed: 5860 },
  vegetationDamage: 1862.4, // km²，NDVI 显著下降区
  powerOutage: 86.5 // %，基于 VIIRS 夜间灯光
}

// 建筑损毁分级
export const buildingDamage = [
  { name: '无损坏', value: 386500, color: '#2ee6a6' },
  { name: '轻微损坏', value: 92400, color: '#ffd666' },
  { name: '严重损坏', value: 21300, color: '#ff9c40' },
  { name: '完全摧毁', value: 5860, color: '#ff5c5c' }
]

// 台风前后 NDVI 均值对比
export const ndviCompare = {
  dates: ['08-25', '08-28', '08-31', '09-03', '09-06', '09-09', '09-12', '09-15', '09-18', '09-21'],
  before: [0.78, 0.77, 0.78, 0.76, 0.75, null, null, null, null, null],
  after: [null, null, null, null, null, 0.51, 0.53, 0.56, 0.59, 0.62]
}

// 各市县受灾情况
export const cityDamage = [
  { city: '文昌', inundation: 86.4, buildings: 41200, vegetation: 486.2 },
  { city: '海口', inundation: 62.8, buildings: 36800, vegetation: 268.5 },
  { city: '澄迈', inundation: 41.5, buildings: 15600, vegetation: 214.3 },
  { city: '临高', inundation: 35.2, buildings: 11200, vegetation: 186.7 },
  { city: '琼海', inundation: 28.6, buildings: 8600, vegetation: 172.5 },
  { city: '儋州', inundation: 24.1, buildings: 7900, vegetation: 158.9 },
  { city: '定安', inundation: 14.8, buildings: 3200, vegetation: 142.1 },
  { city: '其他', inundation: 19.4, buildings: 13860, vegetation: 233.2 }
]

// 模拟淹没区斑块（多边形，近文昌/海口沿岸）
export const inundationPolygons = [
  [
    [110.72, 19.98], [110.95, 20.02], [111.02, 19.82], [110.88, 19.62],
    [110.66, 19.68], [110.6, 19.85]
  ],
  [
    [110.18, 20.0], [110.42, 20.06], [110.46, 19.9], [110.22, 19.88]
  ]
]

// ===== 多源卫星数据中心 =====
export const satelliteCatalog = [
  { sat: 'Sentinel-1A/1B', sensor: 'C-SAR', type: 'SAR 雷达', resolution: '5×20 m', revisit: '6 天', scenes: 1286, latest: '2026-09-15 22:14', usage: '台风期洪涝淹没、全天候形变', status: '在线' },
  { sat: 'Sentinel-2A/2B', sensor: 'MSI', type: '多光谱光学', resolution: '10–60 m', revisit: '5 天', scenes: 3452, latest: '2026-09-16 11:02', usage: 'Chl-a/SPM 反演、NDVI、岸线', status: '在线' },
  { sat: 'Sentinel-3A/3B', sensor: 'SLSTR/OLCI', type: '海温/水色', resolution: '300 m–1 km', revisit: '1 天', scenes: 5621, latest: '2026-09-16 09:40', usage: '海表温度 SST、大范围水色', status: '在线' },
  { sat: 'Landsat-8/9', sensor: 'OLI/TIRS', type: '多光谱+热红外', resolution: '15–100 m', revisit: '8 天', scenes: 2108, latest: '2026-09-14 03:15', usage: '长时序岸线、红树林变迁', status: '在线' },
  { sat: '高分一号', sensor: 'WFV/PMS', type: '多光谱光学', resolution: '2–16 m', revisit: '4 天', scenes: 1864, latest: '2026-09-15 15:26', usage: '国产高分辨率地表监测', status: '在线' },
  { sat: '高分二号', sensor: 'PMS', type: '亚米级光学', resolution: '0.8 m', revisit: '5 天', scenes: 968, latest: '2026-09-14 10:48', usage: '建筑损毁精细判读', status: '在线' },
  { sat: '高分三号', sensor: 'SAR', type: 'SAR 雷达', resolution: '1–500 m', revisit: '按需', scenes: 436, latest: '2026-09-13 21:05', usage: '台风期国产 SAR 应急成像', status: '在线' },
  { sat: 'Aqua/Terra', sensor: 'MODIS', type: '中分辨率成像', resolution: '250 m–1 km', revisit: '1 天', scenes: 8832, latest: '2026-09-16 06:30', usage: '大尺度 SST、云图、藻华普查', status: '在线' },
  { sat: 'Suomi-NPP/NOAA', sensor: 'VIIRS', type: '夜光/可见光', resolution: '375–750 m', revisit: '1 天', scenes: 4210, latest: '2026-09-16 02:12', usage: '夜间灯光评估停电与恢复', status: '在线' }
]

export const overviewStats = {
  stationCount: 6,
  todayPasses: 4,
  activeTyphoon: 0,
  alertCount: 5,
  totalScenes: 28777,
  coverage: 100
}

// 近 7 日卫星接入量
export const weeklyScenes = {
  days: ['09-10', '09-11', '09-12', '09-13', '09-14', '09-15', '09-16'],
  optical: [126, 98, 142, 110, 134, 156, 88],
  sar: [24, 32, 18, 36, 28, 42, 26]
}
