<template>
  <div class="data-center" v-loading="loading">
    <div class="stat-row">
      <StatCard label="接入数据源" :value="catalog.length" unit="个" icon="Connection" color="#2f9bff" sub="ESA / NASA / 中国高分专项" />
      <StatCard label="累计归档影像" :value="totalScenes.toLocaleString()" unit="景" icon="Files" color="#00e5ff" sub="覆盖海南岛及近海 200 km" />
      <StatCard label="今日新增" :value="todayNew" unit="景" icon="Download" color="#2ee6a6" sub="自动订阅 + STAC 同步" />
      <StatCard label="数据源在线率" value="100" unit="%" icon="CircleCheck" color="#ffb02e" sub="全部通道正常" />
    </div>

    <div class="main-row">
      <div class="tech-panel table-panel">
        <div class="panel-title">
          多源卫星数据资源目录
          <el-input v-model="keyword" size="small" class="search-input" placeholder="搜索卫星 / 用途" clearable :prefix-icon="Search" />
        </div>
        <el-table :data="filtered" size="small" height="100%">
          <el-table-column prop="sat" label="卫星" width="150" />
          <el-table-column prop="sensor" label="传感器" width="110" />
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="typeColor(row.type)" size="small" effect="dark">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="resolution" label="分辨率" width="100" />
          <el-table-column prop="revisit" label="重访周期" width="90" />
          <el-table-column prop="scenes" label="归档(景)" width="96" />
          <el-table-column prop="latest" label="最新过境" width="150" />
          <el-table-column prop="usage" label="主要用途" min-width="200" show-overflow-tooltip />
          <el-table-column label="状态" width="76" fixed="right">
            <template #default>
              <span class="online-dot"></span>在线
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="side-col">
        <div class="tech-panel chart-panel">
          <div class="panel-title">各卫星归档占比</div>
          <ChartBox :option="pieOption" height="250px" />
        </div>
        <div class="tech-panel access-panel">
          <div class="panel-title">数据接入通道</div>
          <div class="access-item" v-for="a in accessWays" :key="a.name">
            <el-icon :size="20" :color="a.color"><component :is="a.icon" /></el-icon>
            <div class="access-body">
              <div class="access-name">{{ a.name }}</div>
              <div class="access-desc">{{ a.desc }}</div>
            </div>
            <el-tag size="small" :type="a.ok ? 'success' : 'info'" effect="dark">{{ a.ok ? '已接入' : '规划中' }}</el-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import ChartBox from '@/components/ChartBox.vue'
import StatCard from '@/components/StatCard.vue'
import { fetchSatelliteCatalog } from '@/api'

const loading = ref(true)
const catalog = ref([])
const keyword = ref('')

const filtered = computed(() =>
  catalog.value.filter(
    (c) => !keyword.value || c.sat.includes(keyword.value) || c.usage.includes(keyword.value)
  )
)

const totalScenes = computed(() => catalog.value.reduce((s, c) => s + c.scenes, 0))
const todayNew = computed(() => {
  const last = catalog.value[catalog.value.length - 1]
  return last ? last.scenes % 200 : 0
})

const palette = ['#2f9bff', '#00e5ff', '#2ee6a6', '#ffb02e', '#ff9c40', '#ff5c5c', '#9254de', '#36cfc9', '#ff85c0']

const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 景 ({d}%)' },
  legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: { color: '#8aa6c8', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
  color: palette,
  series: [{
    type: 'pie', radius: ['38%', '66%'], center: ['34%', '50%'],
    label: { show: false },
    data: catalog.value.map((c) => ({ name: c.sat, value: c.scenes }))
  }]
}))

const accessWays = [
  { name: 'Google Earth Engine', desc: 'Sentinel/Landsat 在线云计算与指数反演', icon: 'Cloudy', color: '#2ee6a6', ok: true },
  { name: 'Planetary Computer (STAC)', desc: 'STAC API 订阅 Sentinel/Landsat 最新影像', icon: 'Link', color: '#00e5ff', ok: true },
  { name: '国家综合地球观测数据共享平台', desc: '高分一号/二号/三号数据申请与下载', icon: 'Coin', color: '#ffb02e', ok: true },
  { name: 'MinIO 本地影像归档', desc: '灾前灾后基准影像、模型产品存储', icon: 'FolderOpened', color: '#2f9bff', ok: true },
  { name: 'CMA 热带气旋数据服务', desc: '最佳路径、风场、预报路径自动入库', icon: 'Guide', color: '#ff5c5c', ok: false }
]

function typeColor(type) {
  if (type.includes('SAR')) return 'warning'
  if (type.includes('多光谱') || type.includes('水色')) return 'primary'
  if (type.includes('热红外')) return 'danger'
  return 'info'
}

onMounted(async () => {
  try {
    catalog.value = await fetchSatelliteCatalog()
  } catch (e) {
    console.error('DataCenter 数据加载失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.data-center { display: flex; flex-direction: column; gap: 12px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.main-row { display: grid; grid-template-columns: 1fr 380px; gap: 12px; height: calc(100vh - 270px); min-height: 480px; }
.table-panel { display: flex; flex-direction: column; }
.search-input { width: 220px; margin-left: auto; }
.side-col { display: flex; flex-direction: column; gap: 12px; }
.chart-panel { flex: 1.1; }
.access-panel { flex: 1; }
.access-item { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px dashed rgba(64,158,255,0.15); }
.access-body { flex: 1; }
.access-name { font-size: 13px; color: #eaf4ff; }
.access-desc { font-size: 11px; color: var(--text-sub); margin-top: 2px; }
.online-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #2ee6a6; box-shadow: 0 0 6px #2ee6a6; margin-right: 5px; }
</style>
