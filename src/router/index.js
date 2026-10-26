import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layout/MainLayout.vue'

const routes = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '综合态势一张图', icon: 'Monitor' }
      },
      {
        path: 'ecology',
        name: 'Ecology',
        component: () => import('@/views/Ecology.vue'),
        meta: { title: '近海生态环境监测', icon: 'Sunny' }
      },
      {
        path: 'typhoon',
        name: 'Typhoon',
        component: () => import('@/views/Typhoon.vue'),
        meta: { title: '台风监测预警', icon: 'Guide' }
      },
      {
        path: 'damage',
        name: 'Damage',
        component: () => import('@/views/Damage.vue'),
        meta: { title: '台风灾害评估', icon: 'Warning' }
      },
      {
        path: 'data',
        name: 'DataCenter',
        component: () => import('@/views/DataCenter.vue'),
        meta: { title: '多源卫星数据中心', icon: 'Files' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
