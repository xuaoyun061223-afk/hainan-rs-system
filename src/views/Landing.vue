<template>
  <div
    class="landing"
    role="button"
    tabindex="0"
    @click="enter"
    @keydown.enter="enter"
  >
    <!-- 真实海面底图 -->
    <img class="sea" src="/landing/sea-bg.jpg" alt="" aria-hidden="true" />
    <div class="shade"></div>

    <!-- 台风卫星近景 -->
    <div class="storm" :style="{ '--storm-size': stormSize }">
      <img class="storm-halo" src="/landing/typhoon-haiyan.jpg" alt="" aria-hidden="true" />
      <img class="storm-img" src="/landing/typhoon-haiyan.jpg" alt="台风卫星近景" />
    </div>

    <div class="frame">
      <header class="head">
        <div class="topbar">
          <span class="org">近海遥感监测 · 台风灾害评估</span>
          <span class="clock">{{ nowText }} CST</span>
        </div>
        <h1 class="title">海南近海生态环境监测</h1>
        <h2 class="subtitle">与台风灾害评估系统</h2>

        <div class="live">
          <div class="live-line">
            <span class="dot" :class="{ active: typhoon && typhoon.active }"></span>
            <span>{{ statusText }}</span>
            <span class="live-time">{{ typhoon && typhoon.time ? typhoon.time : '—' }}</span>
          </div>
          <div class="live-line main">
            <span>{{ typhoon ? typhoon.name : '—' }}</span>
            <span class="sep"></span>
            <span>{{ typhoon ? typhoon.grade : '—' }}</span>
            <span class="sep"></span>
            <span>{{ typhoon && typhoon.wind ? typhoon.wind + ' m/s' : '—' }}</span>
            <span class="sep"></span>
            <span>{{ typhoon && typhoon.pressure ? typhoon.pressure + ' hPa' : '—' }}</span>
          </div>
        </div>
      </header>

      <!-- 透明地图图层 -->
      <div class="map-layer">
        <svg viewBox="0 0 400 291" class="map-svg" aria-label="南海台风位置示意">
          <g class="graticule">
            <line
              v-for="lon in [110, 120, 130, 140, 150]"
              :key="'x' + lon"
              :x1="px(lon)"
              :x2="px(lon)"
              y1="0"
              y2="291"
            />
            <line
              v-for="lat in [10, 20, 30, 40]"
              :key="'y' + lat"
              x1="0"
              x2="400"
              :y1="py(lat)"
              :y2="py(lat)"
            />
          </g>

          <g class="labels">
            <text :x="px(110) + 3" y="287">110°E</text>
            <text :x="px(140) + 3" y="287">140°E</text>
            <text x="3" :y="py(20) - 3">20°N</text>
            <text x="3" :y="py(30) - 3">30°N</text>
          </g>

          <path v-for="(d, i) in coastPaths" :key="i" :d="d" class="coast" />
          <path :d="hainanPath" class="island" />

          <text class="geo" :x="px(108.2)" :y="py(17.2)">HAINAN I.</text>
          <text class="geo" :x="px(121.6)" :y="py(15.2)">LUZON</text>

          <g v-if="dot" :transform="`translate(${dot.x},${dot.y})`" class="fix">
            <circle class="dot-core" r="2.4" />
            <line x1="-8" x2="-4.5" y1="0" y2="0" class="tick" />
            <line x1="4.5" x2="8" y1="0" y2="0" class="tick" />
            <line x1="0" x2="0" y1="-8" y2="-4.5" class="tick" />
            <line x1="0" x2="0" y1="4.5" y2="8" class="tick" />
            <text class="fix-label" x="10" y="-5">{{ coordText }}</text>
            <text v-if="!dot.inside" class="fix-note" x="10" y="6">OUT OF FRAME</text>
          </g>

          <g class="scale">
            <line x1="16" y1="277" x2="49" y2="277" />
            <line x1="16" y1="273" x2="16" y2="281" />
            <line x1="49" y1="273" x2="49" y2="281" />
            <text x="16" y="270">500 km</text>
          </g>
        </svg>
        <div class="map-note">
          {{ dot && !dot.inside ? '台风中心位于视图范围外' : '红点为官方定位（约），非精确 GPS' }}
        </div>
      </div>

      <footer class="foot">
        <span class="credit">Coastline: Natural Earth · Imagery: NASA / VIIRS</span>
        <span class="enter">进入系统 →</span>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchTyphoonList, fetchTyphoonTrack } from '@/api'

const router = useRouter()

const coastline = ref([])
const outline = ref([])
const typhoon = ref(null)
const nowText = ref('')

