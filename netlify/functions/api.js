// Netlify Functions - 海南遥感系统后端 API
const { URL } = require('url')

// ─── 数据 ───
const HAINAN_OUTLINE = [
  [110.62, 20.12], [110.98, 20.06], [111.07, 19.86], [110.86, 19.55],
  [110.98, 19.3], [110.62, 18.86], [110.32, 18.46], [110.06, 18.26],
  [109.76, 18.2], [109.4, 18.3], [109.06, 18.46], [108.7, 18.72],
  [108.62, 19.06], [108.76, 19.42], [109.06, 19.66], [109.3, 19.92],
  [109.66, 20.06], [110.1, 20.14], [110.42, 20.16],
]

const STATIONS = [
  { id: "S01", name: "海口湾", lon: 110.27, lat: 20.07, chla: 2.8, spm: 12.4, sst: 28.6, grade: "二类", risk: "低" },
  { id: "S02", name: "清澜湾", lon: 110.83, lat: 19.55, chla: 4.6, spm: 18.2, sst: 28.9, grade: "二类", risk: "中" },
  { id: "S03", name: "博鳌近岸", lon: 110.59, lat: 19.15, chla: 1.9, spm: 8.6, sst: 28.4, grade: "一类", risk: "低" },
  { id: "S04", name: "三亚湾", lon: 109.49, lat: 18.24, chla: 1.2, spm: 6.3, sst: 28.1, grade: "一类", risk: "低" },
  { id: "S05", name: "洋浦湾", lon: 109.19, lat: 19.74, chla: 3.5, spm: 22.7, sst: 29.2, grade: "二类", risk: "中" },
  { id: "S06", name: "八所近岸", lon: 108.63, lat: 19.1, chla: 5.8, spm: 26.1, sst: 29.5, grade: "三类", risk: "高" },
]

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

const CHLA_SERIES = {
  "海口湾":   [1.8, 1.6, 1.9, 2.3, 2.6, 3.2, 3.8, 3.5, 2.8, 2.4, 2.1, 1.9],
  "清澜湾":   [2.1, 1.9, 2.4, 3.1, 3.6, 4.5, 5.8, 5.2, 4.6, 3.4, 2.8, 2.3],
  "博鳌近岸":  [1.1, 1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.3, 1.9, 1.6, 1.3, 1.2],
  "三亚湾":   [0.8, 0.7, 0.9, 1.1, 1.3, 1.6, 1.9, 1.7, 1.2, 1.0, 0.9, 0.8],
  "洋浦湾":   [2.2, 2.0, 2.5, 3.0, 3.4, 4.1, 4.9, 4.6, 3.5, 3.0, 2.6, 2.3],
  "八所近岸":  [2.9, 2.6, 3.3, 4.0, 4.8, 5.9, 7.2, 6.8, 5.8, 4.3, 3.5, 3.1],
}

const SST_SERIES = {
  "海口湾":  [21.5, 21.8, 23.6, 26.1, 28.8, 30.2, 30.8, 30.5, 29.4, 27.6, 25.1, 22.8],
  "三亚湾":  [24.6, 24.9, 26.2, 28.1, 29.6, 30.4, 30.6, 30.2, 29.6, 28.5, 26.9, 25.2],
}

const WATER_GRADE_DIST = [
  { name: "一类水质", value: 38 },
  { name: "二类水质", value: 46 },
  { name: "三类水质", value: 13 },
  { name: "四类及劣四类", value: 3 },
]

const SHORELINE_CHANGE = [
  { segment: "海口湾", rate: -0.8 },
  { segment: "铺前湾", rate: -1.5 },
  { segment: "清澜湾", rate: 0.6 },
  { segment: "博鳌岸段", rate: -0.4 },
  { segment: "三亚湾", rate: -0.6 },
  { segment: "莺歌海", rate: 2.1 },
  { segment: "八所岸段", rate: -1.2 },
  { segment: "洋浦湾", rate: 0.9 },
]

const MANGROVE_AREA = [
  { year: "2000", area: 42.6 },
  { year: "2005", area: 41.2 },
  { year: "2010", area: 43.8 },
  { year: "2015", area: 47.1 },
  { year: "2020", area: 52.4 },
  { year: "2024", area: 56.8 },
]

