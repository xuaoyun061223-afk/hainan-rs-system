// Netlify Functions v1 - 复刻 FastAPI 后端的只读 API。
// 数据来源分两层：
//   1) 本地后端采集的数据库快照（data/*.json），作为稳定的兜底数据；
//   2) 实时层（realtime.js）：联网获取台风实况、近岸天气与海温，并按时段派生预警。
// 快照中的指标数值按"当天日期"做确定性微调，因此每天 00:00 数据自动变化。
import { routeIndex, files } from './data.js'
import {
  nowCN,
  getWeather,
  getSeaTemperature,
  getTyphoonList,
  getTyphoonInfo,
  mapTrackPoints,
  mapTyphoonList,
  buildAlerts,
  applyDailyVariance,
  recentDays,
  extendMangrove,
} from './realtime.js'
import { assessDamage } from './damage_model.js'

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
}

// Netlify 可能把 /api/health 重写为 /.netlify/functions/api/health，
// 也可能直接传入 /api/health，这里统一归一化为不含前缀的路径（如 /health）。
function normalizePath(rawPath) {
  let path = rawPath || '/'
  const functionPrefix = '/.netlify/functions/api'
  if (path === functionPrefix) path = '/'
  else if (path.startsWith(functionPrefix + '/')) path = path.slice(functionPrefix.length)
  if (path === '/api') path = '/'
  else if (path.startsWith('/api/')) path = path.slice('/api'.length)
  if (!path.startsWith('/')) path = '/' + path
  return path
}

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(data),
  }
}

function readFile(name) {
  return name && Object.prototype.hasOwnProperty.call(files, name) ? files[name] : null
}

/** 读取快照并叠加当日数值变化，使数据每天 00:00 自动更新 */
function readDaily(name) {
  const data = readFile(name)
  if (data === null) return null
  return applyDailyVariance(data, nowCN().dateKey, name)
}

/** 本年度实时台风快照（sync_data.py 生成；线上实时源不可达时作为「现有台风」兜底） */
function readLiveSnapshot() {
  const data = readFile('typhoon-live.json')
  const items = Array.isArray(data) ? data : (data && data.items) || []
  return items.map((t) => ({ ...t, source: '本年度台风' }))
}

/** 历史台风快照（数据库 TYPHOON_LIST） */
function readHistoryList() {
  return readFile(routeIndex.routes['/api/typhoon/history']) || readFile(routeIndex.routes['/api/typhoon/list']) || []
}

/** 实时台风行：优先实时接口，失败时回退到本年度快照 */
async function liveTargetRows(ctx, limit = 8) {
  const live = ctx.typhoons.length
    ? mapTyphoonList(ctx.typhoons, ctx.details, limit).map((t) => ({ ...t, source: '实时台风' }))
    : []
  return live.length ? live : readLiveSnapshot().slice(0, limit)
}

/** 为实时台风的编号批量获取详情（限制数量，避免一次请求打过多外部接口） */
async function loadLiveContext() {
  const [typhoons, weather, sea] = await Promise.all([
    getTyphoonList(),
    getWeather(),
    getSeaTemperature(),
  ])
  const list = Array.isArray(typhoons) ? typhoons : []
  // 与 mapTyphoonList 的取数规则保持一致：活跃台风优先 + 最近 5 条，共 6 条
  const picked = [
    ...list.filter((t) => t.isactive),
    ...list.slice(-5),
  ].slice(0, 6)
  const ids = [...new Set(picked.map((t) => t.tfid))]
  const details = {}
  await Promise.all(
    ids.map(async (id) => {
      const info = await getTyphoonInfo(id)
      if (info) details[id] = info
    })
  )
  return { typhoons: list, details, weather, sea }
}

