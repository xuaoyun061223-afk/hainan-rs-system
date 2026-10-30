<template>
  <div class="damage" v-loading="loading">
    <div class="top-bar">
      <div class="event-info">
        <el-icon color="#ff5c5c" :size="20"><WarningFilled /></el-icon>
        <span>评估事件：<b>{{ summary.event }}</b></span>
        <el-tag size="small" type="danger" effect="dark">已完成灾后快速评估</el-tag>
        <span class="data-note">影像源：Sentinel-1 GRD + Sentinel-2 L2A + 高分二号（模拟）</span>
      </div>
      <el-button type="primary" :icon="Document" @click="genReport">生成评估报告</el-button>
    </div>

    <div class="stat-row">
      <StatCard label="SAR 提取淹没面积" :value="summary.inundationArea" unit="km²" icon="Pouring" color="#ffb02e" sub="灾前/灾后 Sentinel-1 变化检测" />
      <StatCard label="受损建筑" :value="damagedBuildings" unit="栋" icon="OfficeBuilding" color="#ff5c5c" sub="xBD 四级损毁模型判识" />
      <StatCard label="植被显著受损区" :value="summary.vegetationDamage" unit="km²" icon="Crop" color="#2ee6a6" sub="NDVI 下降 ≥ 0.15 区域" />
      <StatCard label="直接经济损失" :value="summary.economicLoss" unit="亿元" icon="Money" color="#2f9bff" :sub="`受灾人口 ${summary.affectedPopulation} 万人`" />
    </div>

    <div class="main-row">
      <div class="tech-panel map-panel">
        <div class="panel-title">灾后淹没范围与受灾区域（SAR 合成）</div>
        <div class="map-container">
          <BaseMap base-type="satellite" :stations="[]" :track="[]" :inundation="inundationPolys" :legend="mapLegend" />
        </div>
      </div>
      <div class="tech-panel recover-panel">
        <div class="panel-title">灾后恢复指标</div>
        <div class="recover-grid">
          <div class="recover-item">
            <div class="recover-label">电力恢复率</div>
            <el-progress :percentage="13.5" :stroke-width="12" color="#ff5c5c" :show-text="false" />
            <b>13.5%</b>
          </div>
          <div class="recover-item">
            <div class="recover-label">道路通行率</div>
            <el-progress :percentage="68" :stroke-width="12" color="#ffb02e" :show-text="false" />
            <b>68%</b>
          </div>
          <div class="recover-item">
            <div class="recover-label">NDVI 恢复度</div>
            <el-progress :percentage="42" :stroke-width="12" color="#2ee6a6" :show-text="false" />
            <b>42%</b>
          </div>
          <div class="recover-note">基于 VIIRS 夜间灯光、路网影像与 Sentinel-2 NDVI 时序自动计算</div>
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
          <el-table :data="cityDamageData" size="small" height="100%">
            <el-table-column prop="city" label="市县" width="70" />
            <el-table-column prop="inundation" label="淹没(km²)" width="96" />
            <el-table-column prop="buildings" label="受损建筑(栋)" width="110" />
            <el-table-column label="植被受损(km²)">
              <template #default="{ row }">
                <div class="bar-cell">
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ width: (row.vegetation / 500) * 100 + '%' }"></div>
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
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import BaseMap from '@/components/BaseMap.vue'
import ChartBox from '@/components/ChartBox.vue'
import StatCard from '@/components/StatCard.vue'
import {
  fetchDamageSummary, fetchBuildingDamage, fetchNdviCompare, fetchCityDamage, fetchInundation
} from '@/api'

const loading = ref(true)
const summary = ref({
  event: '', inundationArea: 0, vegetationDamage: 0, economicLoss: 0,
  affectedPopulation: 0, building: {}
})
const buildingDamageData = ref([])
const ndviData = ref({ dates: [], before: [], after: [] })
const cityDamageData = ref([])
const inundationPolys = ref([])

const damagedBuildings = computed(
  () => (summary.value.building.minor || 0) + (summary.value.building.major || 0) + (summary.value.building.destroyed || 0)
)

const mapLegend = [{ label: 'SAR 淹没区', color: '#ffb02e' }]

const axisStyle = {
  axisLine: { lineStyle: { color: '#2b4a76' } },
  axisLabel: { color: '#8aa6c8', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } }
}

const damagePie = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} 栋 ({d}%)' },
  legend: { bottom: 0, textStyle: { color: '#8aa6c8', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
  color: buildingDamageData.value.map((b) => b.color),
  series: [{
    type: 'pie', radius: ['40%', '64%'], center: ['50%', '44%'],
    label: { color: '#d6e8ff', fontSize: 11 },
    data: buildingDamageData.value
  }]
}))

const ndviOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['灾前 NDVI', '灾后 NDVI'], textStyle: { color: '#8aa6c8' }, top: 0, left: 0 },
  grid: { left: 48, right: 24, top: 34, bottom: 28 },
  xAxis: { type: 'category', data: ndviData.value.dates, ...axisStyle },
  yAxis: { type: 'value', min: 0.4, max: 0.85, ...axisStyle },
  series: [
    {
      name: '灾前 NDVI', type: 'line', smooth: true, connectNulls: false,
      data: ndviData.value.before, lineStyle: { width: 2.5, color: '#2ee6a6' }, itemStyle: { color: '#2ee6a6' }
    },
    {
      name: '灾后 NDVI', type: 'line', smooth: true, connectNulls: false,
      data: ndviData.value.after, lineStyle: { width: 2.5, color: '#ff7a45' }, itemStyle: { color: '#ff7a45' },
      markLine: {
        symbol: 'none', lineStyle: { color: '#ff5c5c', type: 'dashed' },
        // 标注放在虚线底部，避免与顶部图例文字叠在一起
        label: { color: '#ff9c9c', position: 'insideEndBottom', formatter: '9月6日' },
        data: [{ xAxis: '09-06' }]
      }
    }
  ]
}))

function genReport() {
  ElMessage.success('评估报告已生成（模拟）：2411_YAGI_海南台风灾害快速评估报告.pdf')
}

onMounted(async () => {
  try {
    const [s, b, n, c, i] = await Promise.all([
      fetchDamageSummary(), fetchBuildingDamage(), fetchNdviCompare(), fetchCityDamage(), fetchInundation()
    ])
    summary.value = s
    buildingDamageData.value = b
    ndviData.value = n
    cityDamageData.value = c
    inundationPolys.value = i
  } catch (e) {
    console.error('Damage 数据加载失败', e)
  } finally {
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
  padding: 8px 14px;
}
.event-info { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.data-note { font-size: 12px; color: var(--text-sub); margin-left: 8px; }
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
