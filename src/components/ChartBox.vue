<template>
  <div class="chart-box" :style="{ height: height }">
    <div ref="chartEl" class="chart-canvas"></div>

    <!-- 悬停示例：鼠标停在图表数据项上时，上方显示占比/数值，下方显示对应的实景或影像 -->
    <div
      v-if="hoverCard"
      class="chart-media"
      :style="{ left: hoverPos.x + 'px', top: hoverPos.y + 'px' }"
    >
      <div class="cm-head">
        <span class="cm-label">{{ hoverCard.label }}</span>
        <span v-if="hoverCard.ratio" class="cm-ratio">{{ hoverCard.ratio }}</span>
      </div>
      <div class="cm-frame">
        <img
          v-if="!imgFailed"
          :src="hoverCard.img"
          :alt="hoverCard.label"
          loading="lazy"
          @error="imgFailed = true"
        />
        <span v-else class="cm-ph">实景图片暂不可用</span>
      </div>
      <p v-if="hoverCard.desc" class="cm-desc">{{ hoverCard.desc }}</p>
    </div>

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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { chartMedia } from '@/mock/chartMedia'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '260px' },
  // 图表解读文案：传入后，面板标题行右侧出现「数据解读」小按钮
  explain: { type: String, default: '' },
  // 详细说明页的图表标识：传入后点击解读卡片可跳转到对应说明
  guideId: { type: String, default: '' },
  // 悬停图片分组：对应 chartMedia 中的键，也可直接传入自定义映射对象
  hoverId: { type: String, default: '' },
  hoverMedia: { type: Object, default: null }
})

const router = useRouter()

function goGuide() {
  if (!props.guideId) return
  router.push({ path: '/guide', query: { chart: props.guideId } })
}

const chartEl = ref(null)
let chart = null
let resizeObserver = null

const hoverCard = ref(null)
const hoverPos = ref({ x: 8, y: 8 })
const imgFailed = ref(false)

const mediaSet = computed(
  () => props.hoverMedia || (props.hoverId ? chartMedia[props.hoverId] : null) || null
)

// 卡片高度约 180px，用于把它约束在图表范围内（贴左下方）
const CARD_H = 182

function hideCard() {
  hoverCard.value = null
}

function resolveValue(params) {
  if (params.value != null) return params.value
  if (typeof params.data === 'number' || typeof params.data === 'string') return params.data
  // 折线整体触发时拿不到 value，按 seriesIndex / dataIndex 回查原始数据
  const series = props.option && props.option.series
  const item = series && params.seriesIndex != null
    ? (series[params.seriesIndex] || {}).data?.[params.dataIndex]
    : null
  if (typeof item === 'number' || typeof item === 'string') return item
  if (item && typeof item === 'object' && item.value != null) return item.value
  return null
}

function showCard(params) {
  const set = mediaSet.value
  if (!set || !params) return
  // 依次尝试：数据项自定义 __media、系列名、数据项名称，取第一个能匹配到图片的键
  const keys = [params.data && params.data.__media, params.seriesName, params.name]
  const key = keys.find((k) => k && set[k])
  const media = key ? set[key] : null
  if (!media) {
    hideCard()
    return
  }
  let ratio = ''
  if (params.percent != null) ratio = `占比 ${params.percent}%`
  else {
    const v = resolveValue(params)
    if (v != null) ratio = `${v}${media.unit || ''}`
  }

  hoverCard.value = { label: media.label || key, ratio, img: media.img, desc: media.desc || '' }
  imgFailed.value = false

  const ch = chartEl.value.clientHeight
  // 固定在图内左下角：避开随鼠标移动的 ECharts 原生提示框，位置稳定不遮挡指针对应数据
  hoverPos.value = {
    x: 8,
    y: Math.max(4, ch - CARD_H - 6)
  }
}

function render() {
  if (!chart) return
  hideCard()
  // 有悬停图片时关闭 ECharts 原生 tooltip，避免白色数字标签覆盖在实景图片上
  const opt = mediaSet.value ? { ...props.option, tooltip: { show: false } } : props.option
  chart.setOption(opt, true)
}

onMounted(() => {
  chart = echarts.init(chartEl.value)
  render()
  chart.on('mouseover', showCard)
  chart.on('mouseout', hideCard)
  chart.on('globalout', hideCard)
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

/* 悬停示例卡片：固定在图表左下角，上方显示占比或数值，下方为实景/影像 */
.chart-media {
  position: absolute;
  width: 168px;
  padding: 5px 6px 6px;
  pointer-events: none;
  background: rgba(4, 18, 40, 0.97);
  border: 1px solid rgba(0, 229, 255, 0.45);
  border-radius: 7px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
  z-index: 4;
  animation: cm-in 0.14s ease-out;
}
@keyframes cm-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.cm-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 5px;
}
.cm-label {
  font-size: 11px;
  color: #8fb4d9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cm-ratio {
  font-size: 12px;
  font-weight: 600;
  color: #00e5ff;
  white-space: nowrap;
}
.cm-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #04122a;
  border-radius: 4px;
}
.cm-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cm-ph {
  font-size: 11px;
  color: #6f90b5;
}
.cm-desc {
  margin: 5px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: #8fb4d9;
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
