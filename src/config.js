// ─── Configuration Management ───

const DEFAULT_CONFIG = {
  active: false,
  activeProfile: '',
  urlPattern: '',
  debugMode: true,
  ocrEnabled: false,
  fieldMappings: {
    balance:        '',
    winAmount:      '',
    betAmount:      '',
    betLines:       '',
    reels:          '',
    freeSpins:      '',
    bonusTriggered: '',
    multiplier:     '',
    gameId:         '',
    spinId:         '',
    extra1:         '',
    extra2:         '',
    extra3:         '',
  },
  ocrRegions: [],
};

// ─── Preset Profiles for Known Platforms ───
// These are common JSON path patterns. Actual paths may vary by operator/casino.
// Users should verify with Debug Log and adjust if needed.

var PRESET_PROFILES = {
  'pragmatic-play': {
    name: 'Pragmatic Play (Gates of Olympus 等)',
    urlPattern: 'gameService',
    note: 'PP 遊戲回傳 URL-encoded 格式。總下注 = c × l（幣值 × 線數）。',
    fieldMappings: {
      balance:        'balance',
      winAmount:      'tw',
      betAmount:      'c',
      betLines:       'l',
      reels:          's',
      freeSpins:      'na',
      bonusTriggered: 'bl',
      multiplier:     'rs_m',
      gameId:         'counter',
      spinId:         'rid',
      extra1:         'w',
      extra2:         'na',
      extra3:         'tmb',
    },
  },
  'netent': {
    name: 'NetEnt / Evolution',
    urlPattern: 'netent|casinomodule|evolution',
    note: '適用於 NetEnt 系列遊戲。部分遊戲可能使用 WebSocket。',
    fieldMappings: {
      balance:        'balance',
      winAmount:      'winAmount',
      betAmount:      'betAmount',
      betLines:       'lines',
      reels:          'reelSet',
      freeSpins:      'freeSpins',
      bonusTriggered: 'bonusGame',
      multiplier:     'multiplier',
      gameId:         'gameId',
      spinId:         'roundId',
    },
  },
  'pg-soft': {
    name: 'PG Soft',
    urlPattern: 'pgsoft|pocket-games',
    note: '適用於 PG Soft 系列遊戲。',
    fieldMappings: {
      balance:        'dt.bl',
      winAmount:      'dt.tw',
      betAmount:      'dt.bt',
      betLines:       '',
      reels:          'dt.sr',
      freeSpins:      'dt.fs',
      bonusTriggered: 'dt.bg',
      multiplier:     'dt.ml',
      gameId:         'dt.gi',
      spinId:         'dt.ri',
    },
  },
  'custom': {
    name: '自訂 Custom (手動設定)',
    urlPattern: '',
    note: '使用 Debug Log 觀察請求，手動設定所有欄位映射。',
    fieldMappings: {
      balance: '', winAmount: '', betAmount: '', betLines: '',
      reels: '', freeSpins: '', bonusTriggered: '', multiplier: '',
      gameId: '', spinId: '',
    },
  },
};

const FIELD_LABELS = {
  balance:        '餘額 Balance',
  winAmount:      '贏得金額 Win Amount',
  betAmount:      '下注金額 Bet Amount',
  betLines:       '下注線數 Bet Lines',
  reels:          '轉輪結果 Reels',
  freeSpins:      '免費旋轉 Free Spins',
  bonusTriggered: 'Bonus 觸發',
  multiplier:     '倍率 Multiplier',
  gameId:         '遊戲 ID',
  spinId:         '旋轉 ID',
  extra1:         '自訂欄位 1',
  extra2:         '自訂欄位 2',
  extra3:         '自訂欄位 3',
};

function loadConfig() {
  try {
    const saved = GM_getValue('slotRecorderConfig', null);
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      return Object.assign({}, DEFAULT_CONFIG, parsed, {
        fieldMappings: Object.assign({}, DEFAULT_CONFIG.fieldMappings, parsed.fieldMappings || {}),
      });
    }
  } catch (e) {
    console.warn('[SlotRecorder] Failed to load config:', e);
  }
  return Object.assign({}, DEFAULT_CONFIG);
}

function saveConfig(config) {
  try {
    GM_setValue('slotRecorderConfig', JSON.stringify(config));
  } catch (e) {
    console.warn('[SlotRecorder] Failed to save config:', e);
  }
}
