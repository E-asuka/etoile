/** 指名なし */
export const NO_PREFERENCE = 'any';

export interface StaffMember {
  id: string;
  name: string;
  /** 得意なデザイン */
  specialty: string;
  /** 紹介コメント */
  comment: string;
}

export const STAFF: StaffMember[] = [
  {
    id: 'sakura',
    name: 'Sakura',
    specialty: 'シンプル / ニュアンス',
    comment:
      'お客様の日常にそっと馴染むデザインが得意です。初めてのジェルも丁寧にご案内しますので、お気軽にご相談ください。',
  },
  {
    id: 'miki',
    name: 'Miki',
    specialty: 'アート / 個性派',
    comment:
      '細部までこだわったアートネイルが得意です。イメージの共有を大切に、世界に一つだけのデザインをご提案します。',
  },
  {
    id: 'yui',
    name: 'Yui',
    specialty: '韓国系ネイル',
    comment:
      'トレンドの韓国系デザインを中心に、可愛らしく上品な仕上がりを心がけています。写真映えもお任せください。',
  },
];

export const STAFF_IDS = STAFF.map((s) => s.id);

export const STAFF_LABELS: Record<string, string> = Object.fromEntries(
  STAFF.map((s) => [s.id, s.name]),
);

/** 予約フォーム用（指名なし付き） */
export const STAFF_SELECT_OPTIONS = [
  { id: NO_PREFERENCE, label: '指名なし' },
  ...STAFF.map((s) => ({ id: s.id, label: s.name })),
];

export function getStaff(id: string): StaffMember | undefined {
  return STAFF.find((s) => s.id === id);
}

/** 営業開始・終了・最終受付 */
export const OPEN_TIME = '09:00';
export const CLOSE_TIME = '19:00';
export const LAST_ACCEPT_TIME = '18:00';
/** 予約開始候補・シフト刻み（分） */
export const SLOT_INTERVAL_MIN = 30;

export interface MenuItem {
  id: string;
  label: string;
  price: number;
  /** 所要時間（分） */
  durationMin: number;
}

export interface OptionItem {
  id: string;
  label: string;
  price: number;
  /** 追加所要時間（分） */
  durationMin: number;
}

export const MENUS: MenuItem[] = [
  { id: 'onecolor', label: 'ワンカラーorグラデーション', price: 5500, durationMin: 40 },
  { id: 'magcolor', label: 'マグネットワンカラー', price: 7500, durationMin: 40 },
  { id: 'simple', label: 'アートネイル/4本まで', price: 7500, durationMin: 60 },
  { id: 'standard', label: 'アートネイル/6本まで', price: 9000, durationMin: 70 },
  { id: 'full', label: 'アートネイル/やり放題', price: 11000, durationMin: 90 },
  { id: 'french', label: 'フレンチネイル', price: 7000, durationMin: 60 },
  { id: 'footnail', label: 'フットワンカラーorグラデーション', price: 7000, durationMin: 60 },
  { id: 'footart', label: 'フットアートネイル/4本まで', price: 10000, durationMin: 90 },
  { id: 'nailoff', label: 'オフのみ', price: 3000, durationMin: 40 },
];

export const OPTIONS: OptionItem[] = [
  { id: 'length-one', label: '長さだし/1本', price: 1500, durationMin: 10 },
  { id: 'length-all', label: '長さだし/10本', price: 10000, durationMin: 60 },
  { id: 'off-repeat', label: 'オフ（自店）', price: 0, durationMin: 40 },
  { id: 'off-other', label: 'オフ（他店）', price: 2000, durationMin: 40 },
];

/** "HH:MM" → 分 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 分 → "HH:MM" */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 営業時間内の30分刻みブロック（勤務判定用） 09:00〜18:30 */
export function generateWorkBlocks(): string[] {
  const start = timeToMinutes(OPEN_TIME);
  const end = timeToMinutes(CLOSE_TIME);
  const blocks: string[] = [];
  for (let t = start; t + SLOT_INTERVAL_MIN <= end; t += SLOT_INTERVAL_MIN) {
    blocks.push(minutesToTime(t));
  }
  return blocks;
}

/** 予約開始候補（最終受付まで） 09:00〜18:00 */
export function generateStartSlots(): string[] {
  const start = timeToMinutes(OPEN_TIME);
  const last = timeToMinutes(LAST_ACCEPT_TIME);
  const slots: string[] = [];
  for (let t = start; t <= last; t += SLOT_INTERVAL_MIN) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/** シフト提出・空き枠の共通スロット（開始候補） */
export const TIME_SLOTS = generateStartSlots();

/** 勤務ブロック（シフト詳細用） */
export const WORK_BLOCKS = generateWorkBlocks();

export function getMenu(id: string): MenuItem | undefined {
  return MENUS.find((m) => m.id === id);
}

export function getOption(id: string): OptionItem | undefined {
  return OPTIONS.find((o) => o.id === id);
}

/** メニュー＋オプションの合計所要時間・料金 */
export function calcService(menuId: string, optionIds: string[] = []) {
  const menu = getMenu(menuId);
  if (!menu) return null;

  let durationMin = menu.durationMin;
  let price = menu.price;
  const options: OptionItem[] = [];

  for (const id of optionIds) {
    const opt = getOption(id);
    if (!opt) continue;
    options.push(opt);
    durationMin += opt.durationMin;
    price += opt.price;
  }

  return { menu, options, durationMin, price };
}

/** 開始時刻＋所要分が占有する30分ブロック */
export function occupiedBlocks(startTime: string, durationMin: number): string[] {
  const start = timeToMinutes(startTime);
  const end = start + durationMin;
  const blocks: string[] = [];
  for (let t = start; t < end; t += SLOT_INTERVAL_MIN) {
    blocks.push(minutesToTime(t));
  }
  return blocks;
}

/** 終了時刻（HH:MM） */
export function endTimeOf(startTime: string, durationMin: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMin);
}

/** 火曜定休 */
export const CLOSED_DAYS = [2];

/** 何ヶ月先まで予約可能か */
export const MAX_ADVANCE_MONTHS = 2;

/** サロンアクセス情報（デモ用の仮情報） */
export const SALON_ACCESS = {
  postalCode: '〒150-0001',
  addressLines: [
    '東京都渋谷区神宮前3-1-26',
    'エトワールビル 2F',
  ],
  phone: '03-6455-2180',
  phoneTel: '0364552180',
  openHours: '9:00 - 19:00（最終受付 18:00）',
  closedDay: '毎週火曜日',
  accessNote: '明治神宮前駅（東京メトロ副都心線・千代田線）徒歩5分 / 原宿駅（JR山手線）徒歩7分',
  /** Google Map 検索用クエリ */
  mapQuery: '東京都渋谷区神宮前3-1-26',
} as const;
