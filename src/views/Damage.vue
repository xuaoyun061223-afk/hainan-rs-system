<template>
  <div class="damage" v-loading="loading">
    <div class="top-bar">
      <div class="event-info">
        <el-icon color="#ff5c5c" :size="20"><WarningFilled /></el-icon>
        <span class="label">评估对象</span>
        <el-select
          v-model="selectedId"
          size="small"
          filterable
          class="target-select"
          popper-class="damage-typhoon-popper"
          :loading="targetLoading"
          @change="loadAssessment"
        >
          <el-option-group v-if="liveTargets.length" label="实时台风（活跃优先）">
            <el-option
              v-for="t in liveTargets"
              :key="t.id"
              :value="t.id"
              :label="`${t.id} ${t.name}`"
            >
              <span class="opt-name">{{ t.id }} {{ t.name }}</span>
              <span class="opt-grade">{{ t.grade }}</span>
            </el-option>
          </el-option-group>
          <el-option-group v-if="yearTargets.length" label="本年度台风（最近观测）">
            <el-option
              v-for="t in yearTargets"
              :key="t.id"
              :value="t.id"
              :label="`${t.id} ${t.name}`"
            >
              <span class="opt-name">{{ t.id }} {{ t.name }}</span>
              <span class="opt-grade">{{ t.date }}</span>
            </el-option>
          </el-option-group>
          <el-option-group label="历史台风">
            <el-option
              v-for="t in historyTargets"
              :key="t.id"
              :value="t.id"
              :label="`${t.id} ${t.name}`"
            >
              <span class="opt-name">{{ t.id }} {{ t.name }}</span>
              <span class="opt-grade">{{ t.grade }}</span>
            </el-option>
          </el-option-group>
        </el-select>
        <span class="target-count" v-if="targets.length">
          现有 {{ liveTargets.length + yearTargets.length }} 个 · 历史 {{ historyTargets.length }} 个
        </span>
        <el-tag size="small" :type="assessment.active ? 'warning' : 'danger'" effect="dark">
          {{ assessment.statusText }}
        </el-tag>
        <el-tag size="small" type="info" effect="plain">风险等级 {{ assessment.impactLevel }}</el-tag>
        <span class="data-note">
          强度 {{ assessment.grade }} · 最大风速 {{ assessment.wind }} m/s · {{ assessment.landfall }}
        </span>
      </div>
      <el-button type="primary" :icon="Document" @click="genReport">生成评估报告</el-button>
    </div>

    <div class="stat-row">
      <StatCard label="SAR 提取淹没面积" :value="assessment.inundationArea" unit="km²" icon="Pouring" color="#ffb02e" sub="灾前/灾后 Sentinel-1 变化检测" />
      <StatCard label="受损建筑" :value="damagedBuildings" unit="栋" icon="OfficeBuilding" color="#ff5c5c" sub="xBD 四级损毁模型判识" />
      <StatCard label="植被显著受损区" :value="assessment.vegetationDamage" unit="km²" icon="Crop" color="#2ee6a6" sub="NDVI 下降 ≥ 0.15 区域" />
      <StatCard label="直接经济损失" :value="assessment.economicLoss" unit="亿元" icon="Money" color="#2f9bff" :sub="`受灾人口 ${assessment.affectedPopulation} 万人`" />
    </div>

    <div class="main-row">
      <div class="tech-panel map-panel">
        <div class="panel-title">
          灾后淹没范围与受灾区域（SAR 合成）
          <span class="map-tip">{{ mapTip }}</span>
        </div>
        <div class="map-container">
          <BaseMap base-type="satellite" :stations="[]" :track="[]" :inundation="assessment.polygons" :legend="mapLegend" />
        </div>
      </div>
      <div class="tech-panel recover-panel">
        <div class="panel-title">灾后恢复指标</div>
        <div class="recover-grid">
          <div class="recover-item">
            <div class="recover-label">电力恢复率</div>
            <el-progress :percentage="assessment.recovery.power" :stroke-width="12" :color="powerColor" :show-text="false" />
            <b>{{ assessment.recovery.power }}%</b>
          </div>
          <div class="recover-item">
            <div class="recover-label">道路通行率</div>
            <el-progress :percentage="assessment.recovery.road" :stroke-width="12" color="#ffb02e" :show-text="false" />
            <b>{{ assessment.recovery.road }}%</b>
          </div>
          <div class="recover-item">
            <div class="recover-label">NDVI 恢复度</div>
            <el-progress :percentage="assessment.recovery.ndvi" :stroke-width="12" color="#2ee6a6" :show-text="false" />
            <b>{{ assessment.recovery.ndvi }}%</b>
          </div>
          <div class="recover-note">
            基于 VIIRS 夜间灯光、路网影像与 Sentinel-2 NDVI 时序自动计算 ·
            轨迹最近距海南 {{ assessment.proximityKm }} km
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-row">
      <div class="tech-panel chart-panel">
        <div class="panel-title">建筑损毁分级（xBD 模型）</div>
        <div class="chart-body">
          <ChartBox :option="damagePie" height="100%" />
        </div>
      </div>
      <div class="tech-panel chart-panel">
        <div class="panel-title">台风前后海南岛 NDVI 均值时序</div>
        <div class="chart-body">
          <ChartBox :option="ndviOption" height="100%" />
        </div>
      </div>
      <div class="tech-panel chart-panel">
        <div class="panel-title">重点市县灾情统计</div>
        <div class="table-body">
          <el-table :data="assessment.cities" size="small" height="100%">
            <el-table-column prop="city" label="市县" width="70" />
            <el-table-column prop="inundation" label="淹没(km²)" width="96" />
            <el-table-column prop="buildings" label="受损建筑(栋)" width="110" />
            <el-table-column label="植被受损(km²)">
              <template #default="{ row }">
                <div class="bar-cell">
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ width: (row.vegetation / vegMax) * 100 + '%' }"></div>
                  </div>
                  <span>{{ row.vegetation }}</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import BaseMap from '@/components/BaseMap.vue'
