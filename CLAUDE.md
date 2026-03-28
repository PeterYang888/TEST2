# Slot Machine Data Recorder

Tampermonkey userscript，自動記錄網頁老虎機遊戲的旋轉數據並匯出 CSV。

## 快速開始

### 建置
```bash
npm run build    # 產生 dist/slot-recorder.user.js
```

### 安裝
1. 安裝 Tampermonkey 瀏覽器擴充功能
2. Chrome 需開啟：`chrome://extensions` → 開發人員模式 + 允許用戶腳本
3. Tampermonkey → 建立新腳本 → 貼上 `dist/slot-recorder.user.js` 全部內容 → `Ctrl+S`

### 使用
1. 開啟老虎機遊戲頁面，右下角出現 **Slot Recorder** 面板
2. 點「設定」→ 選預設範本（如 Pragmatic Play）→ 儲存
3. 點「Debug Log」→ Spin 一次 → 點擊請求確認欄位映射正確
4. 點「開始錄製」→ 正常遊玩
5. 點「匯出 CSV」下載記錄

## 架構

```
src/
  meta.js          # ==UserScript== 標頭（@grant none，無沙盒）
  config.js        # 設定管理 + 預設範本（PP, NetEnt, PG Soft）
  interceptor.js   # XHR/Fetch/WebSocket 攔截器（直接 patch）
  parser.js        # JSON path 解析 + URL-encoded 解析
  recorder.js      # 記憶體儲存 + CSV 匯出
  ui.js            # Shadow DOM 浮動面板 + 設定精靈 + JSON 檢視器
  ocr-fallback.js  # 可選的 Canvas OCR（需 Tesseract.js）
  main.js          # 初始化入口
build.js           # 串接 src/ → dist/slot-recorder.user.js
```

## 技術重點

### @grant none 模式
使用 `@grant none` 讓腳本直接在頁面環境執行，不經過 Tampermonkey 沙盒。
這是因為沙盒模式下 `unsafeWindow` 和 `<script>` 注入都無法可靠地 monkey-patch
遊戲的 XMLHttpRequest。設定使用 `localStorage` 持久化。

### Pragmatic Play 格式
PP 遊戲的 API（`gameService` 端點）回傳 **URL-encoded query string**，不是 JSON：
```
tw=0.50&balance=736.00&rid=115119017568035&c=0.05&l=20&s=11,11,6,4,...&accv=21&rmul=12~4~8;12~26~5
```
`parseQueryString()` 負責解析這種格式。

### PP 欄位對照
| CSV 欄位     | PP 欄位  | 說明                              |
|-------------|---------|-----------------------------------|
| balance     | balance | 餘額                              |
| winAmount   | tw      | 本輪總贏得                         |
| betAmount   | c       | 每線幣值（總下注 = c × l）          |
| betLines    | l       | 線數 (通常 20)                     |
| reels       | s       | 轉輪圖案 (6×5 = 30 個符號)          |
| multiplier  | accv    | 累計倍率（宙斯符號倍率總和）          |
| spinId      | rid     | 旋轉 ID                           |
| extra1      | w       | 單次 cascade 贏得                  |
| extra2      | na      | 下一步動作 (s=spin, c=collect)      |
| extra3      | rmul    | 倍率符號位置 (如 12~4~8;12~26~5)    |

### iframe 注意事項
PP 遊戲在 iframe 中載入（`*.ilomhzji.biz`）。Tampermonkey 需設定：
- 腳本設定 → 「只在最上層頁框執行」→ **否**
- 自訂 matches 可加入 `*://*.ilomhzji.biz/*`（域名可能每次不同）

## 新增其他遊戲平台
1. 在 `config.js` 的 `PRESET_PROFILES` 中加入新的預設
2. 用 Debug Log + Network 分頁找出 API 端點和回應格式
3. 填入正確的 `urlPattern` 和 `fieldMappings`
4. `npm run build` 重建
