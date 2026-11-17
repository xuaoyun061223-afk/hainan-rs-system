<template>
  <div
    class="landing"
    role="button"
    tabindex="0"
    @click="enter"
    @keydown.enter="enter"
  >
    <!-- 海面与云带氛围层 -->
    <div class="bg-glow"></div>
    <div class="cloud-band band-a"></div>
    <div class="cloud-band band-b"></div>
    <div class="vignette"></div>

    <!-- 台风卫星近景：真实卫星云图，缓慢旋转叠加，形成持续演变的动态感 -->
    <div class="storm" :style="{ '--storm-size': stormSize }">
      <img class="storm-img a" src="/landing/typhoon-haiyan.jpg" alt="台风卫星近景" />
      <img class="storm-img b" src="/landing/typhoon-haiyan.jpg" alt="" aria-hidden="true" />
      <div class="storm-ring"></div>
    </div>
    <div class="storm-note">
      SATELLITE CLOSE-UP · SUPER TYPHOON HAIYAN · SUOMI NPP VIIRS · 2013-11-06
    </div>

    <div class="content">
      <header class="head">
        <div class="eyebrow">HAINAN COASTAL OBSERVATION · TYPHOON WATCH</div>
        <h1 class="title">海南近海生态环境监测</h1>
        <h2 class="subtitle">与台风灾害评估系统</h2>
        <div class="rule"></div>

        <div class="live">
          <span class="live-tag" :class="{ active: typhoon && typhoon.active }">
            {{
              typhoon
                ? typhoon.active
                  ? 'ACTIVE STORM'
                  : 'NO ACTIVE STORM · LAST FIX'
                : 'DATA LINKING'
            }}
          </span>
          <span class="live-name">{{ typhoon ? typhoon.name : '—' }}</span>
          <span class="live-item">{{ typhoon ? typhoon.grade : '—' }}</span>
          <span class="live-item">{{ typhoon && typhoon.wind ? typhoon.wind + ' m/s' : '—' }}</span>
          <span class="live-item">{{ typhoon && typhoon.pressure ? typhoon.pressure + ' hPa' : '—' }}</span>
          <span class="live-item">观测 {{ typhoon && typhoon.time ? typhoon.time : '—' }}</span>
        </div>
      </header>

      <!-- 透明地图图层：仅线条与标注，无边框、无底板，叠在海面之上 -->
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
            <text class="sea" x="96" y="205">SOUTH CHINA SEA</text>
          </g>

          <path v-for="(d, i) in coastPaths" :key="i" :d="d" class="coast" />
          <path :d="hainanPath" class="island" />

          <text class="geo" :x="px(108.2)" :y="py(17.4)">HAINAN I.</text>
          <text class="geo" :x="px(121.4)" :y="py(15.2)">LUZON</text>
          <text class="geo" :x="px(142.4)" :y="py(34.4)">JAPAN</text>

          <!-- 台风定位：官方发布位置（约），红色为唯一高饱和元素 -->
          <g v-if="dot" :transform="`translate(${dot.x},${dot.y})`" class="fix">
            <circle class="pulse" r="7" />
            <circle class="pulse p2" r="7" />
            <circle class="dot" r="2.4" />
            <line x1="-9" x2="-4.5" y1="0" y2="0" class="tick" />
            <line x1="4.5" x2="9" y1="0" y2="0" class="tick" />
            <line x1="0" x2="0" y1="-9" y2="-4.5" class="tick" />
            <line x1="0" x2="0" y1="4.5" y2="9" class="tick" />
            <text class="fix-label" x="11" y="-5">{{ coordText }}</text>
            <text v-if="!dot.inside" class="fix-note" x="11" y="6">OUT OF FRAME</text>
          </g>

          <!-- 比例尺：500 km -->
          <g class="scale">
            <line x1="16" y1="277" x2="49" y2="277" />
            <line x1="16" y1="273" x2="16" y2="281" />
            <line x1="49" y1="273" x2="49" y2="281" />
            <text x="16" y="270">500 km</text>
          </g>
        </svg>

        <div class="map-meta">
          <span v-if="!typhoon">台风定位接入中…</span>
          <span v-else-if="dot && !dot.inside">台风中心位于视图范围外，标记为边缘示意</span>
          <span v-else>红色标记为官方定位（约），非精确 GPS</span>
        </div>
        <div class="map-credit">Coastline: Natural Earth · Imagery: NASA / VIIRS</div>
      </div>
    </div>

    <footer class="foot">
      <div class="clock">{{ nowText }} <span>CST</span></div>
      <div class="enter-hint">点击任意位置进入系统<span class="arrow">→</span></div>
    </footer>
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