import ChartBox from '@/components/ChartBox.vue'
import StatCard from '@/components/StatCard.vue'
import {
  fetchDamageTargets, fetchDamageAssessment,
  fetchDamageSummary, fetchBuildingDamage, fetchNdviCompare, fetchCityDamage, fetchInundation
} from '@/api'

const loading = ref(true)
const targetLoading = ref(false)
const targets = ref([])
const selectedId = ref('2411')
const route = useRoute()

// 评估结果默认结构与后端 /damage/assessment 保持一致，避免首帧模板取空报错
const EMPTY = {
  id: '', name: '', grade: '', wind: 0, pressure: null, date: '', landfall: '未登陆',
  active: false, statusText: '', impactLevel: '一般', proximityKm: 0,
  affectedCities: 0, affectedPopulation: 0, economicLoss: 0, inundationArea: 0,
  vegetationDamage: 0,
  building: { none: 0, minor: 0, major: 0, destroyed: 0 },
  recovery: { power: 0, road: 0, ndvi: 0 },
  cities: [], ndvi: { dates: [], before: [], after: [], landfallDate: '' }, polygons: []
}
const assessment = ref({ ...EMPTY })

const liveTargets = computed(() => targets.value.filter((t) => t.source === '实时台风'))
const yearTargets = computed(() => targets.value.filter((t) => t.source === '本年度台风'))
const historyTargets = computed(() => targets.value.filter((t) => t.source === '历史台风'))

const damagedBuildings = computed(
  () => (assessment.value.building.minor || 0) + (assessment.value.building.major || 0) + (assessment.value.building.destroyed || 0)
)

const mapLegend = [{ label: 'SAR 淹没区', color: '#ffb02e' }]
const mapTip = computed(() =>
  assessment.value.polygons.length
    ? `登陆点 ${assessment.value.landfallLon?.toFixed?.(2) ?? ''}°E, ${assessment.value.landfallLat?.toFixed?.(2) ?? ''}°N`
    : '该台风未逼近海南岛，无淹没区'
)

const powerColor = computed(() => {
  const v = assessment.value.recovery.power
  return v < 30 ? '#ff5c5c' : v < 60 ? '#ffb02e' : '#2ee6a6'
})

const vegMax = computed(() =>
  Math.max(1, ...assessment.value.cities.map((c) => Number(c.vegetation) || 0))
)

const axisStyle = {
  axisLine: { lineStyle: { color: '#2b4a76' } },
  axisLabel: { color: '#8aa6c8', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } }
}

