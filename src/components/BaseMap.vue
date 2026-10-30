<template>
  <div class="base-map-wrap">
    <div ref="mapEl" class="map-el"></div>
    <div class="map-legend" v-if="legend.length">
      <span v-for="item in legend" :key="item.label" class="legend-item">
        <i :style="{ background: item.color }"></i>{{ item.label }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import { loadHainanOutline } from '@/utils/hainanOutline'

const props = defineProps({
  baseType: { type: String, default: 'vector' }, // vector | satellite
  stations: { type: Array, default: () => [] },
  // 当前选中的监测站点名：变化时把视野放大到该站点（生态监测页用）
  activeStation: { type: String, default: '' },
  track: { type: Array, default: () => [] },
  inundation: { type: Array, default: () => [] },
  // 受灾市县点位（含经度/纬度/淹没面积），用于把「重点市县灾情」落到地图上
  cities: { type: Array, default: () => [] },
  // 登陆点锚点，没有轨迹时也能定位
  focusPoint: { type: Object, default: null },
  landfallCity: { type: String, default: '' },
  showHainanOutline: { type: Boolean, default: true },
  showWindCircle: { type: Boolean, default: false },
  focusTime: { type: String, default: '' },
  legend: { type: Array, default: () => [] }
})

const mapEl = ref(null)
let map = null
let vectorLayer = null
let satelliteLayer = null
let dataLayer = null
// 已经聚焦过的站点名，避免同一站点被反复飞过去
let focusedStation = ''

const riskColor = { 低: '#2ee6a6', 中: '#ffb02e', 高: '#ff5c5c' }
const HAINAN_CENTER = [19.35, 109.85]
const HAINAN_BOUNDS = [[18.1, 108.5], [20.25, 111.2]]
// 视野只纳入距海南这么近的轨迹点：远海轨迹会把画面拉到整个西北太平洋，
// 海南岛缩成一个点，反而看不清灾情
const NEAR_TRACK_KM = 250

/** 点到海南中心的球面距离（km） */
function kmToHainan(lat, lon) {
  const dx = (lon - HAINAN_CENTER[1]) * Math.cos((((lat || 0) + HAINAN_CENTER[0]) / 2) * Math.PI / 180) * 111
  const dy = (lat - HAINAN_CENTER[0]) * 111
  return Math.sqrt(dx * dx + dy * dy)
}

function gradeColor(grade) {
  const g = grade || ''
  if (g.includes('超强')) return '#cf1322'
  if (g.includes('强台风')) return '#ff4d4f'
  if (g === '台风') return '#ff7a45'
  if (g.includes('强热带')) return '#ff9c40'
  return '#ffd666'
}

function inundationColor(v, max) {
  if (!max) return '#ffb02e'
  const k = Math.min(1, v / max)
  if (k >= 0.66) return '#ff5c5c'
  if (k >= 0.33) return '#ff9c40'
  return '#ffb02e'
}

function buildTileLayers() {
  vectorLayer = L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    { subdomains: '1234', maxZoom: 18 }
  )
  satelliteLayer = L.tileLayer(
    'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    { subdomains: '1234', maxZoom: 18 }
  )
  ;(props.baseType === 'satellite' ? satelliteLayer : vectorLayer).addTo(map)
}

// 海南岛轮廓（[经度, 纬度]），由公共 JSON 异步加载，先给空数组，加载完成后重绘
let outlinePts = []

function drawHainan() {
  if (!props.showHainanOutline || outlinePts.length < 3) return
  // 轮廓里是 [经度, 纬度]，Leaflet 需要 [纬度, 经度]，顺序必须转换
  const latlngs = outlinePts
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([lon, lat]) => [lat, lon])
  if (latlngs.length < 3) return
  L.polygon(latlngs, {
    color: '#00e5ff',
    weight: 1.6,
    opacity: 0.9,
    fillColor: '#123f73',
    // 只做很淡的提亮，不能压住底图海岸线与道路，否则整块陆地会糊成一团
    fillOpacity: 0.12,
    interactive: false
  }).addTo(dataLayer)
}

