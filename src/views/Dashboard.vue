<template>
  <div class="dashboard" v-loading="loading">
    <!-- 顶部指标 -->
    <div class="stat-row">
      <StatCard label="近岸监测站点" :value="stats.stationCount" unit="个" icon="Location" color="#2f9bff" sub="覆盖环岛 6 个重点海湾" />
      <StatCard label="今日卫星过境" :value="stats.todayPasses" unit="次" icon="Position" color="#00e5ff" sub="光学 3 次 / SAR 1 次" />
      <StatCard label="西北太平洋活跃台风" :value="stats.activeTyphoon" unit="个" icon="Guide" color="#2ee6a6" :sub="stats.activeTyphoon ? `当前 ${stats.activeTyphoon} 个活跃台风` : '当前无活跃台风'" />
      <StatCard label="生效预警信息" :value="stats.alertCount" unit="条" icon="Bell" color="#ff5c5c" :sub="`实时生成 ${stats.alertCount} 条`" />
    </div>

    <!-- 数据时效与实况 -->
    <div class="data-bar">
      <span class="dot"></span>
      <span>数据日期 <b>{{ stats.dataDate || '—' }}</b></span>
      <span class="sep">·</span>
      <span>更新于 {{ stats.updatedAt || '—' }}</span>
      <span class="sep">·</span>
      <span>每日 00:00 自动刷新</span>
      <template v-if="liveWeather">
        <span class="sep">|</span>
        <span>近岸实况：气温 {{ liveWeather.temp }}℃ · 风速 {{ liveWeather.wind }} m/s · 当日降水 {{ liveWeather.precipSum }} mm</span>
        <span v-if="stats.live && stats.live.seaTemperature">· 海表温度 {{ stats.live.seaTemperature.toFixed(1) }}℃</span>
      </template>
    </div>

    <div class="main-row">
      <!-- 左列 -->
      <div class="col col-left">
        <div class="tech-panel flex-panel">
          <div class="panel-title">近岸水质类别占比</div>
          <ChartBox :option="gradePie" height="230px" />
        </div>
        <div class="tech-panel flex-panel">
          <div class="panel-title">近 7 日卫星影像接入（景）</div>
          <ChartBox :option="weeklyBar" height="230px" />
        </div>
      </div>

      <!-- 中部地图 -->
      <div class="col col-map tech-panel">
        <div class="panel-title">
          海南岛近海生态与台风态势一张图
          <span class="map-tip">● 监测站点　▲ 台风路径　点击右侧预警时间定位该时刻台风</span>
        </div>
        <div class="map-container" v-loading="trackLoading">
          <BaseMap
            :base-type="appStore.baseMapType"
            :stations="stations"
            :track="track"
            :focus-time="focusTime"
            :show-wind-circle="true"
            :legend="mapLegend"
          />
          <div v-if="focusLabel" class="map-focus">
            <span class="focus-dot"></span>
            <span class="focus-text">{{ focusLabel }}</span>
            <el-button text size="small" class="focus-clear" @click="clearFocus">清除</el-button>
          </div>
        </div>
      </div>

      <!-- 右列 -->
      <div class="col col-right">
        <div class="tech-panel flex-panel">
          <div class="panel-title">各站叶绿素 a 实时浓度</div>
          <ChartBox :option="chlaRank" height="230px" />
        </div>
        <div class="tech-panel flex-panel alert-panel">
          <div class="panel-title">预警信息</div>
          <div class="alert-list">
            <div
              v-for="(a, i) in alerts"
              :key="i"
              class="alert-item"
              :class="{ active: focusIndex === i }"
              @click="onAlertClick(a, i)"
            >
              <el-tag :type="levelType(a.level)" size="small" effect="dark">{{ a.level }}</el-tag>
              <div class="alert-content">
                <div class="alert-head">{{ a.type }} · {{ a.area }}</div>
                <div class="alert-desc">{{ a.desc }}</div>
              </div>
              <span class="alert-time" :class="{ link: !!a.typhoonId }" :title="a.typhoonId ? '点击查看该时刻台风' : '该预警无关联台风'">
                <span class="at-date">{{ datePart(a.time) }}</span>
                <span class="at-clock">{{ clockPart(a.time) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import BaseMap from '@/components/BaseMap.vue'
import ChartBox from '@/components/ChartBox.vue'
import StatCard from '@/components/StatCard.vue'
import { useAppStore } from '@/stores/app'
import {
  fetchStations, fetchTyphoonTrack, fetchTyphoonList, fetchAlerts, fetchOverviewStats,
  fetchWeeklyScenes, fetchWaterGrade
} from '@/api'

const appStore = useAppStore()

const loading = ref(true)
const stations = ref([])
// 一张图默认不显示往常台风，只有点击预警时间后才加载该时刻的台风轨迹
const track = ref([])
const focusTime = ref('')
const focusLabel = ref('')
const focusIndex = ref(-1)
const trackLoading = ref(false)
const typhoonNames = ref({})
const alerts = ref([])
const stats = ref({ stationCount: 0, todayPasses: 0, activeTyphoon: 0, alertCount: 0 })
const weekly = ref({ days: [], optical: [], sar: [] })
const waterGrade = ref([])

const liveWeather = computed(() => (stats.value.live && stats.value.live.weather) || null)

const mapLegend = [
  { label: '低风险站', color: '#2ee6a6' },
  { label: '中风险站', color: '#ffb02e' },
  { label: '高风险站', color: '#ff5c5c' },
  { label: '台风路径', color: '#cf1322' },
  { label: '风圈', color: '#ff5c5c' }
]

const axisStyle = {
  axisLine: { lineStyle: { color: '#2b4a76' } },
  axisLabel: { color: '#8aa6c8', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } }
}

const gradePie = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
  legend: { bottom: 0, textStyle: { color: '#8aa6c8', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
  color: ['#2ee6a6', '#2f9bff', '#ffb02e', '#ff5c5c'],
  series: [{
    type: 'pie', radius: ['42%', '66%'], center: ['50%', '44%'],
    label: { color: '#d6e8ff', fontSize: 11 },
    data: waterGrade.value
  }]
}))

