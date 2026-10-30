/**
 * 海南岛轮廓
 * 优先读取 public/data/hainan-outline.json（DataV 行政区边界，104 点，贴合真实海岸线），
 * 读取失败时回退到 mock 里的近似多边形，保证地图始终能画出岛形。
 * 返回值统一为 [[经度, 纬度], ...]，与后端 /api/hainan-outline 一致。
 */
import { hainanOutline as fallbackOutline } from '@/mock'

let loading = null

export function loadHainanOutline() {
  if (!loading) {
    loading = fetch('/data/hainan-outline.json')
      .then((r) => (r.ok ? r.json() : fallbackOutline))
      .then((pts) => (Array.isArray(pts) && pts.length > 2 ? pts : fallbackOutline))
      .catch(() => fallbackOutline)
  }
  return loading
}