const TYPHOON_LIST = [
  { id: "2411", name: "摩羯 YAGI", en: "YAGI", date: "2024-09-06", landfall: "海南文昌", grade: "超强台风", wind: 62, pressure: 958, status: "历史" },
  { id: "2118", name: "圆规 KOMPASU", en: "KOMPASU", date: "2021-10-13", landfall: "海南琼海", grade: "台风", wind: 33, pressure: 975, status: "历史" },
  { id: "2220", name: "纳沙 NESAT", en: "NESAT", date: "2022-10-18", landfall: "广东湛江（严重影响海南）", grade: "强台风", wind: 40, pressure: 965, status: "历史" },
  { id: "2017", name: "沙德尔 SAUDEL", en: "SAUDEL", date: "2020-10-24", landfall: "海南近海", grade: "强热带风暴", wind: 28, pressure: 980, status: "历史" },
  { id: "1409", name: "威马逊 RAMMASUN", en: "RAMMASUN", date: "2014-07-18", landfall: "海南文昌", grade: "超强台风", wind: 60, pressure: 910, status: "历史" },
]

const TYPHOON_TRACKS = {
  "2411": [
    { t: "09-02 08:00", lon: 122.4, lat: 17.2, grade: "热带风暴", wind: 23, pressure: 990, radius: 120 },
    { t: "09-03 08:00", lon: 120.3, lat: 17.6, grade: "强热带风暴", wind: 30, pressure: 980, radius: 150 },
    { t: "09-04 08:00", lon: 117.8, lat: 18.1, grade: "台风", wind: 38, pressure: 965, radius: 180 },
    { t: "09-05 08:00", lon: 115.0, lat: 18.6, grade: "强台风", wind: 48, pressure: 955, radius: 220 },
    { t: "09-05 20:00", lon: 113.6, lat: 19.0, grade: "超强台风", wind: 58, pressure: 935, radius: 250 },
    { t: "09-06 14:00", lon: 111.5, lat: 19.45, grade: "超强台风", wind: 62, pressure: 932, radius: 260 },
    { t: "09-06 16:20 登陆", lon: 110.78, lat: 19.62, grade: "超强台风(登陆)", wind: 62, pressure: 958, radius: 260 },
    { t: "09-07 04:00", lon: 109.2, lat: 19.95, grade: "强台风", wind: 45, pressure: 960, radius: 200 },
    { t: "09-07 16:00", lon: 107.3, lat: 20.6, grade: "台风", wind: 35, pressure: 970, radius: 170 },
    { t: "09-08 08:00", lon: 105.2, lat: 21.3, grade: "强热带风暴", wind: 28, pressure: 982, radius: 140 },
  ],
  "2118": [
    { t: "10-10 08:00", lon: 126.8, lat: 14.2, grade: "热带风暴", wind: 20, pressure: 995, radius: 100 },
    { t: "10-11 08:00", lon: 124.2, lat: 15.8, grade: "强热带风暴", wind: 28, pressure: 985, radius: 130 },
    { t: "10-12 08:00", lon: 119.5, lat: 17.6, grade: "台风", wind: 33, pressure: 975, radius: 160 },
    { t: "10-13 08:00", lon: 115.0, lat: 19.2, grade: "台风(登陆)", wind: 33, pressure: 975, radius: 160 },
    { t: "10-14 08:00", lon: 110.5, lat: 21.0, grade: "强热带风暴", wind: 25, pressure: 988, radius: 120 },
  ],
  "2220": [
    { t: "10-15 08:00", lon: 128.0, lat: 14.5, grade: "热带风暴", wind: 22, pressure: 992, radius: 110 },
    { t: "10-16 08:00", lon: 125.2, lat: 16.3, grade: "强热带风暴", wind: 30, pressure: 980, radius: 140 },
    { t: "10-17 08:00", lon: 121.8, lat: 18.5, grade: "台风", wind: 40, pressure: 965, radius: 190 },
    { t: "10-18 08:00", lon: 118.5, lat: 20.8, grade: "强台风", wind: 45, pressure: 960, radius: 210 },
    { t: "10-19 08:00", lon: 114.8, lat: 22.2, grade: "台风", wind: 35, pressure: 972, radius: 170 },
  ],
  "2017": [
    { t: "10-22 08:00", lon: 125.5, lat: 15.2, grade: "热带风暴", wind: 18, pressure: 998, radius: 90 },
    { t: "10-23 08:00", lon: 122.8, lat: 16.8, grade: "强热带风暴", wind: 28, pressure: 980, radius: 130 },
    { t: "10-24 08:00", lon: 119.2, lat: 18.4, grade: "强热带风暴(登陆)", wind: 28, pressure: 980, radius: 140 },
    { t: "10-25 08:00", lon: 115.0, lat: 20.0, grade: "热带风暴", wind: 20, pressure: 990, radius: 100 },
  ],
  "1409": [
    { t: "07-14 08:00", lon: 127.0, lat: 12.5, grade: "强热带风暴", wind: 25, pressure: 985, radius: 120 },
    { t: "07-15 08:00", lon: 124.5, lat: 14.8, grade: "台风", wind: 40, pressure: 960, radius: 180 },
    { t: "07-16 08:00", lon: 120.8, lat: 16.5, grade: "强台风", wind: 50, pressure: 935, radius: 220 },
    { t: "07-17 08:00", lon: 116.2, lat: 18.2, grade: "超强台风", wind: 60, pressure: 910, radius: 260 },
    { t: "07-18 09:00 登陆", lon: 110.78, lat: 19.62, grade: "超强台风(登陆)", wind: 60, pressure: 910, radius: 260 },
    { t: "07-19 08:00", lon: 106.5, lat: 22.0, grade: "强台风", wind: 42, pressure: 955, radius: 200 },
    { t: "07-20 08:00", lon: 102.0, lat: 24.5, grade: "台风", wind: 33, pressure: 975, radius: 150 },
  ],
}

