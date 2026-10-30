// 台风灾害快速评估模型（JS 版，与 backend/damage_model.py 保持一致）。
// 不依赖人工灾情台账：以「台风强度（最大风速）」和「轨迹到海南岛的最短距离」为驱动，
// 用幂律外推各项灾情总量，再按各市县到登陆点的距离分摊，因此
//   - 历史台风与实时台风都能评估；
//   - 弱台风、远距离台风得到的灾情明显更小；
//   - 同一输入始终得到同一结果（无随机数），便于逐日复现。
// 口径校准：以 2411「摩羯」（62 m/s、正面登陆文昌）为 1.0 基准，结果与快照一致。

const REF_WIND = 62
const HAINAN_CENTER = [109.8, 19.5]
const REF_LANDFALL = [110.78, 19.62]
const TOTAL_BUILDINGS = 506060

const CITY_BASE = [
  { city: '文昌', lon: 110.8, lat: 19.55, inundation: 86.4, buildings: 41200, vegetation: 486.2 },
  { city: '海口', lon: 110.32, lat: 20.04, inundation: 62.8, buildings: 36800, vegetation: 268.5 },
  { city: '澄迈', lon: 110.0, lat: 19.74, inundation: 41.5, buildings: 15600, vegetation: 214.3 },
  { city: '临高', lon: 109.69, lat: 19.91, inundation: 35.2, buildings: 11200, vegetation: 186.7 },
  { city: '琼海', lon: 110.47, lat: 19.26, inundation: 28.6, buildings: 8600, vegetation: 172.5 },
  { city: '儋州', lon: 109.58, lat: 19.52, inundation: 24.1, buildings: 7900, vegetation: 158.9 },
  { city: '定安', lon: 110.35, lat: 19.68, inundation: 14.8, buildings: 3200, vegetation: 142.1 },
  { city: '其他', lon: 109.5, lat: 18.6, inundation: 19.4, buildings: 13860, vegetation: 233.2 },
]

const POLY_TEMPLATE = [
  [[110.72, 19.98], [110.95, 20.02], [111.02, 19.82], [110.88, 19.62], [110.66, 19.68], [110.6, 19.85]],
  [[110.18, 20.0], [110.42, 20.06], [110.46, 19.9], [110.22, 19.88]],
]

// 海南岛范围框与常见登陆市县坐标，用于判定「是否正面影响海南」及淹没区锚点
const HAINAN_BOX = [108.4, 17.8, 111.3, 20.3]
const CITY_ANCHORS = {
  文昌: [110.8, 19.62],
  琼海: [110.47, 19.26],
  万宁: [110.39, 18.8],
  海口: [110.32, 20.04],
  澄迈: [110.0, 19.74],
  临高: [109.69, 19.91],
  儋州: [109.58, 19.52],
  三亚: [109.51, 18.25],
}

const inHainan = (lon, lat) =>
  lon >= HAINAN_BOX[0] && lon <= HAINAN_BOX[2] && lat >= HAINAN_BOX[1] && lat <= HAINAN_BOX[3]

