// 本地验证 Netlify 函数：直接调用 handler，检查实时数据与每日变化是否生效。
import { handler } from '../netlify/functions/api.js'

const cases = [
  '/api/health',
  '/api/alerts',
  '/api/typhoon/list',
  '/api/typhoon/track/202631',
  '/api/overview',
  '/api/stations',
  '/api/ecology/chla?station=海口湾',
  '/api/damage/summary',
  '/api/satellite/catalog',
  '/api/not-exists',
]

for (const path of cases) {
  const [p, qs] = path.split('?')
  const queryStringParameters = {}
  if (qs) {
    for (const kv of qs.split('&')) {
      const [k, v] = kv.split('=')
      queryStringParameters[k] = v
    }
  }
  const res = await handler({ path: p, httpMethod: 'GET', queryStringParameters, headers: {} }, {})
  let body = ''
  try {
    const json = JSON.parse(res.body)
    if (Array.isArray(json)) {
      body = `array[${json.length}] first=${JSON.stringify(json[0]).slice(0, 110)}`
    } else {
      body = JSON.stringify(json).slice(0, 150)
    }
  } catch {
    body = String(res.body).slice(0, 120)
  }
  console.log(`${res.statusCode} ${path}\n   ${body}`)
}