let clockTimer = null
let dataTimer = null

// 等经纬投影范围：南海至西北太平洋
const MAP = { lon0: 100, lon1: 155, lat0: 0, lat1: 40, w: 400, h: 291 }

function px(lon) {
  return ((lon - MAP.lon0) / (MAP.lon1 - MAP.lon0)) * MAP.w
}
function py(lat) {
  return ((MAP.lat1 - lat) / (MAP.lat1 - MAP.lat0)) * MAP.h
}

const coastPaths = computed(() =>
  coastline.value.map((line) =>
    line
      .map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`)
      .join(' ')
  )
)

const hainanPath = computed(() =>
  outline.value.length
    ? outline.value
        .map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`)
        .join(' ') + 'Z'
    : ''
)

const dot = computed(() => {
  const t = typhoon.value
  if (!t || t.lon == null || t.lat == null) return null
  const x = px(t.lon)
  const y = py(t.lat)
  const inside = t.lon >= MAP.lon0 && t.lon <= MAP.lon1 && t.lat >= MAP.lat0 && t.lat <= MAP.lat1
  return {
    x: Math.min(Math.max(x, 6), MAP.w - 6),
    y: Math.min(Math.max(y, 6), MAP.h - 6),
    inside
  }
})

const coordText = computed(() => {
  const t = typhoon.value
  if (!t || t.lon == null || t.lat == null) return ''
  return `${Math.abs(t.lat).toFixed(1)}°${t.lat >= 0 ? 'N' : 'S'} ${Math.abs(t.lon).toFixed(1)}°${
    t.lon >= 0 ? 'E' : 'W'
  }`
})

const statusText = computed(() => {
  if (!typhoon.value) return '台风定位接入中'
  return typhoon.value.active ? '活跃台风 · 实时定位' : '最近一次台风观测'
})

// 台风越大，云图占画面比例略增
const stormSize = computed(() => {
  const wind = (typhoon.value && typhoon.value.wind) || 45
  const ratio = Math.max(0.44, Math.min(0.52, 0.4 + wind / 400))
  return `min(66vh, ${Math.round(ratio * 100)}vw)`
})

function updateClock() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date())
  nowText.value = parts.replace(/\//g, '-')
}

async function loadTyphoon() {
  try {
    const list = await fetchTyphoonList()
    if (!Array.isArray(list) || !list.length) return
    // 有活跃台风优先；否则取日期最新的一次台风（列表按时间升序）
    const active = list.find((t) => t.active)
    const pick = active || [...list].sort((a, b) => String(a.date).localeCompare(String(b.date))).pop()
    let track = []
    try {
      track = await fetchTyphoonTrack(pick.id)
    } catch (e) {
      track = []
    }
    const observed = (track || []).filter((p) => !p.fc)
    const last = observed[observed.length - 1] || (track || [])[track.length - 1]
    typhoon.value = {
      active: !!pick.active,
      name: pick.name,
      grade: (last && last.grade) || pick.grade,
      wind: last && last.wind ? last.wind : pick.wind,
      pressure: last && last.pressure ? last.pressure : pick.pressure,
      time: last ? last.t : '',
      lon: last ? last.lon : null,
      lat: last ? last.lat : null
    }
  } catch (e) {
    // 接口不可用时保持占位文案，不伪造数据
  }
}

function enter() {
  router.push('/dashboard')
}

onMounted(async () => {
  document.title = '海南近海生态环境监测与台风灾害评估系统'
  updateClock()
  clockTimer = setInterval(updateClock, 1000)

  fetch('/data/landing-coastline.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => {
      coastline.value = Array.isArray(d) ? d : []
    })
    .catch(() => {})
  fetch('/data/hainan-outline.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => {
      outline.value = Array.isArray(d) ? d : []
    })
    .catch(() => {})

  await loadTyphoon()
  dataTimer = setInterval(loadTyphoon, 120000)
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  clearInterval(dataTimer)
})
</script>

<style scoped>
.landing {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: pointer;
  outline: none;
  background: #0b1015;
}

.sea {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 52% 46%;
  filter: grayscale(0.35) brightness(0.46) contrast(1.06);
  opacity: 0.9;
}
.shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    rgba(11, 16, 21, 0.95) 0%,
    rgba(11, 16, 21, 0.78) 32%,
    rgba(11, 16, 21, 0.3) 60%,
    rgba(11, 16, 21, 0.62) 100%
  );
}