const weeklyBar = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['光学', 'SAR'], textStyle: { color: '#8aa6c8' }, top: 0, right: 0 },
  grid: { left: 36, right: 12, top: 30, bottom: 26 },
  xAxis: { type: 'category', data: weekly.value.days, ...axisStyle },
  yAxis: { type: 'value', ...axisStyle },
  series: [
    { name: '光学', type: 'bar', stack: 'total', data: weekly.value.optical, itemStyle: { color: '#2f9bff' }, barWidth: 14 },
    { name: 'SAR', type: 'bar', stack: 'total', data: weekly.value.sar, itemStyle: { color: '#00e5ff' } }
  ]
}))

const chlaRank = computed(() => {
  const sorted = [...stations.value].sort((a, b) => b.chla - a.chla)
  return {
    tooltip: { trigger: 'axis', formatter: '{b}<br/>叶绿素 a：{c} mg/m³' },
    grid: { left: 64, right: 30, top: 14, bottom: 24 },
    xAxis: { type: 'value', ...axisStyle },
    yAxis: { type: 'category', data: sorted.map((s) => s.name), ...axisStyle, inverse: true },
    series: [{
      type: 'bar',
      data: sorted.map((s) => ({
        value: s.chla,
        itemStyle: { color: s.risk === '高' ? '#ff5c5c' : s.risk === '中' ? '#ffb02e' : '#2ee6a6' }
      })),
      barWidth: 13,
      label: { show: true, position: 'right', color: '#d6e8ff', fontSize: 11 }
    }]
  }
})

function levelType(level) {
  return { 红色: 'danger', 橙色: 'warning', 黄色: 'warning', 蓝色: 'info' }[level] || 'info'
}

function datePart(t) {
  return (t || '').split(' ')[0] || ''
}

function clockPart(t) {
  return (t || '').split(' ')[1] || ''
}

function clearFocus() {
  track.value = []
  focusTime.value = ''
  focusLabel.value = ''
  focusIndex.value = -1
}

/**
 * 点击预警时间：按该预警时刻截取关联台风的轨迹，在地图上显示"这个时间的台风"。
 * 轨迹点时间格式为 MM-DD HH:MM，补全预警年份后可直接按字符串比较先后；
 * 轨迹点按天采样，因此对预警时刻前后两点做线性插值，得到该时刻的真实位置。
 */
