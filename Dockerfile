# ---------- 阶段 1：构建前端（含 Cesium 静态资源） ----------
FROM node:20-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- 阶段 2：运行时（FastAPI 同时提供 API 与前端静态页面） ----------
FROM python:3.12-slim
WORKDIR /app/backend

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/backend/
COPY --from=frontend /build/dist /app/dist

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