const buildingDamageData = computed(() => {
  const b = assessment.value.building
  return [
    { name: '无损坏', value: b.none, color: '#2ee6a6' },
    { name: '轻微损坏', value: b.minor, color: '#ffd666' },
    { name: '严重损坏', value: b.major, color: '#ff9c40' },
    { name: '完全摧毁', value: b.destroyed, color: '#ff5c5c' }
  ]
})

const damagePie = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} 栋 ({d}%)' },
  legend: { bottom: 0, textStyle: { color: '#8aa6c8', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
  color: buildingDamageData.value.map((b) => b.color),
  series: [{
    type: 'pie', radius: ['40%', '64%'], center: ['50%', '44%'],
    minAngle: 3,
    // 弱台风时"完全摧毁/严重损坏"扇区极小，标签会互相压叠：
    // 只给占比 ≥5% 的扇区标文字，其余靠图例与悬浮提示辨认
    labelLayout: { hideOverlap: true },
    label: {
      color: '#d6e8ff',
      fontSize: 11,
      formatter: (p) => (p.percent >= 5 ? `${p.name}\n${p.percent}%` : '')
    },
    data: buildingDamageData.value
  }]
}))

const ndviOption = computed(() => {
  const n = assessment.value.ndvi
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['灾前 NDVI', '灾后 NDVI'], textStyle: { color: '#8aa6c8' }, top: 0, left: 0 },
    grid: { left: 48, right: 24, top: 34, bottom: 28 },
    xAxis: { type: 'category', data: n.dates, ...axisStyle },
    yAxis: { type: 'value', min: 0.4, max: 0.85, ...axisStyle },
    series: [
      {
        name: '灾前 NDVI', type: 'line', smooth: true, connectNulls: false,
        data: n.before, lineStyle: { width: 2.5, color: '#2ee6a6' }, itemStyle: { color: '#2ee6a6' }
      },
      {
        name: '灾后 NDVI', type: 'line', smooth: true, connectNulls: false,
        data: n.after, lineStyle: { width: 2.5, color: '#ff7a45' }, itemStyle: { color: '#ff7a45' },
        markLine: {
          symbol: 'none', lineStyle: { color: '#ff5c5c', type: 'dashed' },
          // 标注放在虚线底部，避免与顶部图例文字叠在一起
          label: { color: '#ff9c9c', position: 'insideEndBottom', formatter: n.landfallDate || '' },
          data: n.landfallDate ? [{ xAxis: n.landfallDate }] : []
        }
      }
    ]
  }
})

