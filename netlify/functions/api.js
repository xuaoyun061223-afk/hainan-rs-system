// Netlify Functions v1 - 复刻 FastAPI 后端的只读 API。
// 数据来自第 1 步从本地后端采集的真实响应，静态导入后按索引精确查找。
import { routeIndex, files } from './data.js'

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

  // 健康检查：不读静态文件，每次实时生成时间戳
  if (path === '/health') {
    return jsonResponse(200, {
      status: 'ok',
      service: 'hainan-rs-system',
      source: 'netlify-functions',
      serverTime: new Date().toISOString(),
    })
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
    const data = readFile(series[station])
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
    if (!fileName) {
      return jsonResponse(404, { error: 'Not Found', path, id })
    }
    return jsonResponse(200, readFile(fileName))
  }

  // 其余无参数端点：用索引精确匹配
  const fileName = routeIndex.routes['/api' + path]
  if (fileName) {
    const data = readFile(fileName)
    if (data !== null) {
      return jsonResponse(200, data)
    }
  }

  return jsonResponse(404, { error: 'Not Found', path })
}
