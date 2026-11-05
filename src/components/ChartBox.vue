<template>
  <div class="chart-box" :style="{ height: height }">
    <div ref="chartEl" class="chart-canvas"></div>
    <!-- 数据解读：仅当传入 explain 时出现，鼠标悬停展开说明，点击卡片跳转详细说明页 -->
    <div v-if="explain" class="chart-explain">
      <span class="explain-trigger">数据解读</span>
      <div class="explain-pop" @click="goGuide">
        <div class="explain-title">数据解读</div>
        <p class="explain-text">{{ explain }}</p>
        <div v-if="guideId" class="explain-more">点击查看详细说明 →</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '260px' },
  // 图表解读文案：传入后，面板标题行右侧出现「数据解读」小按钮
  explain: { type: String, default: '' },
  // 详细说明页的图表标识：传入后点击解读卡片可跳转到对应说明
  guideId: { type: String, default: '' }
})

const router = useRouter()

function goGuide() {
  if (!props.guideId) return
  router.push({ path: '/guide', query: { chart: props.guideId } })
}

const chartEl = ref(null)
let chart = null
let resizeObserver = null

function render() {
  if (!chart) return
  chart.setOption(props.option, true)
}

onMounted(() => {
  chart = echarts.init(chartEl.value)
  render()
  resizeObserver = new ResizeObserver(() => chart && chart.resize())
  resizeObserver.observe(chartEl.value)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  resizeObserver && resizeObserver.disconnect()
  chart && chart.dispose()
})
</script>

<style scoped>
.chart-box {
  position: relative;
  width: 100%;
}
.chart-canvas {
  width: 100%;
  height: 100%;
}

/* 触发按钮对齐到面板标题行的右侧，悬浮在图上方且不改变原有布局 */
.chart-explain {
  position: absolute;
  top: -30px;
  right: 0;
  z-index: 3;
}
.explain-trigger {
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  font-size: 11px;
  line-height: 17px;
  color: #7fb0dd;
  white-space: nowrap;
  border: 1px solid rgba(64, 158, 255, 0.35);
  border-radius: 9px;
  background: rgba(6, 20, 42, 0.72);
  cursor: help;
  opacity: 0.62;
  transition: color 0.15s, border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.chart-explain:hover .explain-trigger {
  color: #00e5ff;
  opacity: 1;
  border-color: rgba(0, 229, 255, 0.6);
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.28);
}

/* 悬浮说明卡片：从按钮下方展开，不参与文档流 */
.explain-pop {
  position: absolute;
  right: 0;
  top: calc(100% + 7px);
  width: 286px;
  padding: 8px 11px;
  font-size: 12px;
  line-height: 1.7;
  color: #cfe2f7;
  text-align: left;
  background: rgba(4, 18, 40, 0.96);
  border: 1px solid rgba(0, 229, 255, 0.38);
  border-radius: 6px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition: opacity 0.18s, transform 0.18s, visibility 0.18s;
  cursor: pointer;
}
.chart-explain:hover .explain-pop,
.chart-explain:focus-within .explain-pop {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.explain-title {
  margin-bottom: 3px;
  font-size: 12px;
  font-weight: 600;
  color: #00e5ff;
}
.explain-text {
  margin: 0;
}
.explain-more {
  margin-top: 6px;
  padding-top: 5px;
  font-size: 11px;
  color: #00e5ff;
  border-top: 1px dashed rgba(0, 229, 255, 0.25);
}
.explain-pop:hover .explain-more {
  text-decoration: underline;
}
</style>
