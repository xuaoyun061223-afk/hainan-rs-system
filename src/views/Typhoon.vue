<template>
  <div class="typhoon">
    <div class="main-row">
      <!-- 台风列表 -->
      <div class="tech-panel list-panel">
        <div class="panel-title">影响海南历史台风</div>
        <el-table
          :data="list"
          size="small"
          highlight-current-row
          height="100%"
          :row-class-name="rowClass"
          @row-click="onSelect"
        >
          <el-table-column prop="id" label="编号" width="64" />
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column label="强度" width="92">
            <template #default="{ row }">
              <el-tag :type="gradeTag(row.grade)" size="small" effect="dark">{{ row.grade }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="date" label="日期" width="104" />
        </el-table>
      </div>

      <!-- Cesium 三维路径地图 -->
      <div class="tech-panel map-panel">
        <div class="panel-title">
          {{ active.name }} 三维路径与风圈
          <span class="map-tip">Cesium 三维地球 · 路径分段着色 · 登陆点风圈</span>
        </div>
        <div class="map-container">
          <CesiumGlobe :track="track" :show-wind-circle="true" />
        </div>
      </div>

      <!-- 台风详情 -->
      <div class="detail-col">
        <div class="tech-panel detail-panel">
          <div class="panel-title">台风详情</div>
          <div class="detail-head">
            <div class="detail-name">{{ active.name }}</div>
            <el-tag :type="gradeTag(active.grade)" effect="dark" size="large">{{ active.grade }}</el-tag>
          </div>
          <el-descriptions :column="1" size="small" border class="detail-desc">
            <el-descriptions-item label="国际编号">{{ active.id }}</el-descriptions-item>
            <el-descriptions-item label="登陆时间">{{ active.date }}</el-descriptions-item>
            <el-descriptions-item label="登陆地点">{{ active.landfall }}</el-descriptions-item>
            <el-descriptions-item label="最大风速">{{ active.wind }} m/s（{{ windLevel(active.wind) }}）</el-descriptions-item>
            <el-descriptions-item label="中心气压">{{ active.pressure }} hPa</el-descriptions-item>
          </el-descriptions>
          <div class="landfall-box">
            <div class="landfall-title">登陆点关键参数</div>
            <div class="landfall-grid">
              <div><span>风圈半径</span><b>{{ landfall.radius }} km</b></div>
              <div><span>登陆风速</span><b>{{ landfall.wind }} m/s</b></div>
              <div><span>登陆气压</span><b>{{ landfall.pressure }} hPa</b></div>
              <div><span>风险等级</span><b class="danger">特别重大</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 强度时序 -->
    <div class="bottom-row">
      <div class="tech-panel chart-panel">
        <div class="panel-title">路径过程风速 / 气压变化</div>
        <ChartBox :option="intensityOption" height="240px" />
      </div>
      <div class="tech-panel chart-panel">
        <div class="panel-title">大风风圈半径演变（km）</div>
        <ChartBox :option="radiusOption" height="240px" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import CesiumGlobe from '@/components/CesiumGlobe.vue'
import ChartBox from '@/components/ChartBox.vue'
import { useAppStore } from '@/stores/app'
import { fetchTyphoonList, fetchTyphoonTrack } from '@/api'

const appStore = useAppStore()

const list = ref([])
const track = ref([])

const active = computed(
  () => list.value.find((t) => t.id === appStore.activeTyphoonId) || list.value[0] || {}
)
const landfall = computed(() => track.value.find((p) => (p.grade || '').includes('登陆')) || track.value[0] || {})

async function load(id) {
  track.value = await fetchTyphoonTrack(id)
}

function onSelect(row) {
  appStore.setActiveTyphoon(row.id)
  load(row.id)
}

function rowClass({ row }) {
  return row.id === appStore.activeTyphoonId ? 'current-row' : ''
}

function gradeTag(grade) {
  const g = grade || ''
  if (g.includes('超强')) return 'danger'
  if (g.includes('强台风')) return 'danger'
  if (g.includes('台风')) return 'warning'
  return 'info'
}

function windLevel(v) {
  if (v >= 51) return '16 级+'
  if (v >= 41.5) return '14–15 级'
  if (v >= 32.7) return '12–13 级'
  return '10–11 级'
}

const axisStyle = {
  axisLine: { lineStyle: { color: '#2b4a76' } },
  axisLabel: { color: '#8aa6c8', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } }
}

const intensityOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['最大风速', '中心气压'], textStyle: { color: '#8aa6c8' }, top: 0, right: 0 },
  grid: { left: 50, right: 56, top: 34, bottom: 46 },
  xAxis: {
    type: 'category',
    data: track.value.map((p) => p.t.replace(' 登陆', '')),
    ...axisStyle,
    axisLabel: { color: '#8aa6c8', rotate: 22, fontSize: 10 }
  },
  yAxis: [
    { type: 'value', name: 'm/s', nameTextStyle: { color: '#8aa6c8' }, ...axisStyle },
    { type: 'value', name: 'hPa', min: 900, max: 1000, nameTextStyle: { color: '#8aa6c8' }, ...axisStyle, splitLine: { show: false } }
  ],
  series: [
    {
      name: '最大风速', type: 'bar', data: track.value.map((p) => p.wind), barWidth: 16,
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#ff7a45' }, { offset: 1, color: 'rgba(255,122,69,0.2)' }] }
      }
    },
    {
      name: '中心气压', type: 'line', yAxisIndex: 1, smooth: true,
      symbol: 'circle', symbolSize: 7, data: track.value.map((p) => p.pressure),
      lineStyle: { width: 2.5, color: '#00e5ff' }, itemStyle: { color: '#00e5ff' }
    }
  ]
}))

const radiusOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 50, right: 24, top: 22, bottom: 46 },
  xAxis: {
    type: 'category',
    data: track.value.map((p) => p.t.replace(' 登陆', '')),
    ...axisStyle,
    axisLabel: { color: '#8aa6c8', rotate: 22, fontSize: 10 }
  },
  yAxis: { type: 'value', ...axisStyle },
  series: [
    {
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
      data: track.value.map((p) => p.radius),
      lineStyle: { width: 2.5, color: '#ff5c5c' }, itemStyle: { color: '#ff5c5c' },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(255,92,92,0.35)' }, { offset: 1, color: 'rgba(255,92,92,0.02)' }] }
      },
      markPoint: { data: [{ type: 'max', name: '最大' }], label: { color: '#fff', fontSize: 10 } }
    }
  ]
}))

onMounted(async () => {
  list.value = await fetchTyphoonList()
  load(appStore.activeTyphoonId)
})
</script>

<style scoped>
.typhoon { display: flex; flex-direction: column; gap: 12px; }
.main-row {
  display: grid;
  grid-template-columns: 26% minmax(0, 1fr) 25%;
  gap: 12px;
  height: calc(100vh - 380px);
  min-height: 420px;
}
/* 网格项必须允许收缩到内容最小尺寸以下，否则 Cesium canvas 的固有
   分辨率会经 min-content 反向把整行撑高，形成尺寸反馈循环 */
.list-panel,
.map-panel,
.detail-col,
.detail-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.list-panel, .map-panel, .detail-panel { display: flex; flex-direction: column; }
.map-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.map-tip {
  margin-left: auto; font-size: 11px; font-weight: 400;
  color: var(--text-sub); letter-spacing: 0;
}
.detail-col { min-height: 0; }
.detail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.detail-name { font-size: 17px; font-weight: 700; color: #eaf4ff; }
:deep(.detail-desc .el-descriptions__label) { width: 92px; color: var(--text-sub); }
:deep(.detail-desc .el-descriptions__body .el-descriptions__table) { color: var(--text-main); }
.landfall-box {
  margin-top: 14px;
  border: 1px solid rgba(255, 92, 92, 0.3);
  border-radius: 6px;
  padding: 10px 12px;
  background: rgba(255, 92, 92, 0.06);
}
.landfall-title { font-size: 13px; color: #ff9c9c; margin-bottom: 8px; }
.landfall-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.landfall-grid div { display: flex; justify-content: space-between; font-size: 12px; }
.landfall-grid span { color: var(--text-sub); }
.landfall-grid b { color: #eaf4ff; }
.landfall-grid .danger { color: var(--danger); }
.bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.chart-panel { padding: 12px 14px; }
:deep(.current-row) { background: rgba(47, 155, 255, 0.15) !important; cursor: pointer; }
:deep(.el-table__row) { cursor: pointer; }
</style>