async function loadAssessment(id) {
  if (!id) return
  loading.value = true
  try {
    const data = await fetchDamageAssessment(id)
    if (data) assessment.value = data
  } catch (e) {
    console.error('灾害评估加载失败', e)
    ElMessage.error('灾害评估数据加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

/** 兼容旧接口：评估接口不可用时，仍能展示默认的摩羯快照评估 */
async function loadFallback() {
  const [s, b, n, c, i] = await Promise.all([
    fetchDamageSummary(), fetchBuildingDamage(), fetchNdviCompare(), fetchCityDamage(), fetchInundation()
  ])
  assessment.value = {
    ...EMPTY,
    id: '2411', name: '摩羯 YAGI', grade: '超强台风', wind: 62, active: false,
    statusText: '已完成灾后快速评估',
    affectedPopulation: s.affectedPopulation,
    economicLoss: s.economicLoss,
    inundationArea: s.inundationArea,
    vegetationDamage: s.vegetationDamage,
    building: s.building,
    cities: c,
    ndvi: { ...n, landfallDate: '09-06' },
    polygons: i
  }
}

function genReport() {
  const name = assessment.value.name || selectedId.value
  ElMessage.success(`评估报告已生成（模拟）：${assessment.value.id || selectedId.value}_${name}_海南台风灾害快速评估报告.pdf`)
}

onMounted(async () => {
  try {
    targetLoading.value = true
    targets.value = (await fetchDamageTargets()) || []
    // 支持 #/damage?typhoon=1409 这样的深链，便于分享指定台风的评估结果
    const wanted = String(route.query.typhoon || '')
    if (wanted && targets.value.some((t) => t.id === wanted)) {
      selectedId.value = wanted
    } else {
      // 默认优先展示 2411「摩羯」这一有完整灾情台账的代表性超强台风；
      // 列表中若没有历史快照，则退回当前活跃台风。
      const hasMoy = targets.value.some((t) => t.id === '2411')
      const firstActive = targets.value.find((t) => t.active)
      selectedId.value = hasMoy ? '2411' : (firstActive ? firstActive.id : (targets.value[0]?.id || '2411'))
    }
    await loadAssessment(selectedId.value)
  } catch (e) {
    console.error('Damage 数据加载失败', e)
    try {
      await loadFallback()
    } catch (err) {
      ElMessage.error('灾害评估数据加载失败')
    }
  } finally {
    targetLoading.value = false
    loading.value = false
  }
})
</script>

<style scoped>
.damage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 与其它页面保持一致的"满屏不滚动"布局；窗口过矮时按 min-height 撑开，
     由 el-main 负责滚动，而不是让面板互相压盖 */
  height: calc(100vh - 88px);
  min-height: 640px;
}
.top-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  flex-wrap: wrap;
}
.event-info { display: flex; align-items: center; gap: 10px; font-size: 14px; min-width: 0; }
.label { color: var(--text-sub); }
.target-select { width: 268px; }
:deep(.target-select .el-select__wrapper) {
  background: rgba(8, 26, 53, 0.7);
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.28) inset;
}
:deep(.target-select .el-select__selected-item) { color: #eaf4ff; }
:deep(.target-select .el-select__placeholder) { color: var(--text-sub); }
:deep(.target-select .el-select__caret) { color: #8aa6c8; }
.opt-name { color: #eaf4ff; }
.opt-grade { float: right; margin-left: 16px; color: var(--text-sub); font-size: 12px; }
.target-count { font-size: 12px; color: var(--text-sub); white-space: nowrap; }
.data-note { font-size: 12px; color: var(--text-sub); }
.map-tip { margin-left: auto; font-size: 11px; font-weight: 400; color: var(--text-sub); }
.stat-row { flex: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.main-row {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 12px;
}
.map-panel,
.recover-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.map-container { flex: 1; min-height: 0; position: relative; }
.recover-grid {
  flex: 1;
  min-height: 0;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 14px;
}
.recover-item {
  display: grid;
  grid-template-columns: 90px 1fr 52px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.recover-item b { color: #eaf4ff; }
.recover-note { font-size: 11px; color: var(--text-sub); line-height: 1.6; }
.bottom-row {
  flex: none;
  height: 246px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 12px;
}
.chart-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 12px 14px;
}
.chart-body { flex: 1; min-height: 0; }
.table-body { flex: 1; min-height: 0; overflow: hidden; }
.bar-cell { display: flex; align-items: center; gap: 8px; }
.bar-track { flex: 1; height: 8px; background: rgba(47,155,255,0.12); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 4px; }
.bar-cell span { font-size: 12px; color: var(--text-sub); width: 52px; }
</style>

<!-- 下拉面板通过 teleport 挂到 body，scoped 样式无法命中，这里用非 scoped 覆盖为深色主题 -->
<style>
.damage-typhoon-popper.el-popper {
  --el-bg-color-overlay: rgba(8, 26, 53, 0.96);
  --el-popper-bg-color-light: #0a2040;
  --el-border-color-light: rgba(64, 158, 255, 0.28);
  --el-box-shadow-light: 0 8px 28px rgba(0, 0, 0, 0.5);
  --el-text-color-regular: #d6e8ff;
  --el-fill-color-light: rgba(47, 155, 255, 0.14);
  --el-color-info: #7fa8d8;
  border-radius: 6px;
}
.damage-typhoon-popper .el-select-dropdown__list { padding: 4px 0; }
.damage-typhoon-popper .el-select-group__title { color: #7fa8d8; font-weight: 500; }
.damage-typhoon-popper .el-select-dropdown__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: #d6e8ff;
}
.damage-typhoon-popper .el-select-dropdown__item.is-hovering {
  color: #ffffff;
  background-color: rgba(47, 155, 255, 0.16);
}
.damage-typhoon-popper .el-select-dropdown__item.is-selected { color: #2ee6a6; }
.damage-typhoon-popper .opt-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #d6e8ff;
}
.damage-typhoon-popper .el-select-dropdown__item.is-hovering .opt-name { color: #ffffff; }
.damage-typhoon-popper .el-select-dropdown__item.is-selected .opt-name { color: #2ee6a6; }
.damage-typhoon-popper .opt-grade { float: none; margin-left: 0; flex: none; color: #8aa6c8; }
.damage-typhoon-popper .el-select-dropdown__item.is-selected .opt-grade { color: #6fcfa4; }
</style>
