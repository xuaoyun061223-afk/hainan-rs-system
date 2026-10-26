<template>
  <div class="dashboard" v-loading="loading">
    <!-- 顶部指标 -->
    <div class="stat-row">
      <StatCard label="近岸监测站点" :value="stats.stationCount" unit="个" icon="Location" color="#2f9bff" sub="覆盖环岛 6 个重点海湾" />
      <StatCard label="今日卫星过境" :value="stats.todayPasses" unit="次" icon="Position" color="#00e5ff" sub="光学 3 次 / SAR 1 次" />
      <StatCard label="西北太平洋活跃台风" :value="stats.activeTyphoon" unit="个" icon="Guide" color="#2ee6a6" sub="当前无活跃台风" />
      <StatCard label="生效预警信息" :value="stats.alertCount" unit="条" icon="Bell" color="#ff5c5c" sub="红色预警 2 条" />
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
          <span class="map-tip">● 监测站点　▲ 台风路径　◎ 登陆点风圈</span>
        </div>
        <div class="map-container">
          <BaseMap
            :base-type="appStore.baseMapType"
            :stations="stations"
            :track="track"
            :show-wind-circle="true"
            :legend="mapLegend"
          />
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
            <div v-for="(a, i) in alerts" :key="i" class="alert-item">
              <el-tag :type="levelType(a.level)" size="small" effect="dark">{{ a.level }}</el-tag>
              <div class="alert-content">
                <div class="alert-head">{{ a.type }} · {{ a.area }}</div>
                <div class="alert-desc">{{ a.desc }}</div>
              </div>
              <span class="alert-time">{{ a.time }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import BaseMap from '@/components/BaseMap.vue'
import ChartBox from '@/components/ChartBox.vue'
import StatCard from '@/components/StatCard.vue'
import { useAppStore } from '@/stores/app'
import {
  fetchStations, fetchTyphoonTrack, fetchAlerts, fetchOverviewStats,
  fetchWeeklyScenes, fetchWaterGrade
} from '@/api'
import { yagiTrack as mockTrack } from '@/mock'

const appStore = useAppStore()

const loading = ref(true)
const stations = ref([])
const track = ref([])
const alerts = ref([])
const stats = ref({ stationCount: 0, todayPasses: 0, activeTyphoon: 0, alertCount: 0 })
const weekly = ref({ days: [], optical: [], sar: [] })
const waterGrade = ref([])

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

onMounted(async () => {
  try {
    const [s, t, a, o, w, g] = await Promise.all([
      fetchStations(),
      fetchTyphoonTrack('2411'),
      fetchAlerts(),
      fetchOverviewStats(),
      fetchWeeklyScenes(),
      fetchWaterGrade()
    ])
    stations.value = s
    track.value = t
    alerts.value = a
    stats.value = o
    weekly.value = w
    waterGrade.value = g
  } catch (e) {
    console.error('Dashboard 数据加载失败，使用降级数据', e)
    stations.value = (await import('@/mock')).stations
    track.value = mockTrack
    alerts.value = (await import('@/mock')).alerts
    stats.value = (await import('@/mock')).overviewStats
    weekly.value = (await import('@/mock')).weeklyScenes
    waterGrade.value = (await import('@/mock')).waterGradeDist
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
}
.alert-content {
  flex: 1;
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
  font-size: 10px;
  color: #4d678a;
  white-space: nowrap;
}
</style>
