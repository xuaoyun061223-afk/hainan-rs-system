# 自动发布（Netlify Deploy Hook）

线上站点：<https://dazzling-frangipane-0a0b3c.netlify.app>
构建方式：Netlify 读取 `netlify.toml`（`npm run build` → 发布 `dist`，函数目录 `netlify/functions`）。

Netlify 自带的「推送即构建」偶发不触发，表现为：代码已 push、线上仍是旧包
（例如 `index.html` 里还是上一次的 `assets/index-XXXX.js`），只能到面板点 Trigger deploy。
Deploy Hook 就是把这个按钮变成一条链接，让 GitHub Actions 或本地脚本替我们点。

## 1. 在 Netlify 创建 Deploy Hook

1. 打开 <https://app.netlify.com/> → 选择站点 `dazzling-frangipane-0a0b3c`。
2. 进入 **Site configuration** → 左侧 **Build & deploy** → **Continuous Deployment**（部分界面在
   **Deploy hooks** 分区）→ **Deploy hooks** → **Add deploy hook**。
3. 填写：
   - Hook name：`github-auto`
   - Branch to build：`main`
   - 触发方式：保持默认（另有一个 `Trigger deploy` 按钮）
4. 保存后复制生成的地址，形如：

   ```
   https://api.netlify.com/build_hooks/6xxxxxxxxxxxxxxxxxxxx
   ```

> 这条链接等于「发布权限」，任何拿到它的人都能触发构建，**不要提交到仓库、不要贴到公开聊天里**。

## 2. 让 GitHub 每次 push 到 main 都自动发布（推荐）

1. 打开仓库 <https://github.com/xuaoyun061223-afk/hainan-rs-system> → **Settings** →
   **Secrets and variables** → **Actions** → **New repository secret**。
2. Name 填 `NETLIFY_BUILD_HOOK`，Secret 粘贴上一步的 hook 地址，保存。
3. 之后每次 push 到 `main`，仓库里的 `.github/workflows/netlify-deploy.yml` 会自动 POST 到该 hook，
   触发 Netlify 构建；也可以在 Actions 页手动 **Run workflow** 重跑一次发布。

未配置该 secret 时，工作流只输出一条 warning 并跳过，不会失败。

## 3. 本地手动触发（可选，二选一即可）

- 写文件：把 hook 地址保存到项目根目录 `.netlify-hook-url`（已在 `.gitignore` 里忽略），然后

  ```powershell
  python scripts/trigger_deploy.py
  ```

- 或临时用环境变量 / 直接传参：

  ```powershell
  $env:NETLIFY_BUILD_HOOK = "<hook 地址>"
  python scripts/trigger_deploy.py
  # 或
  python scripts/trigger_deploy.py --hook "<hook 地址>"
  ```

配置好 hook 后，数据同步脚本也会自动发布：

```powershell
python scripts/sync_data.py    # 采集 → 提交 → 推送 → 调用 Deploy Hook
```

## 4. 验证是否发布成功

1. Netlify → **Deploys**：应出现一条以 `main@<sha>` 开头、状态 `Published` 的部署。
2. 检查线上引用的包名是否更新：

   ```powershell
   (Invoke-WebRequest -UseBasicParsing "https://dazzling-frangipane-0a0b3c.netlify.app/").Content
   ```

   输出里的 `assets/index-*.js` 应与本地 `dist/index.html` 中的一致。

## 5. 常见问题

- **HTTP 404 / 触发失败**：hook 被删除或地址复制不全，重新创建并更新 secret。
- **Netlify 面板显示构建被跳过**：检查是否还有额度（Free 计划每月 300 build minutes），
  或在 **Build & deploy** → **Build settings** 里确认未暂停自动构建。
- **hook 触发了但构建失败**：说明发布链路已通，问题在构建本身，看 Deploys 里的构建日志。
- **分支不对**：hook 的 Branch to build 必须是 `main`，与仓库默认分支一致。
