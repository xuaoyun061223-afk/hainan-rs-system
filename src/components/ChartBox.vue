<template>
  <div ref="chartEl" :style="{ width: '100%', height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '260px' }
})

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
