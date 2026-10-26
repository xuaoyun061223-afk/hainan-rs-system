import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 当前选中的台风编号
  const activeTyphoonId = ref('2411')
  // 当前选中的近岸监测站点
  const activeStation = ref('海口湾')
  // 底图：vector 矢量 / satellite 影像
  const baseMapType = ref('vector')

  function setActiveTyphoon(id) {
    activeTyphoonId.value = id
  }
  function setActiveStation(name) {
    activeStation.value = name
  }
  function toggleBaseMap() {
    baseMapType.value = baseMapType.value === 'vector' ? 'satellite' : 'vector'
  }

  return {
    activeTyphoonId,
    activeStation,
    baseMapType,
    setActiveTyphoon,
    setActiveStation,
    toggleBaseMap
  }
})