async function onAlertClick(a, i) {
  if (focusIndex.value === i) {
    clearFocus()
    return
  }
  if (!a.typhoonId) {
    clearFocus()
    ElMessage.info(`「${a.type}」属于生态类预警，没有关联的台风轨迹`)
    return
  }

  trackLoading.value = true
  try {
    const full = await fetchTyphoonTrack(a.typhoonId)
    const year = (a.time || '').slice(0, 4) || '2024'
    const pts = full.map((p) => ({ ...p, dt: `${year}-${p.t}` }))
    const before = pts.filter((p) => p.dt <= a.time)
    const after = pts.filter((p) => p.dt > a.time)

    const shown = (before.length ? before : pts.slice(0, 1)).slice()

    // 预警时刻落在两个采样点之间时，插值出该时刻的台风位置
    if (before.length && after.length) {
      const prev = before[before.length - 1]
      const next = after[0]
      const t1 = Date.parse(prev.dt.replace(' ', 'T'))
      const t2 = Date.parse(next.dt.replace(' ', 'T'))
      const tt = Date.parse(a.time.replace(' ', 'T'))
      const k = t2 > t1 ? (tt - t1) / (t2 - t1) : 0
      if (k > 0.001) {
        const lerp = (x, y) => +(x + (y - x) * k).toFixed(2)
        shown.push({
          t: a.time.slice(5),
          dt: a.time,
          lon: lerp(prev.lon, next.lon),
          lat: lerp(prev.lat, next.lat),
          grade: prev.grade,
          wind: Math.round(prev.wind + (next.wind - prev.wind) * k),
          pressure: Math.round(prev.pressure + (next.pressure - prev.pressure) * k),
          radius: Math.round(prev.radius + (next.radius - prev.radius) * k),
          interpolated: true
        })
      }
    }

    track.value = shown
    focusTime.value = a.time
    focusIndex.value = i

    const last = shown[shown.length - 1]
    const name = typhoonNames.value[a.typhoonId] || a.typhoonId
    focusLabel.value = `${a.time} 台风「${name}」${last.grade}｜${last.wind} m/s`
  } catch (e) {
    console.error('台风轨迹加载失败', e)
    ElMessage.error('台风轨迹加载失败，请稍后重试')
    clearFocus()
  } finally {
    trackLoading.value = false
  }
}

onMounted(async () => {
  try {
    const [s, a, o, w, g, list] = await Promise.all([
      fetchStations(),
      fetchAlerts(),
      fetchOverviewStats(),
      fetchWeeklyScenes(),
      fetchWaterGrade(),
      fetchTyphoonList()
    ])
    stations.value = s
    alerts.value = a
    stats.value = o
    weekly.value = w
    waterGrade.value = g
    typhoonNames.value = Object.fromEntries(list.map((t) => [t.id, t.name]))
  } catch (e) {
    console.error('Dashboard 数据加载失败，使用降级数据', e)
    const mock = await import('@/mock')
    stations.value = mock.stations
    alerts.value = mock.alerts
    stats.value = mock.overviewStats
    weekly.value = mock.weeklyScenes
    waterGrade.value = mock.waterGradeDist
    typhoonNames.value = Object.fromEntries(mock.typhoonList.map((t) => [t.id, t.name]))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 88px);
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.data-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 4px;
  background: rgba(0, 229, 255, 0.06);
  border: 1px solid rgba(0, 229, 255, 0.22);
  font-size: 11px;
  color: #9db6d4;
  line-height: 1.5;
}
.data-bar b { color: #00e5ff; font-weight: 600; }
.data-bar .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2ee6a6;
  box-shadow: 0 0 6px #2ee6a6;
  flex: none;
}
.data-bar .sep { color: #3d5a7a; }
.main-row {
  flex: 1;
  display: grid;
  grid-template-columns: 23% 1fr 24%;
  gap: 12px;
  min-height: 0;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.flex-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.col-map {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
}
.map-container {
  flex: 1;
  min-height: 0;
  position: relative;
}
.map-focus {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100% - 20px);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(6, 18, 42, 0.88);
  border: 1px solid rgba(0, 229, 255, 0.45);
  font-size: 11px;
  color: #d6e8ff;
}
.focus-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00e5ff;
  box-shadow: 0 0 6px #00e5ff;
  flex: none;
}
.focus-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.focus-clear {
  flex: none;
  color: #8aa6c8;
  padding: 0 2px;
}
.map-tip {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-sub);
  letter-spacing: 0;
}
.alert-panel {
  flex: 1.2;
}
.alert-list {
  flex: 1;
  overflow-y: auto;
}
.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px dashed rgba(64, 158, 255, 0.15);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.alert-item:hover {
  background: rgba(64, 158, 255, 0.08);
}
.alert-item.active {
  background: rgba(0, 229, 255, 0.1);
  border-left-color: #00e5ff;
}
.alert-content {
  flex: 1;
  min-width: 0;
}
.alert-head {
  font-size: 13px;
  color: #eaf4ff;
}
.alert-desc {
  font-size: 11px;
  color: var(--text-sub);
  margin-top: 2px;
}
.alert-time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
  line-height: 1.35;
}
.at-date {
  font-size: 10px;
  color: #8aa6c8;
  white-space: nowrap;
}
.at-clock {
  font-size: 11px;
  color: #d6e8ff;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.alert-time.link .at-clock {
  color: #00e5ff;
  text-decoration: underline dotted;
}
.alert-item.active .at-clock {
  color: #00e5ff;
  font-weight: 600;
}
</style>
