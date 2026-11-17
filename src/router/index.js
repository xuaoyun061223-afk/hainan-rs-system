import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layout/MainLayout.vue'

const routes = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('@/views/Landing.vue')
  },
  {
    // 系统主体：/dashboard 为默认页，其余子路由使用绝对路径，保持原有地址不变
    path: '/dashboard',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '综合态势一张图', icon: 'Monitor' }
      },
      {
        path: '/ecology',
        name: 'Ecology',
        component: () => import('@/views/Ecology.vue'),
        meta: { title: '近海生态环境监测', icon: 'Sunny' }
      },
      {
        path: '/typhoon',
        name: 'Typhoon',
        component: () => import('@/views/Typhoon.vue'),
        meta: { title: '台风监测预警', icon: 'Guide' }
      },
      {
        path: '/damage',
        name: 'Damage',
        component: () => import('@/views/Damage.vue'),
        meta: { title: '台风灾害评估', icon: 'Warning' }
      },
      {
        path: '/data',
        name: 'DataCenter',
        component: () => import('@/views/DataCenter.vue'),
        meta: { title: '多源卫星数据中心', icon: 'Files' }
      },
      {
        path: '/guide',
        name: 'ChartGuide',
        component: () => import('@/views/ChartGuide.vue'),
        meta: { title: '图表详细说明' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
