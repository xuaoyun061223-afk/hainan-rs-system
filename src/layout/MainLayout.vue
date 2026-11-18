<template>
  <el-container class="app-container">
    <el-aside width="230px" class="app-aside">
      <div class="logo-box">
        <el-icon :size="24" class="logo-icon"><Position /></el-icon>
        <div class="logo-text">
          <div class="logo-title">海南近海遥感监测</div>
          <div class="logo-sub">台风灾害评估系统</div>
        </div>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        class="app-menu"
        background-color="transparent"
        text-color="#93a1ac"
        active-text-color="#e6ebef"
      >
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-footer">v0.1.0 · 演示环境</div>
    </el-aside>

    <el-container>
      <el-header class="app-header">
        <div class="header-title">{{ currentTitle }}</div>
        <div class="header-right">
          <span class="header-meta">Sentinel · Landsat · 高分</span>
          <el-button text class="map-toggle" @click="appStore.toggleBaseMap()">
            <el-icon><Switch /></el-icon>
            {{ appStore.baseMapType === 'vector' ? '影像底图' : '矢量底图' }}
          </el-button>
          <span class="clock">{{ now }}</span>
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const appStore = useAppStore()

const menus = [
  { path: '/dashboard', title: '综合态势一张图', icon: 'Monitor' },
  { path: '/ecology', title: '近海生态环境监测', icon: 'Sunny' },
  { path: '/typhoon', title: '台风监测预警', icon: 'Guide' },
  { path: '/damage', title: '台风灾害评估', icon: 'Warning' },
  { path: '/data', title: '多源卫星数据中心', icon: 'Files' }
]

const currentTitle = computed(() => route.meta.title || '综合态势一张图')

const now = ref('')
let timer = null
function tick() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  now.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.app-container {
  height: 100%;
  background: var(--bg-deep);
}

.app-aside {
  background: #0d1217;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  border-bottom: 1px solid var(--border-color);
}
.logo-icon {
  color: var(--primary);
}
.logo-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  letter-spacing: 0.3px;
}
.logo-sub {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 3px;
}

.app-menu {
  flex: 1;
  border-right: none;
  padding: 10px 8px;
}
.app-menu :deep(.el-menu-item) {
  height: 40px;
  line-height: 40px;
  font-size: 13px;
  border-radius: var(--radius);
  margin-bottom: 2px;
  border-left: 2px solid transparent;
}
.app-menu :deep(.el-menu-item.is-active) {
  background: rgba(255, 255, 255, 0.05);
  border-left-color: var(--primary);
}
.app-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.035);
}

.aside-footer {
  padding: 12px;
  text-align: center;
  font-size: 11px;
  color: var(--text-dim);
  border-top: 1px solid var(--border-color);
}

.app-header {
  height: 54px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0d1217;
  border-bottom: 1px solid var(--border-color);
}
.header-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--text-main);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header-meta {
  font-size: 11px;
  color: var(--text-dim);
}
.map-toggle {
  color: var(--text-sub) !important;
  font-size: 12px;
}
.clock {
  font-family: Consolas, 'Courier New', monospace;
  color: var(--text-sub);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.app-main {
  padding: 12px;
  overflow-y: auto;
}
</style>