// 台风越大，云图占画面比例略增
const stormSize = computed(() => {
  const wind = (typhoon.value && typhoon.value.wind) || 45
  const ratio = Math.max(0.48, Math.min(0.56, 0.44 + wind / 400))
  return `min(76vh, ${Math.round(ratio * 100)}vw)`
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
  background: radial-gradient(120% 90% at 70% 46%, #12314c 0%, #0b2137 40%, #071627 72%, #040c16 100%);
}

.bg-glow {
  position: absolute;
  inset: -10%;
  background:
    radial-gradient(38% 30% at 62% 40%, rgba(96, 170, 190, 0.16), transparent 70%),
    radial-gradient(50% 40% at 84% 70%, rgba(40, 90, 130, 0.22), transparent 72%);
  filter: blur(2px);
  pointer-events: none;
}

.cloud-band {
  position: absolute;
  left: -20%;
  width: 140%;
  height: 26vh;
  background: linear-gradient(90deg, transparent, rgba(168, 204, 218, 0.06), transparent);
  filter: blur(26px);
  pointer-events: none;
}
.band-a {
  top: 8%;
  animation: drift 96s ease-in-out infinite alternate;
}
.band-b {
  bottom: 2%;
  height: 34vh;
  opacity: 0.7;
  animation: drift 132s ease-in-out infinite alternate-reverse;
}
@keyframes drift {
  from {
    transform: translate3d(-4%, 0, 0);
  }
  to {
    transform: translate3d(6%, -3%, 0);
  }
}

.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(118% 88% at 44% 46%, transparent 60%, rgba(2, 8, 16, 0.6) 100%);
}

/* ── 台风近景 ── */
.storm {
  position: absolute;
  right: 2vw;
  top: 50%;
  width: var(--storm-size, min(76vh, 52vw));
  aspect-ratio: 1 / 1;
  transform: translateY(-50%);
  pointer-events: none;
}
.storm::before {
  content: '';
  position: absolute;
  inset: -7%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(112, 172, 196, 0.18), transparent 64%);
  filter: blur(10px);
}
.storm-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 51% 49%;
  transform-origin: 51% 49%;
  border-radius: 50%;
  filter: saturate(0.55) contrast(1.12) brightness(1.04);
  -webkit-mask-image: radial-gradient(
    circle at 50% 50%,
    #000 34%,
    rgba(0, 0, 0, 0.74) 62%,
    rgba(0, 0, 0, 0.26) 82%,
    transparent 96%
  );
  mask-image: radial-gradient(
    circle at 50% 50%,
    #000 34%,
    rgba(0, 0, 0, 0.74) 62%,
    rgba(0, 0, 0, 0.26) 82%,
    transparent 96%
  );
  will-change: transform, opacity;
}
.storm-img.a {
  animation: spin 320s linear infinite;
}
.storm-img.b {
  opacity: 0.34;
  mix-blend-mode: screen;
  animation: spin 460s linear infinite reverse, breathe 26s ease-in-out infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes breathe {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.55;
  }
}
.storm-ring {
  position: absolute;
  inset: 5%;
  border-radius: 50%;
  border: 1px solid rgba(150, 205, 220, 0.1);
  box-shadow: inset 0 0 90px rgba(8, 26, 44, 0.75);
}
.storm-note {
  position: absolute;
  right: 3vw;
  bottom: 8.6vh;
  max-width: 42vw;
  font-size: 9px;
  letter-spacing: 1.1px;
  text-align: right;
  color: rgba(150, 190, 210, 0.38);
  pointer-events: none;
}