/** 四舍五入到指定小数位（正数，.5 进位） */
function rnd(x, digits = 1) {
  const m = 10 ** digits
  return Math.floor(x * m + 0.5) / m
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const cos = (deg) => Math.cos((deg * Math.PI) / 180)

/** 等距圆柱近似距离（海南岛尺度足够精确，且与 Python 版一致） */
function distKm(lon1, lat1, lon2, lat2) {
  const dx = (lon2 - lon1) * cos((lat1 + lat2) / 2) * 111.0
  const dy = (lat2 - lat1) * 111.0
  return Math.sqrt(dx * dx + dy * dy)
}

/** 登陆点：优先取标有「登陆」的轨迹点；未登陆时取距离海南岛最近的点 */
function landfallPoint(track) {
  if (!track || !track.length) return null
  const hit = track.find((p) => String(p.grade || '').includes('登陆'))
  if (hit) return hit
  return track.reduce(
    (best, p) => (distKm(HAINAN_CENTER[0], HAINAN_CENTER[1], p.lon, p.lat) <
      distKm(HAINAN_CENTER[0], HAINAN_CENTER[1], best.lon, best.lat) ? p : best),
    track[0]
  )
}

/**
 * 逼近程度 p∈[0.03,1]：轨迹离海南岛最近点，距离每 250 km 衰减到 1/e。
 * 若描述里出现「海南」，或登陆点本身落在海南岛范围内，则视为正面影响（p=1）。
 */
function proximity(track, landfallText = '') {
  if (!track || !track.length) return { p: 0.4, dmin: 999 }
  const dmin = track.reduce(
    (best, p) => Math.min(best, distKm(HAINAN_CENTER[0], HAINAN_CENTER[1], p.lon, p.lat)),
    Infinity
  )
  const lf = landfallPoint(track)
  const hitHainan = String(landfallText).includes('海南') || (lf && inHainan(lf.lon, lf.lat))
  const p = hitHainan ? 1 : Math.exp(-dmin / 250)
  return { p: clamp(p, 0.03, 1), dmin: rnd(dmin, 1) }
}

/**
 * 灾情分摊与淹没区锚点：
 * 1) 描述里带具体市县名（如「海南文昌」「海南琼海」）→ 用该市县坐标；
 * 2) 登陆点在海南岛范围内 → 用登陆点；
 * 3) 其余 → 轨迹上最接近海南岛的点（仍可能离岛较远，淹没区不再绘制）。
 */
function impactAnchor(track, landfallText = '') {
  const text = String(landfallText || '')
  for (const [city, [lon, lat]] of Object.entries(CITY_ANCHORS)) {
    if (text.includes(city)) return { lon, lat, inside: true }
  }
  const lf = landfallPoint(track)
  if (lf && inHainan(lf.lon, lf.lat)) return { ...lf, inside: true }
  if (track && track.length) {
    const closest = track.reduce(
      (best, p) => (distKm(HAINAN_CENTER[0], HAINAN_CENTER[1], p.lon, p.lat) <
        distKm(HAINAN_CENTER[0], HAINAN_CENTER[1], best.lon, best.lat) ? p : best),
      track[0]
    )
    return { ...closest, inside: inHainan(closest.lon, closest.lat) }
  }
  return { lon: REF_LANDFALL[0], lat: REF_LANDFALL[1], inside: false }
}

/** 登陆/影响市县名：优先取描述中的市县，否则取离锚点最近的市县（60 km 内） */
function landfallCity(text, anchor) {
  const t = String(text || '')
  for (const city of Object.keys(CITY_ANCHORS)) {
    if (t.includes(city)) return city
  }
  let bestCity = ''
  let bestDist = 999
  for (const [city, [lon, lat]] of Object.entries(CITY_ANCHORS)) {
    const d = distKm(anchor.lon, anchor.lat, lon, lat)
    if (d < bestDist) {
      bestCity = city
      bestDist = d
    }
  }
  return bestDist <= 60 ? bestCity : ''
}

/** 前端地图需要的轨迹点（经纬度顺序为 [lon, lat]，与淹没区一致） */
function trackPoints(track) {
  return (track || [])
    .filter((p) => p && p.lon !== undefined && p.lat !== undefined)
    .map((p) => ({
      t: String(p.t || ''),
      lon: p.lon,
      lat: p.lat,
      grade: String(p.grade || ''),
      wind: p.wind ?? null,
      pressure: p.pressure ?? null,
      radius: p.radius ?? null,
    }))
}

/**
 * 是否已经登陆：轨迹里出现「登陆」标注，或文字描述给出了登陆地（而不是「未登陆」）。
 * 尚未登陆的台风（含预报路径、远海转向）只做风险评估，不生成实况灾情数字。
 */
function landedAlready(track, landfallText = '') {
  if ((track || []).some((p) => String(p?.grade || '').includes('登陆'))) return true
  const text = String(landfallText || '').trim()
  if (!text || text.includes('未登陆')) return false
  // 「近海」「掠过」只是靠近，不等于登陆
  return !(text.includes('近海') || text.includes('掠过'))
}

/** 按经济损失量级给出影响等级 */
function impactLevel(economic) {
  return economic >= 100 ? '特别重大' : economic >= 50 ? '重大' : economic >= 10 ? '较大' : '一般'
}

/** 台风前后 NDVI 时序：以登陆日为界，前段正常值、后段骤降再逐步恢复 */
function ndviSeries(r, landfallT, year, impact = true) {
  let base = new Date(Date.UTC(year, 8, 6))
  const mm = landfallT.slice(0, 2)
  const dd = landfallT.slice(3, 5)
  if (Number(mm) > 0 && Number(dd) > 0 && Number(dd) <= 31) {
    base = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)))
  }
  const offsets = [-12, -9, -6, -3, 0, 3, 6, 9, 12, 15]
  const dates = offsets.map((o) => {
    const d = new Date(base.getTime() + o * 86400000)
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })
  const before = [0.78, 0.77, 0.78, 0.76, 0.75, null, null, null, null, null]
  if (!impact) {
    // 尚未登陆：只给基线序列，表示「尚无过境影响」
    return { dates, before, after: [null, null, null, null, null, null, null, null, null, null], landfallDate: '', low: null }
  }
  const low = clamp(0.78 - 0.27 * r ** 1.1, 0.25, 0.75)
  const afterVals = Array.from({ length: 5 }, (_, i) => rnd(low + 0.028 * i, 2))
  const after = [null, null, null, null, null, ...afterVals]
  return { dates, before, after, landfallDate: dates[4], low: rnd(low, 2) }
}

