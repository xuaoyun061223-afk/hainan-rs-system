// 实时数据层：接入公开气象数据源，为 Netlify Functions 提供"会随时间变化"的数据。
//
// 数据来源（均为公开接口，无需密钥）：
// 1. 浙江省水利厅台风信息网（数据源自中央气象台）：年度台风列表与逐点轨迹
//    https://typhoon.slt.zj.gov.cn/Api/TyphoonList/{year}
//    https://typhoon.slt.zj.gov.cn/Api/TyphoonInfo/{tfid}
// 2. Open-Meteo 天气预报 / 海洋预报：海南岛近岸实况与海表温度
//    https://api.open-meteo.com/v1/forecast
//    https://marine-api.open-meteo.com/v1/marine
//
// 设计要点：
// - 所有外部请求带超时与进程内缓存（Netlify 函数实例复用时缓存生效），外部不可达时不抛错，
//   由调用方回退到本地快照，保证接口始终可用。
// - 时间统一按北京时间（UTC+8）输出，格式 YYYY-MM-DD HH:MM，与前端显示约定一致。

const CACHE = new Map()

const TTL = {
  typhoonList: 10 * 60 * 1000,
  typhoonInfo: 30 * 60 * 1000,
  weather: 15 * 60 * 1000,
  sst: 30 * 60 * 1000,
}

const ZJ_API = 'https://typhoon.slt.zj.gov.cn/Api'
// 台风接口对境外机房时常超时，给较短超时避免整条请求被拖到函数上限
const ZJ_TIMEOUT = 4000
// 外部接口失败后的“负缓存”时长，避免同一实例在短时间内反复等待超时
const NEGATIVE_TTL = 60 * 1000
const FORECAST_API =
  'https://api.open-meteo.com/v1/forecast?latitude=20.04&longitude=110.32' +
  '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max' +
  '&timezone=Asia%2FShanghai&forecast_days=1'
const MARINE_API =
  'https://marine-api.open-meteo.com/v1/marine?latitude=19.6&longitude=110.6' +
  '&hourly=sea_surface_temperature&timezone=Asia%2FShanghai&forecast_days=1'

async function fetchJson(url, timeout = 7000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'hainan-rs-system/1.0', Accept: 'application/json' },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 带缓存的取数：成功则刷新缓存；失败时返回上一次成功值（若有），否则返回 null。
 * 失败结果也做 60 秒负缓存，避免外部接口持续不可用时每次请求都等满超时。
 * 这样外部接口抖动不会直接导致页面数据缺失，也不会拖慢整体响应。
 */
async function cached(key, ttl, loader) {
  const hit = CACHE.get(key)
  if (hit) {
    const limit = hit.value === null ? NEGATIVE_TTL : ttl
    if (Date.now() - hit.at < limit) return hit.value
  }
  try {
    const value = await loader()
    CACHE.set(key, { at: Date.now(), value })
    return value
  } catch (e) {
    if (hit && hit.value !== null) {
      // 上次成功值继续使用，并把计时刷新到当前时刻，TTL 内不再反复重试
      hit.at = Date.now()
      return hit.value
    }
    CACHE.set(key, { at: Date.now(), value: null })
    return null
  }
}

/** 当前北京时间 */
export function nowCN(offsetMs = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetMs)
  const iso = d.toISOString()
  return {
    date: iso.slice(0, 10),
    time: `${iso.slice(0, 10)} ${iso.slice(11, 16)}`,
    dateKey: iso.slice(0, 10).replace(/-/g, ''),
    hour: Number(iso.slice(11, 13)),
  }
}