function drawStations() {
  props.stations
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .forEach((s) => {
      const color = riskColor[s.risk] || '#2f9bff'
      const active = props.activeStation && s.name === props.activeStation
      // 选中站点加一圈青色虚线，一眼看出当前在看哪个站
      if (active) {
        L.circleMarker([s.lat, s.lon], {
          radius: 16,
          color: '#00e5ff',
          weight: 2,
          dashArray: '4 4',
          fillColor: '#00e5ff',
          fillOpacity: 0.1
        }).addTo(dataLayer)
      }
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-pin${active ? ' is-active' : ''}" style="color:${color};background:${color}"></div>`,
        iconSize: active ? [18, 18] : [14, 14],
        iconAnchor: active ? [9, 9] : [7, 7]
      })
      L.marker([s.lat, s.lon], { icon })
        .bindPopup(
          `<b>${s.name}监测站</b><br/>叶绿素 a：${s.chla} mg/m³<br/>` +
          `悬浮泥沙：${s.spm} mg/L<br/>海表温度：${s.sst} ℃<br/>` +
          `水质类别：${s.grade} ｜ 赤潮风险：<b style="color:${color}">${s.risk}</b>`
        )
        .addTo(dataLayer)
    })
}

/** 按名称找站点（坐标必须有效，否则 Leaflet 会抛 Invalid LatLng） */
function stationByName(name) {
  if (!name) return null
  return props.stations.find(
    (s) => s.name === name && Number.isFinite(s.lat) && Number.isFinite(s.lon)
  ) || null
}

/** 把视野放大到指定监测站点；站点还没加载时返回 false，交给调用方回退到全球面取景 */
function focusStation(name, { animate = true } = {}) {
  if (!map || !name) return false
  const s = stationByName(name)
  if (!s) return false
  focusedStation = name
  // 10 级约等于「看清海湾及周边海岸线」的尺度
  map.flyTo([s.lat, s.lon], 10, { duration: animate ? 1 : 0, easeLinearity: 0.25 })
  return true
}

