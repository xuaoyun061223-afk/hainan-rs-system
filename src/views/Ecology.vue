<template>
  <div class="ecology" v-loading="loading">
    <div class="stat-row">
      <StatCard label="当前叶绿素 a" :value="current?.chla || '-'" unit="mg/m³" icon="Histogram" color="#2ee6a6" :sub="`${appStore.activeStation} · 水质${current?.grade || ''}`" />
      <StatCard label="当前海表温度" :value="current?.sst || '-'" unit="℃" icon="Sunny" color="#ffb02e" :sub="`赤潮风险：${current?.risk || ''}`" />
      <StatCard label="侵蚀型岸段" :value="erodingCount" unit="段" icon="TrendCharts" color="#ff5c5c" sub="共监测 8 个典型岸段" />
      <StatCard label="红树林面积（2024）" :value="56.8" unit="km²" icon="Cpu" color="#2f9bff" sub="2000 年以来净增 14.2 km²" />
    </div>

    <div class="toolbar tech-panel">
      <span class="tb-label">监测站点：</span>
      <el-select v-model="appStore.activeStation" size="small" style="width: 140px">
        <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.name" />
      </el-select>
      <el-radio-group v-model="metric" size="small" class="tb-radio">
        <el-radio-button label="chla">叶绿素 a</el-radio-button>
        <el-radio-button label="spm">悬浮泥沙</el-radio-button>
        <el-radio-button label="sst">海表温度</el-radio-button>
      </el-radio-group>
      <el-tag type="danger" effect="dark" size="small" round class="tb-tag" v-if="current?.risk === '高'">
        赤潮高风险：灾后高温高营养盐，需加密观测
      </el-tag>
    </div>

    <div class="main-row">
      <div class="tech-panel map-panel">
        <div class="panel-title">近岸监测站点分布与风险等级</div>
        <div class="map-container">
          <BaseMap :base-type="appStore.baseMapType" :stations="stations" :legend="mapLegend" />
        </div>
      </div>
      <div class="chart-col">
        <div class="tech-panel chart-panel">
          <div class="panel-title">{{ metricLabel }}月度变化趋势</div>
          <ChartBox :option="trendOption" height="220px" />
        </div>
        <div class="tech-panel chart-panel">
          <div class="panel-title">典型岸段年平均冲淤速率（m/年）</div>
          <ChartBox :option="shorelineOption" height="220px" />
        </div>
      </div>
      <div class="chart-col">
        <div class="tech-panel chart-panel gauge-panel">
          <div class="panel-title">赤潮风险指数（模型综合评估）</div>
          <ChartBox :option="gaugeOption" height="220px" />
        </div>
        <div class="tech-panel chart-panel">
          <div class="panel-title">海南岛红树林面积长时序变化（km²）</div>
          <ChartBox :option="mangroveOption" height="220px" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import BaseMap from '@/components/BaseMap.vue'
import ChartBox from '@/components/ChartBox.vue'
import StatCard from '@/components/StatCard.vue'
import { useAppStore } from '@/stores/app'
import {
  fetchStations, fetchChlaSeries, fetchSstSeries, fetchShorelineChange, fetchMangroveArea
} from '@/api'
import { months as monthLabels } from '@/mock'

const appStore = useAppStore()
const metric = ref('chla')

const loading = ref(true)
const stations = ref([])
const shorelineChange = ref([])
const mangroveArea = ref([])
const chlaData = ref({ months: [], values: [] })
const sstData = ref({ months: [], values: [] })

const metricMeta = {
  chla: { label: '叶绿素 a', unit: 'mg/m³' },
  spm: { label: '悬浮泥沙', unit: 'mg/L' },
  sst: { label: '海表温度', unit: '℃' }
}
const metricLabel = computed(() => metricMeta[metric.value].label)
const current = computed(() => stations.value.find((s) => s.name === appStore.activeStation) || stations.value[0])
const erodingCount = computed(() => shorelineChange.value.filter((s) => s.rate < 0).length)

const mapLegend = [
  { label: '低风险', color: '#2ee6a6' },
  { label: '中风险', color: '#ffb02e' },
  { label: '高风险', color: '#ff5c5c' }
]

const axisStyle = {
  axisLine: { lineStyle: { color: '#2b4a76' } },
  axisLabel: { color: '#8aa6c8', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } }
}

function spmMonthly(base) {
  return monthLabels.map((_, i) => +(base * (0.72 + 0.35 * Math.abs(Math.sin(((i + 1) / 12) * Math.PI)))).toFixed(1))
}