/* 台风近景 */
.storm {
  position: absolute;
  right: 4vw;
  top: 50%;
  width: var(--storm-size, min(66vh, 48vw));
  aspect-ratio: 1 / 1;
  transform: translateY(-50%);
  pointer-events: none;
}
.storm-halo {
  position: absolute;
  inset: -14%;
  width: 128%;
  height: 128%;
  object-fit: cover;
  object-position: 51% 49%;
  border-radius: 50%;
  filter: blur(34px) saturate(0.3) brightness(0.6);
  opacity: 0.4;
  -webkit-mask-image: radial-gradient(circle, #000 24%, transparent 72%);
  mask-image: radial-gradient(circle, #000 24%, transparent 72%);
}
.storm-img {
  position: absolute;
  inset: -4%;
  width: 108%;
  height: 108%;
  object-fit: cover;
  object-position: 51% 49%;
  transform-origin: 51% 49%;
  border-radius: 50%;
  filter: grayscale(0.15) saturate(0.6) contrast(1.1) brightness(0.98);
  -webkit-mask-image: radial-gradient(
    circle at 50% 50%,
    #000 32%,
    rgba(0, 0, 0, 0.62) 58%,
    rgba(0, 0, 0, 0.18) 80%,
    transparent 94%
  );
  mask-image: radial-gradient(
    circle at 50% 50%,
    #000 32%,
    rgba(0, 0, 0, 0.62) 58%,
    rgba(0, 0, 0, 0.18) 80%,
    transparent 94%
  );
  animation: spin 420s linear infinite;
  will-change: transform;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.frame {
  position: absolute;
  inset: 0;
  padding: 38px 44px 30px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.topbar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  max-width: 520px;
}
.org {
  font-size: 12px;
  color: var(--text-dim);
  letter-spacing: 0.6px;
}
.clock {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.title {
  margin-top: 16px;
  font-size: clamp(24px, 2.2vw, 34px);
  font-weight: 500;
  letter-spacing: 1px;
  color: var(--text-main);
  line-height: 1.35;
}
.subtitle {
  margin-top: 4px;
  font-size: clamp(16px, 1.35vw, 20px);
  font-weight: 400;
  letter-spacing: 1px;
  color: var(--text-sub);
}

.live {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-sub);
  font-variant-numeric: tabular-nums;
}
.live-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.live-line.main {
  color: var(--text-main);
  font-size: 13px;
}
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-dim);
  flex: none;
}
.dot.active {
  background: #c25a51;
}
.live-time {
  color: var(--text-dim);
}
.sep {
  width: 1px;
  height: 10px;
  background: rgba(255, 255, 255, 0.14);
}

/* 透明地图图层 */
.map-layer {
  margin-top: auto;
  width: clamp(210px, 18vw, 300px);
  opacity: 0.9;
}
.map-svg {
  width: 100%;
  display: block;
  overflow: visible;
}
.graticule line {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 0.5;
  stroke-dasharray: 2 5;
}
.labels text {
  fill: var(--text-dim);
  font-size: 7px;
  letter-spacing: 0.8px;
}
.coast {
  fill: none;
  stroke: rgba(200, 214, 222, 0.42);
  stroke-width: 0.6;
  stroke-linejoin: round;
}
.island {
  fill: rgba(142, 207, 224, 0.08);
  stroke: rgba(160, 205, 220, 0.7);
  stroke-width: 1;
  stroke-linejoin: round;
}
.geo {
  fill: rgba(200, 214, 222, 0.5);
  font-size: 7px;
  letter-spacing: 1px;
}
.fix .dot-core {
  fill: #c9564d;
}
.fix .tick {
  stroke: rgba(201, 86, 77, 0.7);
  stroke-width: 0.7;
}
.fix-label {
  fill: rgba(220, 226, 231, 0.75);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 7px;
}
.fix-note {
  fill: rgba(201, 86, 77, 0.85);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 6px;
  letter-spacing: 0.8px;
}
.scale line {
  stroke: rgba(200, 214, 222, 0.35);
  stroke-width: 0.5;
}
.scale text {
  fill: var(--text-dim);
  font-size: 6px;
}
.map-note {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-dim);
}

.foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 11px;
  color: var(--text-dim);
}
.enter {
  font-size: 13px;
  color: var(--text-main);
  border-bottom: 1px solid rgba(142, 207, 224, 0.5);
  padding-bottom: 2px;
}

@media (max-width: 900px) {
  .storm {
    right: -14vw;
    opacity: 0.8;
  }
  .frame {
    padding: 26px 22px 20px;
  }
  .topbar {
    max-width: 100%;
  }
  .map-layer {
    width: 52vw;
  }
  .foot {
    font-size: 10px;
  }
}
</style>
