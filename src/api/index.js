/**
 * 缁熶竴鏁版嵁璁块棶灞? * USE_MOCK = false 鈫?璧?FastAPI 鍚庣锛?api 鍓嶇紑鐢?Vite proxy 杞彂鍒?127.0.0.1:8000锛? * 椤甸潰浠ｇ爜缁熶竴璋冪敤鏈眰鍑芥暟锛屽悗绔湴鍧€鍙樺寲鍙渶鏀?vite.config.js proxy銆? */
import * as mock from '@/mock'

const USE_MOCK = true

function resolve(data, delay = 120) {
  return new Promise((res) => setTimeout(() => res(data), delay))
}

function api(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API ${r.status}: ${url}`)
    return r.json()
  })
}

// 鈹€鈹€鈹€ 鍏叡 鈹€鈹€鈹€
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

// 鈹€鈹€鈹€ 鐢熸€佺洃娴?鈹€鈹€鈹€
export function fetchChlaSeries(station) {
  const data = { months: mock.months, values: mock.chlaSeries[station] || mock.chlaSeries['娴峰彛婀?] }
  return USE_MOCK
    ? resolve(data)
    : api(`/api/ecology/chla?station=${encodeURIComponent(station)}`)
}

export function fetchSstSeries(station = '娴峰彛婀?) {
  const data = { months: mock.months, values: mock.sstSeries[station] || mock.sstSeries['娴峰彛婀?] }
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

// 鈹€鈹€鈹€ 鍙伴 鈹€鈹€鈹€
export function fetchTyphoonList() {
  return USE_MOCK ? resolve(mock.typhoonList) : api('/api/typhoon/list')
}

export function fetchTyphoonTrack(id) {
  return USE_MOCK
    ? resolve(id === '2411' ? mock.yagiTrack : mock.yagiTrack.map((p) => ({ ...p })))
    : api(`/api/typhoon/track/${id}`)
}

// 鈹€鈹€鈹€ 鐏惧璇勪及 鈹€鈹€鈹€
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

// 鈹€鈹€鈹€ 鍗槦鏁版嵁涓績 鈹€鈹€鈹€
export function fetchSatelliteCatalog() {
  return USE_MOCK ? resolve(mock.satelliteCatalog) : api('/api/satellite/catalog')
}