/* ── 内容层 ── */
.content {
  position: absolute;
  inset: 0;
  padding: 6vh 5vw 10vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.eyebrow {
  font-size: 10px;
  letter-spacing: 4px;
  color: rgba(150, 190, 210, 0.6);
}
.title {
  margin-top: 14px;
  font-size: clamp(26px, 2.7vw, 42px);
  font-weight: 500;
  letter-spacing: 3px;
  color: #e8f2f7;
}
.subtitle {
  margin-top: 6px;
  font-size: clamp(17px, 1.55vw, 24px);
  font-weight: 300;
  letter-spacing: 4px;
  color: #97b0c1;
}
.rule {
  width: 66px;
  height: 1px;
  margin: 20px 0 14px;
  background: linear-gradient(90deg, #7fd3de, transparent);
}

.live {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  max-width: 34vw;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
  color: #8ba7b8;
}
.live-tag {
  padding: 1px 6px;
  font-size: 9px;
  letter-spacing: 1.2px;
  color: #7e97ad;
  border: 1px solid rgba(126, 151, 173, 0.38);
  border-radius: 2px;
}
.live-tag.active {
  color: #e0796f;
  border-color: rgba(224, 121, 111, 0.55);
}
.live-name {
  color: #c6dae6;
  letter-spacing: 0.5px;
}
.live-item {
  color: #7e97ad;
}

/* ── 透明地图图层 ── */
.map-layer {
  position: relative;
  width: clamp(230px, 20vw, 330px);
  mix-blend-mode: screen;
  opacity: 0.95;
}
.map-svg {
  width: 100%;
  display: block;
  overflow: visible;
}
.graticule line {
  stroke: rgba(140, 180, 205, 0.14);
  stroke-width: 0.5;
  stroke-dasharray: 2 5;
}
.labels text {
  fill: rgba(150, 190, 210, 0.42);
  font-size: 7px;
  letter-spacing: 1px;
}
.labels .sea {
  fill: rgba(120, 170, 190, 0.26);
  font-size: 7.5px;
  letter-spacing: 3.4px;
}
.coast {
  fill: none;
  stroke: rgba(158, 198, 218, 0.44);
  stroke-width: 0.6;
  stroke-linejoin: round;
}
.island {
  fill: rgba(120, 200, 215, 0.14);
  stroke: rgba(160, 232, 240, 0.85);
  stroke-width: 1.1;
  stroke-linejoin: round;
}
.geo {
  fill: rgba(196, 226, 236, 0.55);
  font-size: 7px;
  letter-spacing: 1.3px;
}
.fix .dot {
  fill: #e0554f;
}
.fix .tick {
  stroke: rgba(224, 85, 79, 0.72);
  stroke-width: 0.7;
}
.fix .pulse {
  fill: none;
  stroke: rgba(224, 85, 79, 0.5);
  stroke-width: 0.8;
  transform-box: fill-box;
  transform-origin: center;
  animation: ping 3.4s ease-out infinite;
}
.fix .pulse.p2 {
  animation-delay: 1.7s;
}
@keyframes ping {
  0% {
    transform: scale(0.5);
    opacity: 0.85;
  }
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
}
.fix-label {
  fill: rgba(236, 214, 208, 0.82);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 7px;
  letter-spacing: 0.4px;
}
.fix-note {
  fill: rgba(224, 121, 111, 0.8);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 6px;
  letter-spacing: 1px;
}
.scale line {
  stroke: rgba(150, 190, 210, 0.45);
  stroke-width: 0.5;
}
.scale text {
  fill: rgba(150, 190, 210, 0.5);
  font-size: 6px;
  letter-spacing: 0.6px;
}

.map-meta {
  margin-top: 2px;
  font-size: 9.5px;
  line-height: 1.5;
  color: rgba(140, 172, 190, 0.55);
}
.map-credit {
  margin-top: 6px;
  font-size: 9px;
  letter-spacing: 0.4px;
  color: rgba(120, 150, 168, 0.45);
}

/* ── 页脚 ── */
.foot {
  position: absolute;
  left: 5vw;
  right: 5vw;
  bottom: 3.6vh;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}
.clock {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: 0.6px;
  color: rgba(150, 190, 210, 0.55);
}
.clock span {
  color: rgba(150, 190, 210, 0.35);
}
.enter-hint {
  font-size: 12px;
  letter-spacing: 2px;
  color: #a9c4d4;
  animation: hint 3.2s ease-in-out infinite;
}
.arrow {
  display: inline-block;
  margin-left: 8px;
  color: #7fd3de;
  animation: nudge 1.8s ease-in-out infinite;
}
@keyframes hint {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
@keyframes nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(4px);
  }
}

@media (max-width: 900px) {
  .storm {
    right: -8vw;
    opacity: 0.85;
  }
  .content {
    padding: 5vh 6vw 9vh;
  }
  .live {
    max-width: 62vw;
  }
  .map-layer {
    width: 46vw;
  }
}
</style>
