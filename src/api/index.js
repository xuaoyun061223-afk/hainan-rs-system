/**
 * 统一数据访问层
 * USE_MOCK = false → 走 FastAPI 后端（/api 前缀由 Vite proxy 转发到 127.0.0.1:8000）
 * 页面代码统一调用本层函数，后端地址变化只需改 vite.config.js proxy。
 */
import * as mock from '@/mock'

const USE_MOCK = false

function resolve(data, delay = 120) {
  return new Promise((res) => setTimeout(() => res(data), delay))
}

function api(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API ${r.status}: ${url}`)
    return r.json()
  })
}

// ─── 公共 ───
export function fetchHainanOutline() {
  return USE_MOCK ? resolve(mock.hainanOutline) : api('/api/hainan-outline')
}

export function fetchStations() {
  return USE_MOCK ? resolve(mock.stations) : api('/api/stations')
}

export function fetchAlerts() {
  return USE_MOCK ? resolve(mock.alerts) : api('/api/alerts')
}

export function fetchOverviewStats() {
  return USE_MOCK ? resolve(mock.overviewStats) : api('/api/overview')
}

export function fetchWeeklyScenes() {
  return USE_MOCK ? resolve(mock.weeklyScenes) : api('/api/weekly-scenes')
}

export function fetchWaterGrade() {
  return USE_MOCK ? resolve(mock.waterGradeDist) : api('/api/water-grade')
}

// ─── 生态监测 ───
export function fetchChlaSeries(station) {
  const data = { months: mock.months, values: mock.chlaSeries[station] || mock.chlaSeries['海口湾'] }
  return USE_MOCK
    ? resolve(data)
    : api(`/api/ecology/chla?station=${encodeURIComponent(station)}`)
}

export function fetchSstSeries(station = '海口湾') {
  const data = { months: mock.months, values: mock.sstSeries[station] || mock.sstSeries['海口湾'] }
  return USE_MOCK
    ? resolve(data)
    : api(`/api/ecology/sst?station=${encodeURIComponent(station)}`)
}

export function fetchShorelineChange() {
  return USE_MOCK ? resolve(mock.shorelineChange) : api('/api/ecology/shoreline')
}

export function fetchMangroveArea() {
  return USE_MOCK ? resolve(mock.mangroveArea) : api('/api/ecology/mangrove')
}

// ─── 台风 ───
export function fetchTyphoonList() {
  return USE_MOCK ? resolve(mock.typhoonList) : api('/api/typhoon/list')
}

export function fetchTyphoonTrack(id) {
  return USE_MOCK
    ? resolve(id === '2411' ? mock.yagiTrack : mock.yagiTrack.map((p) => ({ ...p })))
    : api(`/api/typhoon/track/${id}`)
}

// ─── 灾害评估 ───
export function fetchDamageSummary() {
  return USE_MOCK ? resolve(mock.damageSummary) : api('/api/damage/summary')
}

export function fetchBuildingDamage() {
  return USE_MOCK ? resolve(mock.buildingDamage) : api('/api/damage/building')
}

export function fetchNdviCompare() {
  return USE_MOCK ? resolve(mock.ndviCompare) : api('/api/damage/ndvi')
}

export function fetchCityDamage() {
  return USE_MOCK ? resolve(mock.cityDamage) : api('/api/damage/city')
}

export function fetchInundation() {
  return USE_MOCK ? resolve(mock.inundationPolygons) : api('/api/damage/inundation')
}

// ─── 卫星数据中心 ───
export function fetchSatelliteCatalog() {
  return USE_MOCK ? resolve(mock.satelliteCatalog) : api('/api/satellite/catalog')
}