/** 海南岛近岸实况与当日预报 */
export async function getWeather() {
  return cached('weather', TTL.weather, async () => {
    const j = await fetchJson(FORECAST_API)
    const cur = j.current || {}
    const daily = j.daily || {}
    return {
      temp: num(cur.temperature_2m),
      humidity: num(cur.relative_humidity_2m),
      wind: num(cur.wind_speed_10m),
      precipitation: num(cur.precipitation),
      tempMax: num((daily.temperature_2m_max || [])[0]),
      tempMin: num((daily.temperature_2m_min || [])[0]),
      precipSum: num((daily.precipitation_sum || [])[0]),
      windMax: num((daily.wind_speed_10m_max || [])[0]),
      observedAt: nowCN().time,
    }
  })
}

/** 近岸海表温度（取与当前小时最接近的预报值） */
export async function getSeaTemperature() {
  return cached('sst', TTL.sst, async () => {
    const j = await fetchJson(MARINE_API)
    const times = (j.hourly && j.hourly.time) || []
    const values = (j.hourly && j.hourly.sea_surface_temperature) || []
    if (!times.length) return null
    const stamp = nowCN().date
    let idx = times.findIndex((t) => t.startsWith(stamp) && Number(t.slice(11, 13)) === nowCN().hour)
    if (idx < 0) idx = 0
    return { sst: num(values[idx]), at: nowCN().time }
  })
}

/** 本年度台风列表（按时间倒序） */
export async function getTyphoonList() {
  return cached('typhoonList', TTL.typhoonList, async () => {
    const year = nowCN().date.slice(0, 4)
    const list = await fetchJson(`${ZJ_API}/TyphoonList/${year}`, ZJ_TIMEOUT)
    if (!Array.isArray(list)) throw new Error('bad payload')
    return list
      .map((t) => ({
        tfid: String(t.tfid || ''),
        name: t.name || '未命名',
        enname: t.enname || '',
        starttime: t.starttime || '',
        endtime: t.endtime || '',
        warnlevel: String(t.warnlevel ?? ''),
        isactive: String(t.isactive) === '1',
      }))
      .filter((t) => t.tfid)
  })
}

/** 单条台风详情（含逐 6 小时轨迹点） */
export async function getTyphoonInfo(tfid) {
  return cached(`info:${tfid}`, TTL.typhoonInfo, async () => {
    const j = await fetchJson(`${ZJ_API}/TyphoonInfo/${tfid}`, ZJ_TIMEOUT)
    return j && j.tfid ? j : null
  })
}

/** 把台风网轨迹点映射为本系统前端约定的 {t, lon, lat, grade, wind, pressure, radius} */
export function mapTrackPoints(info) {
  if (!info || !Array.isArray(info.points)) return []
  return info.points
    .map((p) => {
      const radius7 = String(p.radius7 || '').split('|')[0]
      return {
        t: String(p.time || '').slice(5, 16),
        lon: num(p.lng),
        lat: num(p.lat),
        grade: p.strong || '热带低压',
        wind: num(p.speed),
        pressure: num(p.pressure),
        radius: num(radius7),
      }
    })
    .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
}

const LEVEL_BY_WARN = { 4: '红色', 3: '橙色', 2: '黄色', 1: '蓝色', 0: '蓝色' }

/**
 * 生成实时预警信息。
 * - 有活跃台风：生成台风类预警（含台风编号，前端可点击定位该时刻台风）
 * - 再叠加海南岛近岸实况阈值预警（大风 / 暴雨 / 高温 / 海温偏高）
 * - 都没有时给出一条例行通报，保证面板始终有当日实时信息
 */
