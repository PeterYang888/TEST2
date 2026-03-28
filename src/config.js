// ─── Configuration Management ───

const DEFAULT_CONFIG = {
  active: false,
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
  },
  ocrRegions: [],
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