function distribute(total, weights, digits = 1) {
  const s = weights.reduce((a, b) => a + b, 0) || 1
  return weights.map((w) => rnd((total * w) / s, digits))
}

/** 根据台风属性与轨迹生成一份完整的灾害评估结果 */
export function assessDamage(typhoon, track) {
  const points = Array.isArray(track) ? track : []
  const wind = Number(typhoon.wind) || 0
  const r = clamp(wind / REF_WIND, 0.05, 1.7)
  const { p, dmin } = proximity(points, typhoon.landfall || '')
  const lf = landfallPoint(points) || { lon: REF_LANDFALL[0], lat: REF_LANDFALL[1], t: '' }
  const anchor = impactAnchor(points, typhoon.landfall || '')

  const inundation = rnd(312.8 * r ** 2.2 * p, 1)
  const vegetation = rnd(1862.4 * r ** 1.8 * p, 1)
  const economic = rnd(285.6 * r ** 2.6 * p, 1)
  const population = rnd(283.6 * r ** 1.6 * p, 1)

  const destroyed = Math.round(rnd(5860 * r ** 2.8 * p, 1))
  const major = Math.round(rnd(21300 * r ** 2.4 * p, 1))
  const minor = Math.round(rnd(92400 * r ** 1.8 * p, 1))
  const none = Math.max(0, TOTAL_BUILDINGS - destroyed - major - minor)

  const power = rnd(clamp(100 - 86.5 * r ** 2 * p, 3, 100), 1)
  const road = rnd(clamp(100 - 32 * r ** 1.5 * p, 20, 100), 1)
  const ndviRecover = rnd(clamp(100 - 58 * r ** 1.5 * p, 10, 100), 1)

  const wIn = []
  const wBd = []
  const wVeg = []
  // 市县分摊：基准份额（开 0.6 次方削弱文昌的先天权重）× 到影响锚点的距离衰减，
  // 使登陆点所在市县的灾情最重，同时保留周边市县梯度。
  for (const c of CITY_BASE) {
    const decay = Math.exp(-distKm(anchor.lon, anchor.lat, c.lon, c.lat) / 45)
    wIn.push(c.inundation ** 0.6 * decay)
    wBd.push(c.buildings ** 0.6 * decay)
    wVeg.push(c.vegetation ** 0.6 * decay)
  }

  const damagedTotal = minor + major + destroyed
  const ins = distribute(inundation, wIn, 1)
  const bld = distribute(damagedTotal, wBd, 0)
  const veg = distribute(vegetation, wVeg, 1)
  const cities = CITY_BASE.map((c, i) => ({
    city: c.city,
    lon: c.lon,
    lat: c.lat,
    inundation: ins[i],
    buildings: Math.round(bld[i]),
    vegetation: veg[i],
  })).sort((a, b) => b.inundation - a.inundation)

  const polygons = []
  if (anchor.inside && p >= 0.25) {
    const k = 0.6 + 0.45 * r
    for (const ring of POLY_TEMPLATE) {
      polygons.push(ring.map(([x, y]) => [
        rnd(anchor.lon + (x - REF_LANDFALL[0]) * k, 3),
        rnd(anchor.lat + (y - REF_LANDFALL[1]) * k, 3),
      ]))
    }
  }

  const active = Boolean(typhoon.active)
  const landfallText = String(typhoon.landfall || '')
  const landed = landedAlready(points, landfallText)
  const year = Number(String(typhoon.date || '').slice(0, 4)) || 2026
  const t = String(lf.t || '')
  const ndvi = ndviSeries(r, t.length >= 5 ? t.slice(0, 5) : '09-06', year, landed)

  let level
  let statusText
  let landfallCityName
  let forecast = null
  let citiesOut = cities
  let polygonsOut = polygons
  let damageInundation = inundation
  let damageVegetation = vegetation
  let damageEconomic = economic
  let damagePopulation = population
  let buildingsOut = { none, minor, major, destroyed }
  let recoveryOut = { power, road, ndvi: ndviRecover }

  if (landed) {
    level = impactLevel(economic)
    statusText = active ? '实时预评估（滚动更新）' : '已完成灾后快速评估'
    landfallCityName = landfallCity(landfallText, anchor)
  } else {
    // 尚未登陆（含海域活动、预报路径）：不给实况灾情数字，避免用推测值假装成观测结果。
    // 模型外推的潜在影响单独放在 forecast 里，仅作风险评估参考。
    forecast = {
      inundationArea: inundation,
      vegetationDamage: vegetation,
      economicLoss: economic,
      affectedPopulation: population,
      damagedBuildings: minor + major + destroyed,
      impactLevel: impactLevel(economic),
    }
    level = forecast.impactLevel
    // 活跃台风用「尚未登陆」，已结束的用「未登陆」，两种都只作风险评估
    statusText = active ? '尚未登陆 · 仅作风险评估' : '未登陆 · 仅作风险评估'
    landfallCityName = ''
    citiesOut = []
    polygonsOut = []
    damageInundation = 0
    damageVegetation = 0
    damageEconomic = 0
    damagePopulation = 0
    buildingsOut = { none: TOTAL_BUILDINGS, minor: 0, major: 0, destroyed: 0 }
    recoveryOut = { power: 100, road: 100, ndvi: 100 }
  }

  return {
    id: String(typhoon.id || ''),
    name: String(typhoon.name || ''),
    grade: String(typhoon.grade || ''),
    wind,
    pressure: typhoon.pressure ?? null,
    date: typhoon.date || '',
    landfall: landfallText || '未登陆',
    landfallCity: landfallCityName,
    active,
    statusText,
    impactLevel: level,
    // landed=false 时前端只展示路径与风险提示，灾情指标一律显示「—」
    landed,
    assessmentOnly: !landed,
    forecast,
    proximityKm: dmin,
    landfallLon: anchor.lon,
    landfallLat: anchor.lat,
    affectedCities: citiesOut.filter((c) => c.inundation > 0).length,
    affectedPopulation: damagePopulation,
    economicLoss: damageEconomic,
    inundationArea: damageInundation,
    vegetationDamage: damageVegetation,
    building: buildingsOut,
    recovery: recoveryOut,
    cities: citiesOut,
    ndvi,
    polygons: polygonsOut,
    // 轨迹随评估一起返回，前端地图据此绘制完整路径、登陆点与风圈
    track: trackPoints(points),
  }
}
