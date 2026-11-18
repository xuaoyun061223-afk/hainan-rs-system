# 后端部署方案

面向本项目的 FastAPI 后端（`backend/`），目标是把线上静态站点 https://37kbsx22hrdfiuvvyky.traesite.cn 的数据源从内置演示数据切换为真实接口。

---

## 1. 现状

| 部分 | 现状 |
|------|------|
| 前端 | Vue3 + Vite，静态托管在 traesite，构建时 `VITE_USE_MOCK=true` 使用内置演示数据 |
| 后端 | FastAPI，本地 `127.0.0.1:8000`，通过 Vite proxy 提供 `/api/*` |
| 线上 | 没有后端，`/api/*` 全部 404，因此只能看演示数据 |

本地开发链路：

```
浏览器 → 5173 (Vite dev server) --proxy /api--> 127.0.0.1:8000 (uvicorn)
```

线上需要的链路：

```
浏览器 → https://站点域名 --/api--> https://后端域名 (HTTPS)
```

---

## 2. 后端画像

- 运行时：Python 3.11+
- 依赖：仅 `fastapi`、`uvicorn`（其余全部标准库，HTTP 请求用 `urllib`）
- 端口：`8000`，PaaS 平台通常注入 `$PORT`，启动命令需兼容
- 存储：无数据库、无持久化文件；数据在 `backend/database.py` 中，按日期做确定性扰动
- 状态：进程内字典缓存（`_CACHE`），重启即失效，无需迁移
- 出站访问（部署环境必须能访问公网）：
  - `https://typhoon.slt.zj.gov.cn/Api`（台风实况/预报，超时 4s）
  - `https://api.open-meteo.com/v1/forecast`（气象）
  - `https://marine-api.open-meteo.com/v1/marine`（海温/海浪）
- CORS：`main.py` 中已是 `allow_origins=["*"]`，跨域可直接工作
- 健康检查：`GET /api/health`，返回 `status=ok` 与当日数据日期

结论：单个轻量容器即可运行，1 vCPU / 512 MB 足够。

---

## 3. 平台选型

| 方案 | 优点 | 注意点 | 适用 |
|------|------|--------|------|
| **Zeabur / Railway / Render** | 连 GitHub 自动构建，HTTPS 与域名开箱即用，支持 Dockerfile | 免费额度会休眠，冷启动 10–30s；境外节点国内访问偏慢 | 演示、评审最省事 |
| **阿里云轻量应用服务器 + Docker + Caddy** | 国内访问快、可绑备案域名、成本可控 | 需要自己维护证书与进程 | 正式演示/长期使用 |
| **Fly.io** | 多区域、免费额度可用 | 需要 flyctl，网络配置略繁琐 | 有海外访问需求 |

建议：**优先 Zeabur（快速上线）**，需要国内访问速度时迁到**阿里云轻量 + Docker**。

---

## 4. 部署文件（已生成）

### 4.1 `backend/requirements.txt`（当前缺失）

```txt
fastapi>=0.110,<1.0
uvicorn[standard]>=0.29,<1.0
```

### 4.2 `Dockerfile`（放在仓库根目录）

