<template>
  <div class="stat-card" :style="{ borderLeftColor: color }">
    <div class="stat-head">
      <el-icon v-if="icon" :size="13" class="stat-icon"><component :is="icon" /></el-icon>
      <span class="stat-label">{{ label }}</span>
    </div>
    <div class="stat-value">
      {{ value }}<em v-if="unit">{{ unit }}</em>
    </div>
    <div v-if="sub" class="stat-sub">{{ sub }}</div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  icon: { type: String, default: 'DataLine' },
  color: { type: String, default: '#6f9db8' },
  sub: { type: String, default: '' }
})
</script>

<style scoped>
.stat-card {
  padding: 12px 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-left: 2px solid var(--primary);
  border-radius: var(--radius);
}
.stat-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-sub);
}
.stat-icon {
  color: var(--text-dim);
}
.stat-label {
  font-size: 12px;
}
.stat-value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
}
.stat-value em {
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-sub);
  margin-left: 4px;
}
.stat-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-dim);
}
</style>
