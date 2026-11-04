<template>
  <div class="typhoon">
    <div class="main-row">
      <!-- 台风列表 -->
      <div class="tech-panel list-panel">
        <div class="panel-title">实时台风监测</div>
        <el-table
          :data="list"
          size="small"
          highlight-current-row
          height="100%"
          :row-class-name="rowClass"
          @row-click="onSelect"
        >
          <el-table-column prop="id" label="编号" width="66" />
          <el-table-column prop="name" label="名称" min-width="92" />
          <el-table-column label="强度" width="76">
            <template #default="{ row }">
              <el-tag :type="gradeTag(row.grade)" size="small" effect="dark">{{ row.grade }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Cesium 三维路径地图 -->
      <div class="tech-panel map-panel">
        <div class="panel-title">
          {{ active.name }} 三维路径与风圈
          <span class="map-tip">实况实线 · 预报虚线 · 拖动下方进度条回放</span>
        </div>
        <div class="map-container">
          <CesiumGlobe :track="track" :show-wind-circle="true" :sim-index="simIndex" />
        </div>
        <!-- 路径模拟进度条：拖动时按时间顺序回放台风路径 -->
        <div class="sim-bar">
          <div class="sim-head">
            <span class="sim-title">路径模拟</span>
            <span v-if="simPoint.t" class="sim-now">
              <em v-if="simPoint.fc" class="sim-fc">预报</em>{{ simPoint.t }} · {{ simPoint.grade }} ·
              {{ simPoint.wind }} m/s · 风圈 {{ simPoint.radius > 0 ? simPoint.radius + ' km' : '—' }}
            </span>
            <span class="sim-step">
              <span v-if="fcDays" class="sim-fc-range">预报覆盖 {{ fcDays }} 天</span>
              <span class="sim-split">实况 {{ obsCount }} · 预报 {{ fcCount }}</span>
              {{ simIndex + 1 }} / {{ track.length || 0 }}
            </span>
          </div>
          <div class="sim-slider">
            <span class="sim-edge">{{ firstT }}</span>
            <el-slider
              v-model="simIndex"
              :min="0"
              :max="Math.max(0, track.length - 1)"
              :show-tooltip="false"
              :disabled="!track.length"
              :marks="dayMarks"
              class="sim-range"
            />
            <span class="sim-edge">{{ lastT }}</span>
          </div>
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
            <el-descriptions-item label="生成时间">{{ active.date }}</el-descriptions-item>
            <el-descriptions-item label="登陆情况">{{ active.landfall }}</el-descriptions-item>
            <el-descriptions-item label="最大风速">{{ active.wind }} m/s（{{ windLevel(active.wind) }}）</el-descriptions-item>
            <el-descriptions-item label="中心气压">{{ active.pressure }} hPa</el-descriptions-item>
          </el-descriptions>
          <div class="landfall-box">
            <div class="landfall-title">{{ hasLandfall ? '登陆点关键参数' : '最强时段关键参数' }}</div>
            <div class="landfall-grid">
              <div><span>风圈半径</span><b>{{ landfall.radius }} km</b></div>
              <div><span>{{ hasLandfall ? '登陆风速' : '最强风速' }}</span><b>{{ landfall.wind }} m/s</b></div>
              <div><span>{{ hasLandfall ? '登陆气压' : '对应气压' }}</span><b>{{ landfall.pressure }} hPa</b></div>
              <div><span>风险等级</span><b class="danger">{{ riskLevel }}</b></div>
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
// 路径模拟进度（数组下标），加载/切换台风时默认停在最新时次
const simIndex = ref(0)

const simPoint = computed(
  () => track.value[Math.min(simIndex.value, track.value.length - 1)] || {}
)
// 实况 / 预报点数，用于在进度条上说明「往后几日的预报段」
const fcCount = computed(() => track.value.filter((p) => p.fc).length)
const obsCount = computed(() => track.value.length - fcCount.value)
const firstT = computed(() => (track.value[0]?.t || '').replace(' 登陆', '') || '—')
const lastT = computed(
  () => (track.value[track.value.length - 1]?.t || '').replace(' 登陆', '') || '—'
)
// 进度条日期刻度：每天首个时次标注日期，预报段（未来日期）标橙色
// 最后一点已有右侧结束时间标签，跳过避免与它重叠
const dayMarks = computed(() => {
  const marks = {}
  let lastDate = (track.value[0]?.t || '').slice(0, 5)
  const lastIndex = track.value.length - 1
  track.value.forEach((p, i) => {
    const date = (p.t || '').slice(0, 5)
    if (!i || !date || date === lastDate) return
    lastDate = date
    if (i === lastIndex) return
    marks[i] = {
      label: date,
      style: {
        color: p.fc ? '#ffb02e' : '#8fb4d9',
        fontSize: '10px',
        whiteSpace: 'nowrap'
      }
    }
  })
  return marks
})
// 预报覆盖的自然日数，用于说明「往后几日」的预测跨度
const fcDays = computed(
  () => new Set(track.value.filter((p) => p.fc).map((p) => (p.t || '').slice(0, 5))).size
)

const active = computed(
  () => list.value.find((t) => t.id === appStore.activeTyphoonId) || list.value[0] || {}
)
const hasLandfall = computed(() => track.value.some((p) => (p.grade || '').includes('登陆')))
// 已登陆取登陆点；未登陆取最强时段（最大风速）点位，避免用起始弱台风点误导
const landfall = computed(() => {
  if (hasLandfall.value) {
    return track.value.find((p) => (p.grade || '').includes('登陆')) || {}
  }
  return track.value.reduce((best, p) => ((p.wind || 0) > (best.wind || 0) ? p : best), track.value[0] || {})
})
const riskLevel = computed(() => {
  const w = active.value.wind || 0
  if (w >= 51) return '特别重大'
  if (w >= 41.5) return '重大'
  if (w >= 32.7) return '较大'
  return '一般'
})

async function load(id) {
  track.value = await fetchTyphoonTrack(id)
  // 默认停在最新实况时次：地图对准台风当前位置（而不是最远的预报点），
  // 向右拖动进度条即进入后面几日的预报段
  const fc = track.value.filter((p) => p.fc).length
  simIndex.value = Math.max(0, track.value.length - 1 - fc)
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
      // 预报时次没有实测风圈，用 null 断开折线，避免误显示为 0
      data: track.value.map((p) => (p.fc ? null : p.radius)),
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
  if (!list.value.length) return
  // 实时台风编号与历史快照不同，若当前选中编号不在列表中则默认选中第一条，
  // 保证列表始终有明确的高亮行，三维地图也有对应轨迹。
  if (!list.value.some((t) => t.id === appStore.activeTyphoonId)) {
    appStore.setActiveTyphoon(list.value[0].id)
  }
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
/* 路径模拟进度条 */
.sim-bar {
  flex: 0 0 auto;
  /* 底部留白给进度条上的日期刻度文字 */
  padding: 6px 14px 24px;
  border-top: 1px solid rgba(64, 158, 255, 0.18);
  background: rgba(6, 20, 42, 0.55);
}
.sim-head { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.sim-title { color: #00e5ff; font-weight: 600; }
.sim-now { color: #eaf4ff; }
.sim-step { margin-left: auto; color: var(--text-sub); font-variant-numeric: tabular-nums; }
.sim-fc-range { margin-right: 10px; color: #ffb02e; }
.sim-split { margin-right: 10px; color: #8fb4d9; }
.sim-fc {
  margin-right: 6px; padding: 0 4px;
  font-style: normal; font-size: 11px;
  color: #ffb02e; border: 1px solid rgba(255, 176, 46, 0.45);
  border-radius: 3px; background: rgba(255, 176, 46, 0.12);
}
.sim-slider { display: flex; align-items: center; gap: 8px; }
.sim-edge { font-size: 11px; color: var(--text-sub); font-variant-numeric: tabular-nums; }
:deep(.sim-range) { flex: 1; }
:deep(.sim-range .el-slider__runway) { height: 4px; background-color: rgba(64, 158, 255, 0.18); }
:deep(.sim-range .el-slider__bar) {
  height: 4px;
  background: linear-gradient(90deg, #00e5ff, #ff7a45);
}
:deep(.sim-range .el-slider__button) {
  width: 13px; height: 13px;
  border: 2px solid #00e5ff;
  background: #04142b;
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.55);
}
:deep(.sim-range .el-slider__button-wrapper) { top: -15px; }
:deep(.sim-range .el-slider__marks-text) { margin-top: 12px; font-size: 10px; }
:deep(.sim-range.is-disabled .el-slider__button) { border-color: #52708f; box-shadow: none; }
.detail-col { min-height: 0; }
.detail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.detail-name { font-size: 17px; font-weight: 700; color: #eaf4ff; }
/* Element Plus 描述列表默认是浅色主题：.el-descriptions__body 背景是白色
   （--el-fill-color-blank），带边框时标签列又是浅灰底，在深色面板上非常突兀。
   这里改用透明/深蓝底 + 青色描边，让详情表与面板融为一体。 */
:deep(.detail-desc) {
  --el-descriptions-table-border: 1px solid rgba(64, 158, 255, 0.22);
  --el-descriptions-item-bordered-label-background: rgba(0, 229, 255, 0.06);
  --el-text-color-primary: #eaf4ff;
  --el-text-color-regular: #eaf4ff;
}
:deep(.detail-desc .el-descriptions__body) {
  background-color: transparent;
}
:deep(.detail-desc .el-descriptions__table.is-bordered .el-descriptions__cell) {
  border-color: rgba(64, 158, 255, 0.22);
  background-color: rgba(8, 26, 53, 0.55);
  color: #eaf4ff;
}
:deep(.detail-desc .el-descriptions__cell.el-descriptions__label) {
  width: 92px;
  color: #9fc4ef;
  font-weight: 500;
  background-color: rgba(0, 229, 255, 0.06);
}
:deep(.detail-desc .el-descriptions__cell.el-descriptions__content) {
  color: #eaf4ff;
}
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
/* Element Plus 的选中行底色由 --el-table-current-row-bg-color 控制，默认是浅色，
   在深色科技风面板上会呈现突兀的白色整行。这里统一改为与面板协调的青色高亮。 */
:deep(.el-table) {
  --el-table-current-row-bg-color: rgba(0, 229, 255, 0.22);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-row-hover-bg-color: rgba(0, 229, 255, 0.08);
}
:deep(.el-table__body tr.current-row > td.el-table__cell) {
  background-color: rgba(0, 229, 255, 0.22) !important;
  color: #eaf4ff !important;
}
:deep(.el-table__body tr.current-row > td.el-table__cell:first-child) {
  box-shadow: inset 3px 0 0 #00e5ff;
}
:deep(.el-table__body tr.current-row > td.el-table__cell:first-child) .cell {
  color: #00e5ff;
}
:deep(.el-table__row) { cursor: pointer; }
</style>
