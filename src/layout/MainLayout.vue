<template>
  <el-container class="app-container">
    <el-aside width="230px" class="app-aside">
      <div class="logo-box">
        <el-icon :size="30" color="#00e5ff"><Position /></el-icon>
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
        text-color="#9fc4ef"
        active-text-color="#00e5ff"
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
        <div class="header-title">
          <span class="title-bar"></span>
          {{ currentTitle }}
        </div>
        <div class="header-right">
          <el-tag type="info" effect="dark" round>多源卫星：Sentinel · Landsat · 高分</el-tag>
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
  background:
    radial-gradient(ellipse at 20% 0%, rgba(20, 80, 160, 0.25), transparent 55%),
    radial-gradient(ellipse at 100% 100%, rgba(0, 120, 160, 0.18), transparent 50%),
    var(--bg-deep);
}

.app-aside {
  position: relative;
  background: linear-gradient(180deg, rgba(8, 24, 52, 0.95), rgba(5, 14, 34, 0.95));
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
.logo-title {
  font-size: 16px;
  font-weight: 700;
  color: #eaf4ff;
  letter-spacing: 1px;
}
.logo-sub {
  font-size: 11px;
  color: var(--text-sub);
  margin-top: 2px;
  letter-spacing: 2px;
}

.app-menu {
  flex: 1;
  border-right: none;
  padding: 10px;
}
.app-menu :deep(.el-menu-item) {
  height: 46px;
  line-height: 46px;
  border-radius: 6px;
  margin-bottom: 6px;
}
.app-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(47, 155, 255, 0.28), rgba(47, 155, 255, 0.05));
  box-shadow: inset 3px 0 0 var(--accent);
}
.app-menu :deep(.el-menu-item:hover) {
  background: rgba(47, 155, 255, 0.12);
}

.aside-footer {
  padding: 12px;
  text-align: center;
  font-size: 11px;
  color: #4d678a;
  border-top: 1px solid var(--border-color);
}

.app-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(8, 24, 52, 0.6);
  border-bottom: 1px solid var(--border-color);
}
.header-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #eaf4ff;
  display: flex;
  align-items: center;
  gap: 10px;
}
.title-bar {
  width: 5px;
  height: 20px;
  background: linear-gradient(180deg, var(--accent), var(--primary));
  border-radius: 2px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.map-toggle {
  color: var(--primary-light) !important;
}
.clock {
  font-family: 'DIN', 'Consolas', monospace;
  color: var(--primary-light);
  font-size: 15px;
  letter-spacing: 1px;
}

.app-main {
  padding: 14px;
  overflow-y: auto;
}
</style>