const trendOption = computed(() => {
  let values = []
  if (metric.value === 'chla') values = chlaData.value.values
  else if (metric.value === 'spm') values = spmMonthly(current.value?.spm || 12)
  else values = sstData.value.values
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 20, top: 24, bottom: 26 },
    xAxis: { type: 'category', data: chlaData.value.months.length ? chlaData.value.months : monthLabels, ...axisStyle },
    yAxis: { type: 'value', name: metricMeta[metric.value].unit, nameTextStyle: { color: '#8aa6c8' }, ...axisStyle },
    series: [{
      type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 2.5, color: '#00e5ff' },
      itemStyle: { color: '#00e5ff' },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(0,229,255,0.35)' }, { offset: 1, color: 'rgba(0,229,255,0.02)' }] }
      }
    }]
  }
})

const shorelineOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}：${p[0].value > 0 ? '+' : ''}${p[0].value} m/年` },
  grid: { left: 44, right: 20, top: 18, bottom: 40 },
  xAxis: { type: 'category', data: shorelineChange.value.map((s) => s.segment), ...axisStyle, axisLabel: { color: '#8aa6c8', rotate: 30, fontSize: 10 } },
  yAxis: { type: 'value', ...axisStyle },
  series: [{
    type: 'bar',
    data: shorelineChange.value.map((s) => ({ value: s.rate, itemStyle: { color: s.rate < 0 ? '#ff5c5c' : '#2ee6a6' } })),
    barWidth: 16,
    markLine: { symbol: 'none', lineStyle: { color: '#8aa6c8', type: 'dashed' }, data: [{ yAxis: 0 }] }
  }]
}))

const gaugeOption = computed(() => {
  const riskVal = { 低: 28, 中: 62, 高: 86 }[current.value?.risk] || 28
  return {
    series: [{
      type: 'gauge', min: 0, max: 100, radius: '92%',
      progress: { show: true, width: 12 },
      axisLine: { lineStyle: { width: 12, color: [[0.4, '#2ee6a6'], [0.7, '#ffb02e'], [1, '#ff5c5c']] } },
      axisTick: { show: false },
      splitLine: { length: 10, lineStyle: { color: '#1b3a66' } },
      axisLabel: { color: '#8aa6c8', fontSize: 10, distance: 14 },
      pointer: { width: 4 },
      detail: { valueAnimation: true, formatter: '{value}', color: '#eaf4ff', fontSize: 26, offsetCenter: [0, '38%'] },
      data: [{ value: riskVal }]
    }]
  }
})

const mangroveOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 44, right: 20, top: 20, bottom: 26 },
  xAxis: { type: 'category', data: mangroveArea.value.map((m) => m.year), ...axisStyle },
  yAxis: { type: 'value', min: 38, ...axisStyle },
  series: [{
    type: 'line', data: mangroveArea.value.map((m) => m.area), smooth: true,
    symbol: 'circle', symbolSize: 8, lineStyle: { width: 2.5, color: '#2ee6a6' },
    itemStyle: { color: '#2ee6a6' },
    label: { show: true, color: '#9fc4ef', fontSize: 10 },
    areaStyle: {
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: 'rgba(46,230,166,0.35)' }, { offset: 1, color: 'rgba(46,230,166,0.02)' }] }
    }
  }]
}))

async function loadStationData() {
  try {
    const [c, s] = await Promise.all([
      fetchChlaSeries(appStore.activeStation),
      fetchSstSeries(appStore.activeStation)
    ])
    chlaData.value = c
    sstData.value = s
  } catch (e) {
    console.error('站点数据加载失败', e)
  }
}

watch(() => appStore.activeStation, loadStationData)

onMounted(async () => {
  try {
    const [s, sl, mg] = await Promise.all([
      fetchStations(), fetchShorelineChange(), fetchMangroveArea()
    ])
    stations.value = s
    shorelineChange.value = sl
    mangroveArea.value = mg
    await loadStationData()
  } catch (e) {
    console.error('Ecology 数据加载失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.ecology {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
}
.tb-label { font-size: 13px; color: var(--text-sub); }
.tb-tag { margin-left: auto; }
.main-row {
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 12px;
  height: calc(100vh - 320px);
  min-height: 460px;
}
.map-panel, .chart-panel { display: flex; flex-direction: column; }
.map-container { flex: 1; min-height: 0; }
.chart-col { display: flex; flex-direction: column; gap: 12px; }
.chart-panel { flex: 1; }
</style>
