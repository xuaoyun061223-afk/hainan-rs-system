// 数据模块：静态导入第 1 步从本地 FastAPI 后端采集到的全部 JSON 响应。
// 使用 JSON import attributes（with { type: 'json' }）：Node 20.10+ 原生支持；
// Netlify 构建函数时由 esbuild 打包，JSON 会被内联进函数产物，因此无需运行时
// 读取文件，也无需在 netlify.toml 配置 included_files。
import routeIndex from './data/index.json' with { type: 'json' }

import hainanOutline from './data/hainan-outline.json' with { type: 'json' }
import stations from './data/stations.json' with { type: 'json' }
import alerts from './data/alerts.json' with { type: 'json' }
import overview from './data/overview.json' with { type: 'json' }
import weeklyScenes from './data/weekly-scenes.json' with { type: 'json' }
import waterGrade from './data/water-grade.json' with { type: 'json' }
import ecologyShoreline from './data/ecology-shoreline.json' with { type: 'json' }
import ecologyMangrove from './data/ecology-mangrove.json' with { type: 'json' }
import typhoonList from './data/typhoon-list.json' with { type: 'json' }
import damageSummary from './data/damage-summary.json' with { type: 'json' }
import damageBuilding from './data/damage-building.json' with { type: 'json' }
import damageNdvi from './data/damage-ndvi.json' with { type: 'json' }
import damageCity from './data/damage-city.json' with { type: 'json' }
import damageInundation from './data/damage-inundation.json' with { type: 'json' }
import satelliteCatalog from './data/satellite-catalog.json' with { type: 'json' }

import chlaS01 from './data/chla-S01.json' with { type: 'json' }
import chlaS02 from './data/chla-S02.json' with { type: 'json' }
import chlaS03 from './data/chla-S03.json' with { type: 'json' }
import chlaS04 from './data/chla-S04.json' with { type: 'json' }
import chlaS05 from './data/chla-S05.json' with { type: 'json' }
import chlaS06 from './data/chla-S06.json' with { type: 'json' }

import sstS01 from './data/sst-S01.json' with { type: 'json' }
import sstS02 from './data/sst-S02.json' with { type: 'json' }
import sstS03 from './data/sst-S03.json' with { type: 'json' }
import sstS04 from './data/sst-S04.json' with { type: 'json' }
import sstS05 from './data/sst-S05.json' with { type: 'json' }
import sstS06 from './data/sst-S06.json' with { type: 'json' }

import track1409 from './data/track-1409.json' with { type: 'json' }
import track2017 from './data/track-2017.json' with { type: 'json' }
import track2118 from './data/track-2118.json' with { type: 'json' }
import track2220 from './data/track-2220.json' with { type: 'json' }
import track2411 from './data/track-2411.json' with { type: 'json' }

export { routeIndex }

export const files = {
  'hainan-outline.json': hainanOutline,
  'stations.json': stations,
  'alerts.json': alerts,
  'overview.json': overview,
  'weekly-scenes.json': weeklyScenes,
  'water-grade.json': waterGrade,
  'ecology-shoreline.json': ecologyShoreline,
  'ecology-mangrove.json': ecologyMangrove,
  'typhoon-list.json': typhoonList,
  'damage-summary.json': damageSummary,
  'damage-building.json': damageBuilding,
  'damage-ndvi.json': damageNdvi,
  'damage-city.json': damageCity,
  'damage-inundation.json': damageInundation,
  'satellite-catalog.json': satelliteCatalog,
  'chla-S01.json': chlaS01,
  'chla-S02.json': chlaS02,
  'chla-S03.json': chlaS03,
  'chla-S04.json': chlaS04,
  'chla-S05.json': chlaS05,
  'chla-S06.json': chlaS06,
  'sst-S01.json': sstS01,
  'sst-S02.json': sstS02,
  'sst-S03.json': sstS03,
  'sst-S04.json': sstS04,
  'sst-S05.json': sstS05,
  'sst-S06.json': sstS06,
  'track-1409.json': track1409,
  'track-2017.json': track2017,
  'track-2118.json': track2118,
  'track-2220.json': track2220,
  'track-2411.json': track2411,
}