const ALERTS = [
  { level: "红色", type: "风暴潮预警", area: "文昌铺前湾", time: "09-06 10:00", desc: "预计最高风暴增水 1.8–2.5 m" },
  { level: "红色", type: "台风预警", area: "海口、文昌、澄迈", time: "09-06 08:30", desc: "超强台风\"摩羯\"将于傍晚登陆" },
  { level: "橙色", type: "暴雨预警", area: "海南岛北部", time: "09-06 08:00", desc: "局地累计雨量 300–500 mm" },
  { level: "黄色", type: "赤潮风险提示", area: "八所近岸", time: "09-05 16:00", desc: "Chl-a 持续偏高，注意灾后藻华" },
  { level: "蓝色", type: "海浪预警", area: "琼州海峡", time: "09-05 12:00", desc: "狂浪到狂涛，客滚船停航" },
]

const DAMAGE_SUMMARY = {
  event: "2411 台风\"摩羯\"",
  affectedCities: 16,
  affectedPopulation: 283.6,
  economicLoss: 285.6,
  inundationArea: 312.8,
  building: { none: 386500, minor: 92400, major: 21300, destroyed: 5860 },
  vegetationDamage: 1862.4,
  powerOutage: 86.5,
}

const BUILDING_DAMAGE = [
  { name: "无损坏", value: 386500, color: "#2ee6a6" },
  { name: "轻微损坏", value: 92400, color: "#ffd666" },
  { name: "严重损坏", value: 21300, color: "#ff9c40" },
  { name: "完全摧毁", value: 5860, color: "#ff5c5c" },
]

const NDVI_COMPARE = {
  dates: ["08-25", "08-28", "08-31", "09-03", "09-06", "09-09", "09-12", "09-15", "09-18", "09-21"],
  before: [0.78, 0.77, 0.78, 0.76, 0.75, null, null, null, null, null],
  after: [null, null, null, null, null, 0.51, 0.53, 0.56, 0.59, 0.62],
}

const CITY_DAMAGE = [
  { city: "文昌", inundation: 86.4, buildings: 41200, vegetation: 486.2 },
  { city: "海口", inundation: 62.8, buildings: 36800, vegetation: 268.5 },
  { city: "澄迈", inundation: 41.5, buildings: 15600, vegetation: 214.3 },
  { city: "临高", inundation: 35.2, buildings: 11200, vegetation: 186.7 },
  { city: "琼海", inundation: 28.6, buildings: 8600, vegetation: 172.5 },
  { city: "儋州", inundation: 24.1, buildings: 7900, vegetation: 158.9 },
  { city: "定安", inundation: 14.8, buildings: 3200, vegetation: 142.1 },
  { city: "其他", inundation: 19.4, buildings: 13860, vegetation: 233.2 },
]

const INUNDATION_POLYGONS = [
  [[110.72, 19.98], [110.95, 20.02], [111.02, 19.82], [110.88, 19.62], [110.66, 19.68], [110.6, 19.85]],
  [[110.18, 20.0], [110.42, 20.06], [110.46, 19.9], [110.22, 19.88]],
]