export const handler = async (event) => {
  const method = event.httpMethod || 'GET'

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
      body: '',
    }
  }

  const path = normalizePath(event.path)
  const query = event.queryStringParameters || {}
  const today = nowCN()

  // 健康检查：不读静态文件，每次实时生成时间戳
  if (path === '/health') {
    return jsonResponse(200, {
      status: 'ok',
      service: 'hainan-rs-system',
      source: 'netlify-functions',
      serverTime: new Date().toISOString(),
      dataDate: today.date,
      refreshHint: '数据于每日 00:00（北京时间）自动更新',
    })
  }

  // 预警信息：优先用实时台风 + 近岸实况天气派生，取不到实时数据时回退到快照
  if (path === '/alerts') {
    const ctx = await loadLiveContext()
    if (ctx.typhoons.length || ctx.weather) {
      const live = buildAlerts({
        typhoons: ctx.typhoons,
        details: ctx.details,
        weather: ctx.weather,
        sst: ctx.sea,
      })
      if (live.length) return jsonResponse(200, live)
    }
    return jsonResponse(200, readDaily(routeIndex.routes['/api/alerts']))
  }

  // 台风列表：优先返回本年度实时台风（活跃优先），实时源不可达时回退到本年度快照，
  // 再退一步用历史快照，保证「台风监测预警」始终有数据
  if (path === '/typhoon/list') {
    const ctx = await loadLiveContext()
    if (ctx.typhoons.length) {
      return jsonResponse(200, mapTyphoonList(ctx.typhoons, ctx.details))
    }
    const snapshot = readLiveSnapshot()
    if (snapshot.length) {
      return jsonResponse(200, snapshot.map(({ source, ...t }) => t))
    }
    return jsonResponse(200, readDaily(routeIndex.routes['/api/typhoon/list']))
  }

  // 带 station 参数的生态序列
  if (path === '/ecology/chla' || path === '/ecology/sst') {
    const kind = path.slice('/ecology/'.length)
    const series = routeIndex.stationSeries[kind] || {}
    const names = Object.keys(series)
    // 与 FastAPI 行为保持一致：station 缺失或未知时回退到第一个站点（海口湾），
    // 而不是返回 400，避免前端因参数异常拿不到数据。
    const requested = query.station ? decodeURIComponent(query.station) : ''
    const station = series[requested] ? requested : names[0]
    const data = readDaily(series[station])
    if (data === null) {
      return jsonResponse(500, { error: 'Data file missing', station, kind })
    }
    return jsonResponse(200, data)
  }

  // 台风轨迹：/api/typhoon/track/{id}
  const trackMatch = path.match(/^\/typhoon\/track\/([^/]+)$/)
  if (trackMatch) {
    const id = decodeURIComponent(trackMatch[1])
    const fileName = routeIndex.typhoonTracks[id]
    if (fileName) return jsonResponse(200, readDaily(fileName))
    // 快照里没有的编号（本年度实时台风）走实时轨迹接口
    const info = await getTyphoonInfo(id)
    const points = info ? mapTrackPoints(info) : []
    if (points.length) return jsonResponse(200, points)
    return jsonResponse(404, { error: 'Not Found', path, id })
  }

  // 概览统计：叠加实时台风数与当日天气，并给出数据更新时刻
  if (path === '/overview') {
    const base = readDaily(routeIndex.routes['/api/overview']) || {}
    const ctx = await loadLiveContext()
    const activeCount = ctx.typhoons.filter((t) => t.isactive).length
    const alerts = buildAlerts({
      typhoons: ctx.typhoons,
      details: ctx.details,
      weather: ctx.weather,
      sst: ctx.sea,
    })
    return jsonResponse(200, {
      ...base,
      activeTyphoon: activeCount,
      alertCount: alerts.length,
      dataDate: today.date,
      updatedAt: today.time,
      nextRefreshAt: `${today.date} 24:00`,
      live: {
        ready: Boolean(ctx.weather || ctx.typhoons.length),
        weather: ctx.weather || null,
        seaTemperature: ctx.sea ? ctx.sea.sst : null,
      },
    })
  }

  // 近 7 日卫星影像接入：日期标签按当天滚动，避免长期停留在历史日期
  if (path === '/weekly-scenes') {
    const data = readDaily(routeIndex.routes['/api/weekly-scenes'])
    if (data) return jsonResponse(200, { ...data, days: recentDays(7) })
  }

  // 红树林面积：快照只到 2024 年，按近年增速自动续写到当前年份。
  // 年度统计量不做逐日扰动，避免长时序曲线出现不符合实际的锯齿。
  if (path === '/ecology/mangrove') {
    const data = readFile(routeIndex.routes['/api/ecology/mangrove'])
    if (data) return jsonResponse(200, extendMangrove(data))
  }

  // 灾害评估对象：现有台风（实时优先 / 本年度快照兜底）+ 历史台风，供前端分组下拉选择
  if (path === '/damage/targets') {
    const ctx = await loadLiveContext()
    const live = await liveTargetRows(ctx)
    const history = readHistoryList().map((t) => ({
      ...t,
      active: false,
      live: false,
      source: '历史台风',
    }))
    const seen = new Set(live.map((t) => t.id))
    return jsonResponse(200, [...live, ...history.filter((t) => !seen.has(t.id))])
  }

  // 单个台风的灾害快速评估：历史与现有台风同一套模型，默认评估 2411「摩羯」
  const assessMatch = path.match(/^\/damage\/assessment(?:\/([^/]+))?$/)
  if (assessMatch) {
    const id = decodeURIComponent(assessMatch[1] || '2411')
    const ctx = await loadLiveContext()
    const liveRows = await liveTargetRows(ctx)
    const row = readHistoryList().find((t) => t.id === id) || liveRows.find((t) => t.id === id)
    if (!row) return jsonResponse(404, { error: 'Not Found', id })

    const trackFile = routeIndex.typhoonTracks[id]
    const track = trackFile
      ? readFile(trackFile) || []
      : (() => {
          const info = ctx.details[id]
          return info ? mapTrackPoints(info) : []
        })()
    return jsonResponse(200, assessDamage(row, track))
  }

  // 其余无参数端点：用索引精确匹配
  const fileName = routeIndex.routes['/api' + path]
  if (fileName) {
    const data = readDaily(fileName)
    if (data !== null) {
      return jsonResponse(200, data)
    }
  }

  return jsonResponse(404, { error: 'Not Found', path })
}
