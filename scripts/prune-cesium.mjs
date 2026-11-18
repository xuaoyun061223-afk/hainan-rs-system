// Cesium 构建产物自带默认地球纹理（NaturalEarthII）与月球贴图；
// 本项目底图使用高德影像且不显示月球，构建后剔除这些未使用资源，
// 减少部署产物的文件数量。
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const texturesDir = join(process.cwd(), 'dist', 'cesium', 'Assets', 'Textures')
rmSync(join(texturesDir, 'NaturalEarthII'), { recursive: true, force: true })
rmSync(join(texturesDir, 'moonSmall.jpg'), { force: true })