const SATELLITE_CATALOG = [
  { sat: "Sentinel-1A/1B", sensor: "C-SAR", type: "SAR 雷达", resolution: "5×20 m", revisit: "6 天", scenes: 1286, latest: "2026-09-15 22:14", usage: "台风期洪涝淹没、全天候形变", status: "在线" },
  { sat: "Sentinel-2A/2B", sensor: "MSI", type: "多光谱光学", resolution: "10–60 m", revisit: "5 天", scenes: 3452, latest: "2026-09-16 11:02", usage: "Chl-a/SPM 反演、NDVI、岸线", status: "在线" },
  { sat: "Sentinel-3A/3B", sensor: "SLSTR/OLCI", type: "海温/水色", resolution: "300 m–1 km", revisit: "1 天", scenes: 5621, latest: "2026-09-16 09:40", usage: "海表温度 SST、大范围水色", status: "在线" },
  { sat: "Landsat-8/9", sensor: "OLI/TIRS", type: "多光谱+热红外", resolution: "15–100 m", revisit: "8 天", scenes: 2108, latest: "2026-09-14 03:15", usage: "长时序岸线、红树林变迁", status: "在线" },
  { sat: "高分一号", sensor: "WFV/PMS", type: "多光谱光学", resolution: "2–16 m", revisit: "4 天", scenes: 1864, latest: "2026-09-15 15:26", usage: "国产高分辨率地表监测", status: "在线" },
  { sat: "高分二号", sensor: "PMS", type: "亚米级光学", resolution: "0.8 m", revisit: "5 天", scenes: 968, latest: "2026-09-14 10:48", usage: "建筑损毁精细判读", status: "在线" },
  { sat: "高分三号", sensor: "SAR", type: "SAR 雷达", resolution: "1–500 m", revisit: "按需", scenes: 436, latest: "2026-09-13 21:05", usage: "台风期国产 SAR 应急成像", status: "在线" },
  { sat: "Aqua/Terra", sensor: "MODIS", type: "中分辨率成像", resolution: "250 m–1 km", revisit: "1 天", scenes: 8832, latest: "2026-09-16 06:30", usage: "大尺度 SST、云图、藻华普查", status: "在线" },
  { sat: "Suomi-NPP/NOAA", sensor: "VIIRS", type: "夜光/可见光", resolution: "375–750 m", revisit: "1 天", scenes: 4210, latest: "2026-09-16 02:12", usage: "夜间灯光评估停电与恢复", status: "在线" },
]

const OVERVIEW_STATS = {
  stationCount: 6, todayPasses: 4, activeTyphoon: 0,
  alertCount: 5, totalScenes: 28777, coverage: 100,
}

const WEEKLY_SCENES = {
  days: ["09-10", "09-11", "09-12", "09-13", "09-14", "09-15", "09-16"],
  optical: [126, 98, 142, 110, 134, 156, 88],
  sar: [24, 32, 18, 36, 28, 42, 26],
}

// ─── 路由处理 ───
exports.handler = async (event, context) => {
  const path = event.path.replace('/api', '') || '/'
  const method = event.httpMethod
  const query = event.queryStringParameters || {}

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  let data = null
  let statusCode = 200

  try {
    // 健康检查
    if (path === '/health') {
      data = { status: 'ok', service: 'hainan-rs-system', version: '0.1.0' }
    }
    // 公共
    else if (path === '/hainan-outline') data = HAINAN_OUTLINE
    else if (path === '/stations') data = STATIONS
    else if (path === '/alerts') data = ALERTS
    else if (path === '/overview') data = OVERVIEW_STATS
    else if (path === '/weekly-scenes') data = WEEKLY_SCENES
    else if (path === '/water-grade') data = WATER_GRADE_DIST
    // 生态监测
    else if (path === '/ecology/chla') {
      const station = query.station || '海口湾'
      data = { months: MONTHS, values: CHLA_SERIES[station] || CHLA_SERIES['海口湾'] }
    }
    else if (path === '/ecology/sst') {
      const station = query.station || '海口湾'
      data = { months: MONTHS, values: SST_SERIES[station] || SST_SERIES['海口湾'] }
    }
    else if (path === '/ecology/shoreline') data = SHORELINE_CHANGE
    else if (path === '/ecology/mangrove') data = MANGROVE_AREA
    // 台风
    else if (path === '/typhoon/list') data = TYPHOON_LIST
    else if (path.match(/^\/typhoon\/track\/(.+)$/)) {
      const id = path.match(/^\/typhoon\/track\/(.+)$/)[1]
      data = TYPHOON_TRACKS[id] || TYPHOON_TRACKS['2411']
    }
    // 灾害评估
    else if (path === '/damage/summary') data = DAMAGE_SUMMARY
    else if (path === '/damage/building') data = BUILDING_DAMAGE
    else if (path === '/damage/ndvi') data = NDVI_COMPARE
    else if (path === '/damage/city') data = CITY_DAMAGE
    else if (path === '/damage/inundation') data = INUNDATION_POLYGONS
    // 卫星数据
    else if (path === '/satellite/catalog') data = SATELLITE_CATALOG
    else {
      statusCode = 404
      data = { error: 'Not found', path }
    }
  } catch (err) {
    statusCode = 500
    data = { error: err.message }
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(data),
  }
}
