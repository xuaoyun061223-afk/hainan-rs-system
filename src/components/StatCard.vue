<template>
  <div class="stat-card tech-panel">
    <div class="stat-icon" :style="{ color: color, borderColor: color + '66', boxShadow: `0 0 12px ${color}33` }">
      <el-icon :size="24"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-body">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value">
        <span :style="{ color }">{{ value }}</span>
        <em v-if="unit">{{ unit }}</em>
      </div>
      <div v-if="sub" class="stat-sub">{{ sub }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  icon: { type: String, default: 'DataLine' },
  color: { type: String, default: '#2f9bff' },
  sub: { type: String, default: '' }
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.stat-icon {
  width: 46px;
  height: 46px;
  border: 1px solid;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
}
.stat-label {
  font-size: 13px;
  color: var(--text-sub);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  font-family: 'DIN', Arial, sans-serif;
}
.stat-value em {
  font-style: normal;
  font-size: 12px;
  color: var(--text-sub);
  margin-left: 4px;
}
.stat-sub {
  font-size: 12px;
  color: var(--text-sub);
}
</style>