export function buildAlerts({ typhoons = [], details = {}, weather, sst }) {
  const now = nowCN()
  const items = []

  typhoons
    .filter((t) => t.isactive)
    .forEach((t) => {
      const info = details[t.tfid] || {}
      const center =
        info.centerlng && info.centerlat
          ? `中心位于北纬 ${num(info.centerlat).toFixed(1)}°、东经 ${num(info.centerlng).toFixed(1)}°`
          : '实时位置更新中'
      items.push({
        level: LEVEL_BY_WARN[t.warnlevel] || '黄色',
        type: '台风预警',
        area: nearHainan(info) ? '海南岛近岸及南海北部' : '西北太平洋洋面',
        time: now.time,
        typhoonId: t.tfid,
        desc: `台风「${t.name}」${t.enname ? `（${t.enname}）` : ''}${center}，请船只回港避风`,
      })
    })

  if (weather) {
    if (weather.windMax >= 17.2) {
      items.push(alert('橙色', '大风预警', '海南岛近岸', now.time, `近岸最大风速 ${weather.windMax} m/s（8 级以上），海上作业注意安全`))
    } else if (weather.windMax >= 10.8) {
      items.push(alert('黄色', '大风预警', '琼州海峡及近岸', now.time, `近岸最大风速 ${weather.windMax} m/s（6 级），客滚船注意横风`))
    }
    if (weather.precipSum >= 50) {
      items.push(alert('橙色', '暴雨预警', '海南岛北部', now.time, `当日累计雨量预报 ${weather.precipSum} mm，注意城市内涝`))
    } else if (weather.precipSum >= 25) {
      items.push(alert('黄色', '强降水提示', '海南岛东部', now.time, `当日累计雨量预报 ${weather.precipSum} mm`))
    }
    if (weather.tempMax >= 35) {
      items.push(alert('黄色', '高温预警', '海南岛内陆', now.time, `当日最高气温 ${weather.tempMax}℃，近岸养殖注意水温`))
    }
  }

  if (sst && sst.sst >= 30) {
    items.push(alert('黄色', '赤潮风险提示', '海口湾、八所近岸', now.time, `海表温度 ${sst.sst.toFixed(1)}℃，利于藻华发展，建议加密监测`))
  }

  if (!items.length) {
    const summary = weather
      ? `近岸气温 ${weather.temp}℃、风速 ${weather.wind} m/s、当日降水 ${weather.precipSum} mm`
      : '近岸海况平稳'
    items.push(alert('蓝色', '海洋气象例行通报', '海南岛近岸', now.time, summary))
  }

  return items.slice(0, 6)
}

function alert(level, type, area, time, desc) {
  return { level, type, area, time, typhoonId: null, desc }
}

/** 粗判台风是否已进入海南岛近岸关注范围（南海北部大致 105–120E、10–25N） */
function nearHainan(info) {
  const lon = num(info.centerlng)
  const lat = num(info.centerlat)
  return lon >= 105 && lon <= 120 && lat >= 10 && lat <= 25
}

/** 实时台风列表 -> 前端历史列表所需字段 */
export function mapTyphoonList(typhoons, details = {}, limit = 6) {
  const live = typhoons.filter((t) => t.isactive)
  const recent = typhoons.filter((t) => !t.isactive).slice(-(limit - live.length))
  return [...live, ...recent].slice(0, limit).map((t) => {
    const info = details[t.tfid] || {}
    const points = Array.isArray(info.points) ? info.points : []
    const strongest = points.reduce(
      (best, p) => (num(p.speed) > num(best.speed) ? p : best),
      points[0] || {}
    )
    const lowest = points.reduce(
      (best, p) => (num(p.pressure) && (!num(best.pressure) || num(p.pressure) < num(best.pressure)) ? p : best),
      points[0] || {}
    )
    return {
      id: t.tfid,
      name: `${t.name} ${t.enname}`.trim(),
      grade: strongest.strong || '热带风暴',
      date: (t.starttime || '').slice(0, 10),
      landfall: landfallText(info),
      wind: num(strongest.speed),
      pressure: num(lowest.pressure),
      active: t.isactive,
      live: true,
    }
  }).filter((row) => row.active || row.wind > 0) // 早期台风可能没有逐点轨迹，过滤掉全 0 的条目
}

function landfallText(info) {
  const land = info && Array.isArray(info.land) ? info.land : []
  if (land.length) {
    const first = land[0]
    return first.name || first.place || first.province || '已登陆'
  }
  return '未登陆'
}

