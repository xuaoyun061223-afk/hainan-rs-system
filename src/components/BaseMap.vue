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
import { hainanOutline } from '@/mock'

const props = defineProps({
  baseType: { type: String, default: 'vector' }, // vector | satellite
  stations: { type: Array, default: () => [] },
  track: { type: Array, default: () => [] },
  inundation: { type: Array, default: () => [] },
  showWindCircle: { type: Boolean, default: false },
  focusTime: { type: String, default: '' },
  legend: { type: Array, default: () => [] }
})

const mapEl = ref(null)
let map = null
let vectorLayer = null
let satelliteLayer = null
const dataLayer = L.layerGroup()

const riskColor = { 低: '#2ee6a6', 中: '#ffb02e', 高: '#ff5c5c' }

function gradeColor(grade) {
  if (grade.includes('超强')) return '#cf1322'
  if (grade.includes('强台风')) return '#ff4d4f'
  if (grade === '台风') return '#ff7a45'
  if (grade.includes('强热带')) return '#ff9c40'
  return '#ffd666'
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

function drawHainan() {
  L.polygon(hainanOutline, {
    color: '#00e5ff',
    weight: 1.6,
    opacity: 0.9,
    fillColor: '#123f73',
    fillOpacity: 0.35
  }).addTo(dataLayer)
}

function drawStations() {
  props.stations.forEach((s) => {
    const color = riskColor[s.risk] || '#2f9bff'
    const icon = L.divIcon({
      className: '',
      html: `<div class="map-pin" style="color:${color};background:${color}"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
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

function drawTrack() {
  if (!props.track.length) return
  const latlngs = props.track.map((p) => [p.lat, p.lon])

  // 分段着色
  for (let i = 0; i < latlngs.length - 1; i++) {
    L.polyline([latlngs[i], latlngs[i + 1]], {
      color: gradeColor(props.track[i + 1].grade),
      weight: 3,
      opacity: 0.9
    }).addTo(dataLayer)
  }

  props.track.forEach((p, idx) => {
    const isLandfall = p.grade.includes('登陆')
    if (isLandfall) {
      const icon = L.divIcon({
        className: '',
        html: '<div class="typhoon-icon"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
      L.marker([p.lat, p.lon], { icon })
        .bindPopup(`<b>登陆点 · 文昌</b><br/>${p.t}<br/>最大风速：${p.wind} m/s｜气压：${p.pressure} hPa`)
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
    const last = props.track[props.track.length - 1]
    L.circleMarker([last.lat, last.lon], {
      radius: 12,
      color: '#00e5ff',
      weight: 2,
      fillColor: '#00e5ff',
      fillOpacity: 0.22
    })
      .bindTooltip(`预警时刻位置 · ${props.focusTime}<br/>${last.t}｜${last.grade}｜${last.wind} m/s`, {
        permanent: false
      })
      .addTo(dataLayer)
  }

  // 登陆点七级风圈
  if (props.showWindCircle) {
    const landfall = props.focusTime
      ? props.track[props.track.length - 1]
      : props.track.find((p) => p.grade.includes('登陆')) || props.track[0]
    L.circle([landfall.lat, landfall.lon], {
      radius: landfall.radius * 1000,
      color: '#ff5c5c',
      weight: 1,
      dashArray: '6 6',
      fillColor: '#ff5c5c',
      fillOpacity: 0.08
    })
      .bindTooltip(`${landfall.radius} km 风圈`, { permanent: false })
      .addTo(dataLayer)
  }
}

function drawInundation() {
  props.inundation.forEach((ring) => {
    L.polygon(ring, {
      color: '#ffb02e',
      weight: 1.4,
      fillColor: '#ffb02e',
      fillOpacity: 0.3
    })
      .bindPopup('Sentinel-1 SAR 提取淹没区')
      .addTo(dataLayer)
  })
}

function redraw() {
  if (!map) return
  dataLayer.clearLayers()
  drawHainan()
  drawStations()
  drawTrack()
  drawInundation()
}

watch(
  () => [props.stations, props.track, props.inundation, props.showWindCircle, props.focusTime],
  redraw,
  { deep: true }
)

// 点击预警时间后，自动把视野调整到该时刻台风与海南岛都能看清的范围
watch(() => props.focusTime, (t) => {
  if (!map) return
  if (t && props.track.length) {
    const bounds = L.latLngBounds(props.track.map((p) => [p.lat, p.lon]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 })
  } else if (!t) {
    map.setView([19.35, 109.85], 8)
  }
})

watch(() => props.baseType, (type) => {
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
    zoom: 8,
    minZoom: 6,
    maxBounds: [[8.0, 100.0], [30.0, 132.0]],
    zoomControl: true,
    attributionControl: false
  })
  buildTileLayers()
  dataLayer.addTo(map)
  redraw()
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
</style>
