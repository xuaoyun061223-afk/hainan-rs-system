// 图表悬停时展示的实景/影像示例（图片来源：Wikimedia Commons 公共版权或知识共享授权）
// key 与图表数据项名称一致；数据项也可用 __media 指定图片 key
export const chartMedia = {
  'water-grade': {
    一类水质: {
      label: '一类水质',
      img: '/guide/water-grade-grade1.jpg',
      desc: '海水清澈见底，适用于海洋渔业、珍稀濒危海洋生物保护区'
    },
    二类水质: {
      label: '二类水质',
      img: '/guide/water-grade-grade2.jpg',
      desc: '水质良好，适用于水产养殖、海水浴场及滨海旅游'
    },
    三类水质: {
      label: '三类水质',
      img: '/guide/water-grade-grade3.jpg',
      desc: '水质尚可，藻类增多，适用于工业用水及一般滨海区域'
    },
    四类及劣四类: {
      label: '四类及劣四类',
      img: '/guide/water-grade-grade4.jpg',
      desc: '污染明显，多位于河口、港湾与养殖密集区，需重点治理'
    }
  },
  'satellite-week': {
    光学: {
      label: '光学影像',
      img: '/guide/satellite-week-optical.jpg',
      unit: ' 景',
      desc: 'Sentinel-2 等真彩色影像，晴天质量最好，可用于水色与岸线识别'
    },
    SAR: {
      label: 'SAR 影像',
      img: '/guide/satellite-week-sar.jpg',
      unit: ' 景',
      desc: 'Sentinel-1 等雷达影像，可穿透云雨，适合台风期间应急观测'
    }
  },
  'chla-rank': {
    'chl-low': {
      label: '低浓度',
      img: '/guide/chla-rank-low.jpg',
      unit: ' mg/m³',
      desc: '水体清澈，浮游植物稀少，富营养化风险低'
    },
    'chl-mid': {
      label: '中浓度',
      img: '/guide/chla-rank-mid.jpg',
      unit: ' mg/m³',
      desc: '水体出现绿色藻类迹象，需关注营养盐输入'
    },
    'chl-high': {
      label: '高浓度',
      img: '/guide/chla-rank-high.jpg',
      unit: ' mg/m³',
      desc: '藻类大量繁殖，赤潮风险高，建议加密监测'
    }
  },
  'ecology-trend': {
    '叶绿素 a': {
      label: '叶绿素 a',
      img: '/guide/ecology-trend-chla.jpg',
      unit: ' mg/m³',
      desc: '水色反演影像：绿色为藻类浓度较高的区域'
    },
    悬浮泥沙: {
      label: '悬浮泥沙',
      img: '/guide/ecology-trend-spm.jpg',
      unit: ' mg/L',
      desc: '河口泥沙羽流在遥感影像中呈黄褐色条带'
    },
    海表温度: {
      label: '海表温度',
      img: '/guide/ecology-trend-sst.jpg',
      unit: ' ℃',
      desc: '热红外反演的海表温度分布，暖色表示高温区'
    }
  },
  'shoreline-rate': {
    erosion: {
      label: '侵蚀后退',
      img: '/guide/shoreline-rate-erosion.jpg',
      unit: ' m/年',
      desc: '岸线向陆地方向后退，常见于缺乏泥沙补给的岸段'
    },
    accretion: {
      label: '淤积推进',
      img: '/guide/shoreline-rate-accretion.jpg',
      unit: ' m/年',
      desc: '泥沙沉积使岸线向海推进，滩面变宽'
    }
  },
  'redtide-gauge': {
    'risk-low': {
      label: '低风险',
      img: '/guide/redtide-gauge-risk-low.jpg',
      unit: ' 分',
      desc: '水质清澈、藻类稀少，赤潮发生条件不具备'
    },
    'risk-mid': {
      label: '中风险',
      img: '/guide/redtide-gauge-risk-mid.jpg',
      unit: ' 分',
      desc: '水面出现薄层藻膜，需关注水温与营养盐变化'
    },
    'risk-high': {
      label: '高风险',
      img: '/guide/redtide-gauge-risk-high.jpg',
      unit: ' 分',
      desc: '藻华大面积覆盖水面，赤潮暴发可能性高'
    }
  },
  'mangrove-area': {
    红树林面积: {
      label: '红树林',
      img: '/guide/mangrove-area-mature.jpg',
      unit: ' km²',
      desc: '密集的红树林覆盖潮间带，是海岸带重要的生态屏障'
    }
  },
  'typhoon-intensity': {
    最大风速: {
      label: '台风云系',
      img: '/guide/typhoon-intensity-strong.jpg',
      unit: ' m/s',
      desc: '卫星云图可见紧密螺旋云带与清晰台风眼，对应强风速'
    },
    中心气压: {
      label: '台风眼区',
      img: '/guide/typhoon-radius-radius.jpg',
      unit: ' hPa',
      desc: '中心气压越低，眼区越清晰，台风强度越强'
    }
  },
  'typhoon-radius': {
    七级风圈半径: {
      label: '七级风圈',
      img: '/guide/typhoon-radius-impact.jpg',
      unit: ' km',
      desc: '大风范围覆盖海面，出现大片白浪，船只应提前避风'
    }
  },
  'damage-buildings': {
    无损坏: {
      label: '基本完好',
      img: '/guide/damage-buildings-intact.jpg',
      desc: '建筑主体与屋顶完整，无明显结构损伤'
    },
    轻微损坏: {
      label: '轻微损坏',
      img: '/guide/damage-buildings-intact.jpg',
      desc: '屋顶或围护结构局部受损，主体结构仍可使用'
    },
    严重损坏: {
      label: '严重损坏',
      img: '/guide/damage-buildings-destroyed.jpg',
      desc: '屋顶大面积坍塌，墙体开裂，需评估后使用'
    },
    完全摧毁: {
      label: '完全摧毁',
      img: '/guide/damage-buildings-destroyed.jpg',
      desc: '建筑结构整体垮塌，现场多为废墟与散落构件'
    }
  },
  'damage-ndvi': {
    '灾前 NDVI': {
      label: '灾前植被',
      img: '/guide/damage-ndvi-before.jpg',
      desc: '台风登陆前，全岛植被覆盖浓密、绿度高'
    },
    '灾后 NDVI': {
      label: '灾后植被',
      img: '/guide/damage-ndvi-after.jpg',
      desc: '台风过境后，植被出现成片受损的褐色斑块'
    }
  },
  'archive-pie': {
    s1: {
      label: 'Sentinel-1',
      img: '/guide/archive-pie-s1.jpg',
      desc: 'C 波段雷达影像，全天时全天候观测'
    },
    s2: {
      label: 'Sentinel-2',
      img: '/guide/archive-pie-s2.jpg',
      desc: '多光谱光学影像，10 m 分辨率，用于水色与植被监测'
    },
    gf: {
      label: '高分系列',
      img: '/guide/archive-pie-gf.jpg',
      desc: '国产高分辨率光学影像，用于精细目标识别'
    }
  }
}