```dockerfile
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    TZ=Asia/Shanghai

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### 4.3 `.dockerignore`

```
**/__pycache__
**/*.pyc
node_modules
dist
.git
```

### 4.4 单端口模式（可选）

`main.py` 已经处理过：如果镜像内存在 `dist/` 目录（`backend` 的上一级），会把前端一并托管。若希望**一个域名同时提供页面和接口**，可在 Dockerfile 中加上前端构建产物：

```dockerfile
COPY dist/ /dist/
```

此时访问 `https://后端域名/` 直接就是系统页面，前端无需配置 API 域名，CORS 问题也随之消失。缺点是每次前端改动都要重新构建镜像。

---

## 5. 前端改造：支持独立 API 域名

当前 `src/api/index.js` 使用相对路径 `/api/...`，只适合同域或本地 proxy。分离部署时需要支持基地址（已完成）：

`src/api/index.js` 顶部：

```js
// 部署时通过 VITE_API_BASE 指定后端地址，如 https://api.example.com
const API_BASE = import.meta.env.VITE_API_BASE || ''

function api(url) {
  return fetch(API_BASE + url).then((r) => {
    if (!r.ok) throw new Error(`API ${r.status}: ${url}`)
    return r.json()
  })
}
```

线上构建命令：

```bash
# Windows PowerShell
$env:VITE_USE_MOCK='false'; $env:VITE_API_BASE='https://api.example.com'; npm run build
```

```bash
# bash
VITE_USE_MOCK=false VITE_API_BASE=https://api.example.com npm run build
```

两种部署形态对照：

| 形态 | `VITE_USE_MOCK` | `VITE_API_BASE` | 说明 |
|------|-----------------|-----------------|------|
| 当前（演示） | `true` | 空 | 纯静态，内置数据 |
| 前后端分离 | `false` | `https://api.example.com` | 前端静态托管 + 独立后端 |
| 单端口 | `false` | 空 | 后端同时托管 `dist/` |

---

## 6. 部署步骤（以 Docker 为准）

1. 补齐 `requirements.txt`、`Dockerfile`、`.dockerignore`（已完成）。
2. 本地验证镜像（已完成）：

   ```bash
   docker build -t hainan-rs-api .
   docker run --rm -p 8000:8000 hainan-rs-api
   curl http://127.0.0.1:8000/api/health
   ```

   验证结果：镜像 258 MB，容器 `/api/health` 返回 `status=ok`，`/api/overview` 返回 6 个站点。

   > 本机网络环境说明：直连 Docker Hub 会超时，已在 Docker Desktop 中把 HTTP/HTTPS 代理配置为 `http://127.0.0.1:7897`；构建时容器内 pip 需要额外传入构建参数：
   >
   > ```bash
   > docker build -t hainan-rs-api \
   >   --build-arg HTTP_PROXY=http://host.docker.internal:7897 \
   >   --build-arg HTTPS_PROXY=http://host.docker.internal:7897 \
   >   --build-arg NO_PROXY=localhost,127.0.0.1 .
   > ```

3. 推送到代码托管平台，在 Zeabur / Render / 阿里云上创建服务：
   - 构建：Dockerfile
   - 端口：8000（或读取 `$PORT`）
   - 健康检查：`/api/health`
4. 绑定 HTTPS 域名，记录为 `API_BASE`。
5. 按第 5 节以 `VITE_USE_MOCK=false`、`VITE_API_BASE=<后端域名>` 构建前端。
6. 重新部署前端静态站点，验证页面数据来自后端。

---

## 7. 部署后检查清单

- [ ] `GET /api/health` 返回 `{"status":"ok","dataDate":"..."}`
- [ ] `GET /api/overview`、`/api/typhoon/list` 返回非空数据
- [ ] 浏览器 Network 中 `/api/*` 为 200，无 CORS 报错
- [ ] 首页台风名称、观测时间与后端一致
- [ ] 仪表盘统计卡片、图表、地图站点均来自接口
- [ ] 连续访问两次，第二次命中进程内缓存（响应明显变快）

---

## 8. 运行与运维注意

- **冷启动**：PaaS 空闲休眠后首次请求会慢 10–30s，评审演示前先访问一次 `/api/health` 预热。
- **外部接口失败**：`live_data.py` 已有超时与失败缓存回退，台风接口不可用时页面会退化，不会白屏。
- **时区**：容器设置 `TZ=Asia/Shanghai`，与 `now_cn()` 保持一致。
- **CORS**：上线稳定后建议把 `allow_origins=["*"]` 收窄为实际站点域名。
- **限流**：接口无鉴权，公网暴露时建议在网关层加 QPS 限制（PaaS 一般自带）。
- **缓存**：当前为进程内缓存，多副本部署时各副本独立，数据可能短暂不一致；单副本部署无此问题。
- **日志**：uvicorn 默认输出访问日志，平台控制台可直接查看；排障优先看 4xx/5xx 与外部接口超时。

---

## 9. 成本与工作量参考

- Zeabur / Render 免费层：0 成本，够演示使用
- 阿里云轻量 2C2G：约 60–100 元/月起（视活动），可长期稳定运行
- 代码改动：新增 3 个部署文件 + 前端 `api/index.js` 约 5 行改造

---

## 10. 推荐执行顺序

1. 先补 `requirements.txt` / `Dockerfile`，本地 `docker run` 跑通
2. 部署到 Zeabur（最快拿到 HTTPS 域名）
3. 前端加 `VITE_API_BASE`，用真实后端重新构建并部署
4. 验收第 7 节清单
5. 若国内访问慢，再迁移到阿里云轻量