function drawCities() {
  // 缺少经纬度的记录直接跳过，避免 Leaflet 抛 Invalid LatLng 导致整页更新中断
  const rows = props.cities.filter((c) => Number.isFinite(c.lon) && Number.isFinite(c.lat))
  if (!rows.length) return
  const max = Math.max(...rows.map((c) => Number(c.inundation) || 0), 1)
  rows.forEach((c) => {
    const area = Number(c.inundation) || 0
    const color = inundationColor(area, max)
    // 圆点大小随淹没面积变化，一眼看出受灾重心落在哪个市县
    const radius = 5 + 9 * Math.min(1, area / max)
    L.circleMarker([c.lat, c.lon], {
      radius,
      color,
      weight: 1.2,
      fillColor: color,
      fillOpacity: 0.45
    })
      .bindTooltip(
        `<b>${c.city}</b><br/>淹没面积：${area} km²<br/>受损建筑：${c.buildings} 栋<br/>` +
        `植被受损：${c.vegetation} km²`,
        { direction: 'top', offset: [0, -4] }
      )
      .bindPopup(
        `<b>${c.city}</b><br/>淹没面积：${area} km²<br/>受损建筑：${c.buildings} 栋<br/>` +
        `植被受损：${c.vegetation} km²`
      )
      .addTo(dataLayer)
  })
  // 名称标注只给淹没面积最大的几个市县，否则 8 个标签在地图上互相压字；
  // 依次上/右/下/左错开，避免东北部几个市县（海口、文昌、琼海、定安）标签重叠
  const labelAnchors = [[-6, 24], [8, 8], [-6, -16], [-48, 8]]
  rows
    .slice()
    .sort((a, b) => (Number(b.inundation) || 0) - (Number(a.inundation) || 0))
    .slice(0, 4)
    .forEach((c, i) => {
      L.marker([c.lat, c.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div class="city-label">${c.city}</div>`,
          iconSize: [0, 0],
          iconAnchor: labelAnchors[i] || [-6, 24]
        })
      }).addTo(dataLayer)
    })
}

function drawInundation() {
  props.inundation.forEach((ring) => {
    // 淹没区多边形同样是 [经度, 纬度]，过滤掉不完整的点再做转换
    const latlngs = ring
      .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map(([lon, lat]) => [lat, lon])
    if (latlngs.length < 3) return
    L.polygon(latlngs, {
      color: '#ffb02e',
      weight: 1.4,
      fillColor: '#ffb02e',
      fillOpacity: 0.3
    })
      .bindPopup('Sentinel-1 SAR 提取淹没区')
      .addTo(dataLayer)
  })
}

function drawFocusPoint() {
  const f = props.focusPoint
  if (!f || f.lon == null || f.lat == null) return
  const icon = L.divIcon({
    className: '',
    html: '<div class="typhoon-icon"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })
  L.marker([f.lat, f.lon], { icon })
    .bindPopup(
      `<b>${props.landfallCity || '影响锚点'}</b><br/>` +
      `经度 ${Number(f.lon).toFixed(2)}°E ｜ 纬度 ${Number(f.lat).toFixed(2)}°N` +
      (f.t ? `<br/>${f.t}` : '')
    )
    .addTo(dataLayer)
}

function drawTrack() {
  // 轨迹点缺经纬度时直接丢弃，避免 Leaflet 抛 Invalid LatLng 中断整页渲染
  const pts = props.track.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (!pts.length) return
  const latlngs = pts.map((p) => [p.lat, p.lon])

  // 分段着色
  for (let i = 0; i < latlngs.length - 1; i++) {
    L.polyline([latlngs[i], latlngs[i + 1]], {
      color: gradeColor(pts[i + 1].grade),
      weight: 3,
      opacity: 0.9
    }).addTo(dataLayer)
  }

  pts.forEach((p, idx) => {
    const isLandfall = (p.grade || '').includes('登陆')
    if (isLandfall) {
      const icon = L.divIcon({
        className: '',
        html: '<div class="typhoon-icon"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
      L.marker([p.lat, p.lon], { icon })
        .bindPopup(
          `<b>登陆点${props.landfallCity ? ' · ' + props.landfallCity : ''}</b><br/>${p.t}<br/>` +
          `最大风速：${p.wind} m/s｜气压：${p.pressure} hPa`
        )
        .addTo(dataLayer)
    } else {
      L.circleMarker([p.lat, p.lon], {
        radius: idx === 0 ? 5 : 4,
        color: '#fff',
        weight: 1,
        fillColor: gradeColor(p.grade),
        fillOpacity: 0.95
      })
        .bindPopup(`${p.t}<br/>${p.grade}<br/>风速：${p.wind} m/s｜气压：${p.pressure} hPa`)
        .addTo(dataLayer)
    }
  })

  // 聚焦某条预警时间时，高亮该时刻台风所在位置
  if (props.focusTime) {
    const last = pts[pts.length - 1]
    L.circleMarker([last.lat, last.lon], {
      radius: 12,
      color: '#00e5ff',
      weight: 2,
      fillColor: '#00e5ff',
      fillOpacity: 0.22
    })
      .bindTooltip(`预警时刻位置 · ${props.focusTime}<br/>${last.t}｜${last.grade}｜${last.wind} m/s`)
      .addTo(dataLayer)
  }

  // 登陆点七级风圈
  if (props.showWindCircle) {
    const landfall = props.focusTime
      ? pts[pts.length - 1]
      : pts.find((p) => (p.grade || '').includes('登陆')) || pts[0]
    if (landfall && landfall.radius) {
      L.circle([landfall.lat, landfall.lon], {
        radius: landfall.radius * 1000,
        color: '#ff5c5c',
        weight: 1,
        dashArray: '6 6',
        fillColor: '#ff5c5c',
        fillOpacity: 0.08
      })
        .bindTooltip(`${landfall.radius} km 风圈`)
        .addTo(dataLayer)
    }
  }
}

function drawAll() {
  if (!map || !dataLayer) return
  dataLayer.clearLayers()
  drawHainan()
  drawStations()
  drawCities()
  drawTrack()
  drawInundation()
  drawFocusPoint()
}

/** 视野始终覆盖整岛 + 受灾市县 + 淹没区 + 靠近海南的那段轨迹，保证「看得全」 */
function fitToData({ animate = false } = {}) {
  if (!map) return
  const pts = []
  const nearPts = []
  props.track.forEach((p) => {
    if (p.lat == null || p.lon == null) return
    const dist = kmToHainan(p.lat, p.lon)
    if (dist <= NEAR_TRACK_KM) nearPts.push([p.lat, p.lon])
  })
  // 台风还在远海（尚无靠近海南的轨迹）：改为纳入整条轨迹，
  // 让「预测路径 + 海南岛」同时入画，而不是只看到一座岛
  if (nearPts.length) {
    pts.push(...nearPts)
  } else {
    props.track.forEach((p) => {
      if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) pts.push([p.lat, p.lon])
    })
  }
  props.inundation.forEach((ring) => {
    if (!Array.isArray(ring)) return
    ring.forEach((pt) => {
      if (!Array.isArray(pt)) return
      const [lon, lat] = pt
      if (Number.isFinite(lon) && Number.isFinite(lat)) pts.push([lat, lon])
    })
  })
  props.cities.forEach((c) => c.lat != null && c.lon != null && pts.push([c.lat, c.lon]))
  // 锚点远离海南时（台风从未逼近）只画点不参与取景，否则画面被拉到整个西北太平洋
  if (props.focusPoint &&
      Number.isFinite(props.focusPoint.lat) && Number.isFinite(props.focusPoint.lon) &&
      kmToHainan(props.focusPoint.lat, props.focusPoint.lon) <= NEAR_TRACK_KM) {
    pts.push([props.focusPoint.lat, props.focusPoint.lon])
  }
  // 始终带上海南岛，避免只看一个市县
  HAINAN_BOUNDS.forEach((b) => pts.push(b))
  if (!pts.length) return
  map.fitBounds(L.latLngBounds(pts), {
    padding: [24, 24],
    maxZoom: 9,
    animate
  })
}

function redraw() {
  drawAll()
  syncView()
}

/**
 * 视图决策：
 * - 有选中站点（生态监测页）→ 放大到该站点；
 * - 否则（灾害评估页）→ 取景覆盖整岛、淹没区、市县与近海南的轨迹段。
 */
function syncView({ animate = false } = {}) {
  if (!map) return
  if (props.activeStation && stationByName(props.activeStation)) {
    if (focusedStation !== props.activeStation) {
      // 站点聚焦一律带动画，从整岛视角平滑飞到目标站点
      focusStation(props.activeStation, { animate: true })
    }
    return
  }
  fitToData({ animate })
}

watch(
  () => [props.stations, props.track, props.inundation, props.cities, props.focusPoint, props.showWindCircle, props.focusTime],
  () => {
    drawAll()
    syncView()
  },
  { deep: true }
)

// 切换监测站点：重画站点高亮，并带动画飞入新站点（生态监测页）
watch(() => props.activeStation, (name) => {
  if (!map) return
  drawAll()
  if (name && stationByName(name)) {
    focusStation(name)
  } else if (!name) {
    focusedStation = ''
    fitToData()
  }
})

// 点击预警时间后，突出该时刻台风与海南岛的范围
watch(() => props.focusTime, (t) => {
  if (!map) return
  const pts = props.track
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .map((p) => [p.lat, p.lon])
  if (t && pts.length) {
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 6 })
  } else if (!t) {
    fitToData()
  }
})

watch(() => props.baseType, (type) => {
  if (!map) return
  if (type === 'satellite') {
    map.removeLayer(vectorLayer)
    satelliteLayer.addTo(map)
  } else {
    map.removeLayer(satelliteLayer)
    vectorLayer.addTo(map)
  }
})

onMounted(() => {
  map = L.map(mapEl.value, {
    center: [19.35, 109.85],
    zoom: 7,
    // 实时台风轨迹常在东经 120° 以外，缩小下限才能一眼看全整条路径
    minZoom: 3,
    maxBounds: [[-10.0, 80.0], [50.0, 190.0]],
    zoomControl: true,
    attributionControl: false
  })
  buildTileLayers()
  dataLayer = L.layerGroup().addTo(map)
  redraw()
  // 真实海岸线轮廓稍后到达，到达后补画；视野仍走 syncView，
  // 否则海岸线一到就会把已聚焦的监测站点重新拉回整岛
  loadHainanOutline().then((pts) => {
    if (!map) return
    outlinePts = pts
    drawAll()
    syncView()
  })
})

onBeforeUnmount(() => {
  map && map.remove()
})
</script>

<style scoped>
.base-map-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-el {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: #06122a;
}
.map-legend {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 500;
  background: rgba(6, 18, 42, 0.82);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 6px 10px;
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--text-sub);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.legend-item i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
:deep(.city-label) {
  color: #eaf4ff;
  font-size: 11px;
  line-height: 16px;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
}
:deep(.typhoon-icon) {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid #ff5c5c;
  background: radial-gradient(circle, rgba(255, 92, 92, 0.55), rgba(255, 92, 92, 0.05));
  box-shadow: 0 0 10px rgba(255, 92, 92, 0.7);
}
:deep(.map-pin) {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
  border: 2px solid rgba(6, 18, 42, 0.9);
  box-sizing: border-box;
}
/* 当前选中站点：放大 + 青色描边，与旁边的虚线光圈呼应 */
:deep(.map-pin.is-active) {
  width: 18px;
  height: 18px;
  border-color: #00e5ff;
  box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.25), 0 0 14px #00e5ff;
}
</style>
