<template>
  <div ref="containerEl" class="cesium-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as Cesium from 'cesium'
import { loadHainanOutline } from '@/utils/hainanOutline'

const props = defineProps({
  // 台风路径点：[{ lon, lat, grade, wind, pressure, radius, t }]
  track: { type: Array, default: () => [] },
  // 是否显示七级风圈
  showWindCircle: { type: Boolean, default: true },
  // 相机初始视角：[lon, lat, height]
  cameraView: { type: Array, default: () => [109.5, 19.0, 600000] },
  // 是否显示海南岛轮廓
  showHainanOutline: { type: Boolean, default: true },
  // 登陆点所在市县（用于标注"登陆点 · 文昌"）
  landfallCity: { type: String, default: '' },
  // 淹没区多边形
  inundation: { type: Array, default: () => [] }
})

const containerEl = ref(null)
let viewer = null
let resizeObserver = null
let trackEntities = []
let outlineEntity = null
let inundationEntities = []
let landfallEntity = null

const gradeColor = (grade) => {
  const g = grade || ''
  if (g.includes('超强')) return Cesium.Color.fromCssColorString('#cf1322')
  if (g.includes('强台风')) return Cesium.Color.fromCssColorString('#ff4d4f')
  if (g === '台风' || g.includes('台风(登陆)')) return Cesium.Color.fromCssColorString('#ff7a45')
  if (g.includes('强热带')) return Cesium.Color.fromCssColorString('#ff9c40')
  return Cesium.Color.fromCssColorString('#ffd666')
}

// 海南岛轮廓（[经度, 纬度]）：先给近似轮廓，真实海岸线公共 JSON 到达后替换
let hainanOutline = [
  [110.62, 20.12], [110.98, 20.06], [111.07, 19.86], [110.86, 19.55],
  [110.98, 19.3], [110.62, 18.86], [110.32, 18.46], [110.06, 18.26],
  [109.76, 18.2], [109.4, 18.3], [109.06, 18.46], [108.7, 18.72],
  [108.62, 19.06], [108.76, 19.42], [109.06, 19.66], [109.3, 19.92],
  [109.66, 20.06], [110.1, 20.14], [110.42, 20.16]
]

function clearTrack() {
  trackEntities.forEach((e) => viewer.entities.remove(e))
  trackEntities = []
  if (landfallEntity) {
    viewer.entities.remove(landfallEntity)
    landfallEntity = null
  }
}

function drawTrack() {
  if (!props.track.length) return
  clearTrack()

  const positions = props.track.map((p) =>
    Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 2000)
  )

  // 分段彩色路径线
  for (let i = 0; i < positions.length - 1; i++) {
    const color = gradeColor(props.track[i + 1].grade)
    const line = viewer.entities.add({
      polyline: {
        positions: [positions[i], positions[i + 1]],
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: color
        }),
        clampToGround: false
      }
    })
    trackEntities.push(line)
  }

  // 各路径点
  props.track.forEach((p, idx) => {
    const isLandfall = (p.grade || '').includes('登陆')
    const color = gradeColor(p.grade)

    if (isLandfall) {
      // 登陆点：脉冲式 billboard
      landfallEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 3000),
        point: {
          pixelSize: 16,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: `登陆点${props.landfallCity ? ' · ' + props.landfallCity : ''}`,
          font: '13px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0d2244')
        }
      })
      trackEntities.push(landfallEntity)
    } else {
      const point = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 2000),
        point: {
          pixelSize: 8,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1
        },
        label: {
          text: p.t,
          font: '11px sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#9fc4ef'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          showBackground: false
        }
      })
      trackEntities.push(point)
    }
  })

  // 七级风圈椭圆
  if (props.showWindCircle) {
    const landfallPt = props.track.find((p) => (p.grade || '').includes('登陆')) || props.track[0]
    if (landfallPt) {
      const circle = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(landfallPt.lon, landfallPt.lat, 100),
        ellipse: {
          semiMajorAxis: landfallPt.radius * 1000,
          semiMinorAxis: landfallPt.radius * 1000,
          height: 100,
          material: Cesium.Color.fromCssColorString('#ff5c5c').withAlpha(0.15),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#ff5c5c')
        }
      })
      trackEntities.push(circle)
    }
  }

  // 相机对准整条路径：按轨迹外接矩形给定视角高度，
  // 避免原来「半程点 + 固定 500 km」只能看到路径一小段。
  // 轨迹整体远离海南（最近点也在约 800 km 外）时，视野仍以海南岛为主，
  // 否则为了装下远海轨迹会把海南岛缩成一个点。
  const near = props.track.some((p) => {
    const dx = (p.lon - 109.85) * Math.cos((((p.lat || 0) + 19.35) / 2) * Math.PI / 180) * 111
    const dy = (p.lat - 19.35) * 111
    return Math.sqrt(dx * dx + dy * dy) <= 800
  })
  const lons = props.track.map((p) => p.lon)
  const lats = props.track.map((p) => p.lat)
  const west = near ? Math.min(...lons) - 1.5 : 108.4
  const east = near ? Math.max(...lons) + 1.5 : 111.3
  const south = near ? Math.min(...lats) - 1.5 : 17.8
  const north = near ? Math.max(...lats) + 1.5 : 20.3
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(
      Math.min(west, 108.4), Math.min(south, 17.8),
      Math.max(east, 111.3), Math.max(north, 20.3)
    ),
    duration: 1.5
  })
  viewer.scene.requestRender()
}

