<template>
  <div class="guide">
    <div class="tech-panel guide-head">
      <div>
        <div class="guide-title">图表详细说明</div>
        <div class="guide-sub">
          从各数据图右上角的「数据解读」卡片点击即可跳到对应说明；把鼠标停留在图表上，可查看该类别占比或数值及对应的实景/影像示例。
        </div>
      </div>
      <el-button size="small" @click="$router.back()">返回上一页</el-button>
    </div>

    <div
      v-for="g in guides"
      :id="g.id"
      :key="g.id"
      class="tech-panel guide-item"
      :class="{ active: activeId === g.id }"
    >
      <div class="item-head">
        <span class="item-module">{{ g.module }}</span>
        <span class="item-title">{{ g.title }}</span>
      </div>
      <div class="item-row">
        <span class="row-label">指标含义</span>
        <p class="row-text">{{ g.meaning }}</p>
      </div>
      <div class="item-row">
        <span class="row-label">怎么看图</span>
        <p class="row-text">{{ g.howto }}</p>
      </div>
      <div class="item-row">
        <span class="row-label">注意事项</span>
        <p class="row-text">{{ g.caveat }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeId = ref('')

// 图表标识与各页面 ChartBox 的 guide-id 一一对应
const guides = [
  {
    id: 'water-grade',
    module: '综合态势一张图',
    title: '近岸水质类别占比',
    meaning:
      '水质类别依据《海水水质标准》，由溶解氧、无机氮、活性磷酸盐、化学需氧量等实测指标综合判定为二类、三类、劣四类等；环形图展示各等级监测站在全部站点中的数量占比。',
    howto:
      '先看绿色（一类）与蓝色（二类）的合计占比，越高说明近岸整体水质越好；再关注红色（劣四类）扇区，它通常集中在河口、港湾和养殖密集区。鼠标悬停扇区可查看具体站数、比例与对应水质的实景图片。',
    caveat:
      '占比反映的是“站点数量”比例，不代表海域面积；单次采样结果受潮汐、降雨影响较大，出现个别异常站点时建议结合多期数据判断趋势。'
  },
  {
    id: 'satellite-week',
    module: '综合态势一张图',
    title: '近 7 日卫星影像接入（景）',
    meaning:
      '统计每日成功接入并归档的光学影像（蓝色，如 Sentinel-2、GF 系列）与 SAR 影像（青色，如 Sentinel-1、GF-3）景数。',
    howto:
      '柱子高低看当日可用数据量；蓝青比例看天气——晴天光学影像多，连续阴雨时 SAR 占比上升。若连续多天柱体偏低，通常是持续阴雨或数据下发延迟。悬停柱体可查看影像示例。',
    caveat:
      '这里的“景”是影像幅数而非覆盖面积，不同卫星幅宽差异较大，因此柱高不能直接当作覆盖能力来比较。'
  },
  {
    id: 'chla-rank',
    module: '综合态势一张图',
    title: '各站叶绿素 a 实时浓度',
    meaning:
      '叶绿素 a 浓度（mg/m³）反映水体中浮游植物（藻类）的生物量，是判断富营养化与赤潮风险最直接的指标。',
    howto:
      '横向条形按浓度从高到低排序，颜色代表风险等级：绿色为低、橙色为中、红色为高。排名靠前且持续升高的站点应优先关注，悬停条形可查看该浓度等级对应的水体实景。',
    caveat:
      '阴天光学反演可能缺测；近岸浅水区易受底质反射影响使数值偏高，重要判断建议结合现场采样校准。'
  },
  {
    id: 'ecology-trend',
    module: '近海生态环境监测',
    title: '指标月度变化趋势',
    meaning:
      '选定站点某一指标（叶绿素 a / 悬浮泥沙 / 海表温度）的逐月均值，用于观察季节尺度上的变化规律。',
    howto:
      '重点看整体趋势与峰值月份：海南夏季（6—9 月）水温高、降水集中，叶绿素与悬浮泥沙常同步升高；冬季相对平稳。峰值月份可结合台风、强降雨事件对照分析。悬停曲线可查看该指标的遥感示例。',
    caveat:
      '月度均值会平滑掉短期极端事件；某月缺测较多时曲线可能失真，应结合采样记录判断可信度。'
  },
  {
    id: 'shoreline-rate',
    module: '近海生态环境监测',
    title: '典型岸段年平均冲淤速率（m/年）',
    meaning:
      '基于多期遥感岸线提取计算出的年平均冲淤速率：正值为淤积（岸线向海推进），负值为侵蚀（岸线后退）。',
    howto:
      '柱子位于零线上方（绿）表示淤积，位于零线下方（红）表示侵蚀。绝对值越大变化越快，红色长柱所在岸段应优先安排防护与监测，悬停柱体可查看侵蚀/淤积的现场示意。',
    caveat:
      '台风前后的短期突变会被年均值稀释；河口区受泥沙供应和沿岸工程影响较大，需结合潮位与工程资料综合判断。'
  },
  {
    id: 'redtide-gauge',
    module: '近海生态环境监测',
    title: '赤潮风险指数（模型综合评估）',
    meaning:
      '由叶绿素 a、海表温度、营养盐、光照等因子按权重合成的 0—100 风险指数，用于快速判断赤潮发生的有利程度。',
    howto:
      '绿色区间（低于 40）为低风险，黄色（40—70）为中等风险，红色（高于 70）为高风险。指针越靠右，水体条件越有利于藻类暴发；悬停表盘可查看对应风险等级的水体实景。',
    caveat:
      '这是模型评估值而非实测赤潮；高指数只代表“条件有利”，是否真正发生仍需卫星影像或现场采样确认。'
  },
  {
    id: 'mangrove-area',
    module: '近海生态环境监测',
    title: '海南岛红树林面积长时序变化（km²）',
    meaning:
      '利用多期遥感影像反演得到的海南岛红树林面积，反映保护修复成效与人为干扰情况。',
    howto:
      '关注曲线的长期斜率：整体上行说明修复与保护见效；若某年明显下降，可对照当年的台风登陆、围垦或养殖清退等事件解释。悬停曲线可查看红树林实景。',
    caveat:
      '不同年份影像分辨率与分类方法不同，存在 1—3% 量级的误差，因此看多年趋势比看单年数值更可靠。'
  },
  {
    id: 'typhoon-intensity',
    module: '台风监测预警',
    title: '路径过程风速 / 气压变化',
    meaning:
      '逐时次的台风中心附近最大风速（柱状）与中心气压（折线，对应右侧纵轴），是描述台风强度的两个核心量。',
    howto:
      '风速上升、气压下降同步出现时，说明台风在增强；两者反向变化则为减弱。拐点往往对应登陆、入海或环境条件突变。最右侧几个时次为预报值，悬停可查看台风云系影像。',
    caveat: '预报时次来自不同机构的路径与强度产品，时效越长偏差越大，不能当作确定结论。'
  },
  {
    id: 'typhoon-radius',
    module: '台风监测预警',
    title: '大风风圈半径演变（km）',
    meaning:
      '七级风圈半径，即台风中心附近风力达到 7 级（13.9—17.1 m/s）的圆形范围半径，反映大风影响范围。',
    howto:
      '半径越大，受影响海域越广，港口、航线与养殖区需要更早避风。可结合地图上的风圈图层，直观查看影响到的岸段；悬停曲线可查看风圈与海况影像。',
    caveat:
      '实际风圈并非正圆，会受地形与路径影响；预报时次没有实测风圈数据，因此折线在实况末尾中断属正常现象。'
  },
  {
    id: 'damage-buildings',
    module: '台风灾害评估',
    title: '建筑损毁分级（xBD 模型）',
    meaning:
      '依据 xBD 模型的四级分类（完好、轻微损坏、严重损坏、完全摧毁），统计评估范围内各等级建筑的数量占比。',
    howto:
      '红色扇区（严重损坏 + 完全摧毁）越大，说明破坏越重；蓝色（完好）占比越高，说明建筑抗灾能力较好。可结合右侧市县统计表定位重灾区，悬停扇区可查看对应损毁等级的实景。',
    caveat:
      '未登陆或强度很弱的台风只做风险评估、不产生实际损毁统计；模型结果为遥感推算，用于快速评估，正式灾损仍需现场核查。'
  },
  {
    id: 'damage-ndvi',
    module: '台风灾害评估',
    title: '台风前后海南岛 NDVI 均值时序',
    meaning:
      'NDVI（归一化植被指数）反映植被绿度与覆盖度，取值 -1—1，数值越大表示植被越茂密。',
    howto:
      '对比灾前（绿）与灾后（橙）曲线：灾后明显下凹表示植被受损；之后回升的快慢反映生态恢复速度。红色虚线为登陆日期，是变化的分界点；悬停曲线可查看灾前灾后影像对比。',
    caveat:
      '云污染与季相变化都会影响 NDVI，跨期对比时应尽量选择同一季节、云量相近的影像，避免把季节变化误判为灾损。'
  },
  {
    id: 'archive-pie',
    module: '多源卫星数据中心',
    title: '各卫星归档占比',
    meaning: '数据中心已归档影像按卫星来源统计的数量占比，反映当前数据来源结构。',
    howto:
      '占比最高的是主力数据源，可据此判断覆盖频次与重访能力；各扇区较均衡说明来源多样、容错能力较强。悬停扇区可查看该卫星的代表影像。',
    caveat:
      '数量占比不等于有效覆盖面积：部分卫星单景幅宽小但重访频繁，还需结合云量、分辨率与时间分布一起评估。'
  }
]

onMounted(async () => {
  const id = String(route.query.chart || '')
  if (!id) return
  activeId.value = id
  await nextTick()
  // 直接跳转而不是平滑滚动，避免动画未结束时定位不准
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
})
</script>

<style scoped>
.guide {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 14px 16px;
  overflow: auto;
}
.guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
}
.guide-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main, #eaf4ff);
  letter-spacing: 1px;
}
.guide-sub {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-sub, #8fb4d9);
}
.guide-item {
  padding: 12px 16px 14px;
  border-left: 2px solid transparent;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.guide-item.active {
  border-left-color: #00e5ff;
  box-shadow: inset 0 0 0 1px rgba(0, 229, 255, 0.35), 0 0 16px rgba(0, 229, 255, 0.12);
}
.item-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.item-module {
  padding: 1px 7px;
  font-size: 11px;
  color: #7fb0dd;
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 9px;
  white-space: nowrap;
}
.item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #eaf4ff);
}
.item-row {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.75;
}
.row-label {
  flex: 0 0 56px;
  color: #00e5ff;
}
.row-text {
  flex: 1;
  margin: 0;
  color: var(--text-sub, #bfd7f0);
}
</style>