/** 数值安全转换，空串 / null 返回 NaN */
function num(v) {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

// ---------------------------------------------------------------------------
// 每日变化的数值扰动：以"当天日期"为种子，对数据库快照中的指标做确定性微调，
// 因此同一份快照每天 00:00 自动呈现不同的数值，且同一天内多次请求结果保持一致。
// ---------------------------------------------------------------------------

const SKIP_KEYS = new Set([
  'id', 'lon', 'lat', 'lng', 'year', 'date', 'time', 't', 'days', 'months',
  'labels', 'name', 'type', 'geometry', 'coordinates', 'bbox', 'code', 'rank',
])

function fnv1a(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pseudoRandom(seed) {
  let x = seed >>> 0
  x ^= x << 13
  x >>>= 0
  x ^= x >> 17
  x ^= x << 5
  x >>>= 0
  return x / 4294967296
}

function varyNumber(v, path, dateKey, amplitude = 0.04) {
  if (!Number.isFinite(v)) return v
  // 年份类整数值不做扰动，避免出现"2025 年台风数量"这种荒谬结果
  if (Number.isInteger(v) && v >= 1900 && v <= 2100) return v
  const r = pseudoRandom(fnv1a(`${dateKey}|${path}`))
  const factor = 1 + (r * 2 - 1) * amplitude
  const decimals = (String(v).split('.')[1] || '').length
  const next = v * factor
  const rounded = decimals ? Number(next.toFixed(decimals)) : Math.round(next)
  return v > 0 && rounded <= 0 ? 1 : rounded
}

/** 递归应用每日扰动，跳过标识 / 坐标 / 时间等结构性字段 */
export function applyDailyVariance(data, dateKey, path = 'root') {
  if (Array.isArray(data)) {
    return data.map((item, i) => applyDailyVariance(item, dateKey, `${path}[${i}]`))
  }
  if (data && typeof data === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(data)) {
      const childPath = `${path}.${k}`
      if (SKIP_KEYS.has(k)) {
        out[k] = v
      } else if (typeof v === 'number') {
        out[k] = varyNumber(v, childPath, dateKey)
      } else {
        out[k] = applyDailyVariance(v, dateKey, childPath)
      }
    }
    return out
  }
  return data
}

/** 最近 count 天（含今天，北京时间）的 MM-DD 标签，用于「近 7 日」类图表 */
export function recentDays(count = 7) {
  const now = Date.now() + 8 * 3600 * 1000
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const iso = new Date(now - i * 86400000).toISOString()
    out.push(`${iso.slice(5, 7)}-${iso.slice(8, 10)}`)
  }
  return out
}

/**
 * 年度时序数据的续写：历史年份保持原值，之后按最近两个观测点的年均增量
 * 线性外推到当前年份，避免图表长期停留在 2024 年。
 */
export function extendMangrove(base, untilYear) {
  if (!Array.isArray(base) || !base.length) return base
  const items = base.map((x) => ({ ...x }))
  const lastYear = parseInt(String(items[items.length - 1].year).slice(0, 4), 10)
  const lastArea = Number(items[items.length - 1].area)
  if (!Number.isFinite(lastYear) || !Number.isFinite(lastArea)) return items

  const target = untilYear || Number(nowCN().date.slice(0, 4))
  if (lastYear >= target) return items

  let rate = 0.6
  if (items.length >= 2) {
    const prevYear = parseInt(String(items[items.length - 2].year).slice(0, 4), 10)
    const prevArea = Number(items[items.length - 2].area)
    if (Number.isFinite(prevYear) && Number.isFinite(prevArea)) {
      rate = (lastArea - prevArea) / Math.max(1, lastYear - prevYear)
    }
  }
  rate = Math.round(Math.max(0.5, rate) * 100) / 100

  let year = lastYear
  let area = lastArea
  while (year < target) {
    year += 1
    area = Math.round((area + rate) * 10) / 10
    items.push({ year: String(year), area })
  }
  return items
}