function drawHainan() {
  if (!props.showHainanOutline) return
  if (outlineEntity) {
    viewer.entities.remove(outlineEntity)
    outlineEntity = null
  }
  const pts = hainanOutline.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  if (pts.length < 3) return
  const positions = pts.map(([lon, lat]) =>
    Cesium.Cartesian3.fromDegrees(lon, lat, 0)
  )
  outlineEntity = viewer.entities.add({
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(positions),
      material: Cesium.Color.fromCssColorString('#123f73').withAlpha(0.3),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('#00e5ff'),
      height: 0
    }
  })
}

function drawInundation() {
  inundationEntities.forEach((e) => viewer.entities.remove(e))
  inundationEntities = []
  if (!props.inundation.length) return
  props.inundation.forEach((ring) => {
    const positions = ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0))
    const e = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.fromCssColorString('#ffb02e').withAlpha(0.35),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#ffb02e'),
        height: 0
      }
    })
    inundationEntities.push(e)
  })
}

watch(() => props.track, drawTrack, { deep: true })
watch(() => props.inundation, drawInundation, { deep: true })

onMounted(() => {
  // 不使用 Cesium Ion 默认服务，避免 token 验证失败
  Cesium.Ion.defaultAccessToken = ''

  viewer = new Cesium.Viewer(containerEl.value, {
    animation: false,
    baseLayer: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    // 按需渲染：仅在场景变化时绘制，避免 60fps 持续渲染 + 瓦片请求导致页面持续 busy
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    creditContainer: document.createElement('div')
  })

  // 手动添加高德卫星影像底图
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      subdomains: ['1', '2', '3', '4'],
      maximumLevel: 18
    })
  )

  // 深色太空背景
  viewer.scene.globe.enableLighting = false
  viewer.scene.skyBox.show = false
  viewer.scene.skyAtmosphere.show = true
  viewer.scene.skyAtmosphere.hueShift = -0.5
  viewer.scene.skyAtmosphere.saturationShift = -0.2
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#060d1f')
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#06112a')

  // 初始相机
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      props.cameraView[0], props.cameraView[1], props.cameraView[2]
    ),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0
    }
  })

  drawHainan()
  drawTrack()
  drawInundation()

  // 真实海岸线轮廓到达后重绘岛形
  loadHainanOutline().then((pts) => {
    if (!viewer) return
    hainanOutline = pts
    drawHainan()
    viewer.scene.requestRender()
  })

  // 相机操控调节：Cesium 默认为"自由球体"操控，惯性大、自由度多，
  // 拖动后镜头会继续滑行一段距离，稍一用力就转过头，很难停到目标位置。
  // 这里降低惯性、收起自由视角、收紧缩放范围，让操作手感接近二维地图。
  // 相机控制器在不同版本里挂在 viewer 或 scene 上，两种都兼容取值
  const ctrl = viewer.screenSpaceCameraController || viewer.scene.screenSpaceCameraController
  if (ctrl) {
    ctrl.inertiaSpin = 0.06        // 松开鼠标后几乎立即停住，不再"甩出去"
    ctrl.inertiaTranslate = 0.06
    ctrl.inertiaZoom = 0.15
    ctrl.enableLook = false        // 禁用自由视角，避免镜头被拖歪、出现倾斜地平线
    ctrl.enableTilt = false        // 关闭 Shift/Ctrl 拖拽的倾斜手势
    ctrl.enableCollisionDetection = true   // 防止镜头穿到地平面以下
    ctrl.minimumZoomDistance = 2000        // 最近 2 km
    ctrl.maximumZoomDistance = 12000000    // 最远约 1.2 万 km，避免缩到看不清海南岛
    ctrl.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG]
    ctrl.zoomEventTypes = [
      Cesium.CameraEventType.RIGHT_DRAG,
      Cesium.CameraEventType.WHEEL,
      Cesium.CameraEventType.PINCH
    ]

    // ---- 旋转灵敏度（唯一需要调的常量）----
    // Cesium 三维旋转速率 = (相机到地心距离 - 地球半径) / 地球半径，由相机高度决定，
    // 没有公开参数可以缩放；而且控制器每帧都会在 update() 里把它重置回去。
    // 因此在每帧 update 之后按 ROTATE_SENSITIVITY 缩放旋转速率，
    // 相当于"拖动同样的距离，地球只转默认的这么多"：
    //   1.0 = Cesium 默认手感；0.4 = 只有默认的四成；0.2 = 很稳，适合远距离定位。
    const ROTATE_SENSITIVITY = 0.4
    const earthRadius = viewer.scene.ellipsoid.maximumRadius
    const baseUpdate = ctrl.update.bind(ctrl)
    ctrl.update = () => {
      baseUpdate()
      ctrl._rotateFactor = ROTATE_SENSITIVITY / earthRadius
      ctrl._rotateRateRangeAdjustment = earthRadius
    }
    // 快速甩动时，单次位移最多按画布宽度的 8% 计算，避免一下转过大半圈
    ctrl.maximumMovementRatio = 0.08
  }

  viewer.scene.requestRender()

  // 容器尺寸变化（侧栏切换、窗口缩放）时主动同步 canvas 分辨率，
  // 并在挂载后的下一帧强制重算一次，避免首帧取到 0 尺寸
  viewer.resize()
  requestAnimationFrame(() => viewer && viewer.resize())
  resizeObserver = new ResizeObserver(() => {
    if (viewer && !viewer.isDestroyed()) viewer.resize()
  })
  resizeObserver.observe(containerEl.value)
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
</script>

<style scoped>
.cesium-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #060d1f;
}
.cesium-container :deep(.cesium-viewer-bottom) {
  display: none;
}
</style>
