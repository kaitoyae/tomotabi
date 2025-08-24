// app/home/constants.ts
// 定数・設定ファイル（50行以下）
// ⚠️ 分割作業中 - 段階的に移行中

import type { SpotCategory, AreaOption } from './types'

// スポットカテゴリーの定義
export const SPOT_CATEGORIES: SpotCategory[] = [
  {
    id: 'nature',
    label: '自然',
    overpassQuery: '["leisure"~"^(park|garden|nature_reserve)$"]["name"];["natural"~"^(beach|peak)$"]["name"]',
    icon: 'nature'
  },
  {
    id: 'culture',
    label: '文化・芸術', 
    overpassQuery: '["historic"]["historic"!="no"]["name"];["amenity"~"^(place_of_worship)$"]["name"];["tourism"~"^(museum|gallery)$"]["name"]',
    icon: 'culture'
  },
  {
    id: 'restaurant',
    label: '飲食店',
    overpassQuery: 'amenity~"^(restaurant|cafe|fast_food|bar|pub)$"',
    icon: 'restaurant'
  },
  {
    id: 'onsen',
    label: '温泉',
    overpassQuery: '["leisure"~"^(spa)$"]["name"];["amenity"~"^(public_bath)$"]["name"];["natural"="hot_spring"]["name"]',
    icon: 'onsen'
  },
  {
    id: 'shopping',
    label: 'お買い物',
    overpassQuery: '["shop"~"^(clothes|books|gift|mall|supermarket)$"]["name"]',
    icon: 'shopping'
  },
  {
    id: 'leisure',
    label: 'レジャー施設',
    overpassQuery: '["amenity"~"^(cinema|theatre)$"]["name"];["leisure"~"^(amusement_arcade|bowling_alley)$"]["name"]',
    icon: 'leisure'
  },
  {
    id: 'accommodation',
    label: '宿泊施設',
    overpassQuery: '["tourism"~"^(hotel|guest_house|hostel|motel)$"]["name"]',
    icon: 'accommodation'
  }
]

// エリア選択オプション
export const AREA_OPTIONS: AreaOption[] = [
  { id: 'current', label: '現在地周辺', lat: 0, lng: 0, radius: 2 },
  { id: 'shibuya', label: '渋谷', lat: 35.6598, lng: 139.7006, radius: 2 },
  { id: 'shinjuku', label: '新宿', lat: 35.6896, lng: 139.6917, radius: 2 },
  { id: 'asakusa', label: '浅草', lat: 35.7148, lng: 139.7967, radius: 2 },
  { id: 'akihabara', label: '秋葉原', lat: 35.7022, lng: 139.7745, radius: 1.5 },
  { id: 'ginza', label: '銀座', lat: 35.6762, lng: 139.7631, radius: 1.5 },
  { id: 'harajuku', label: '原宿', lat: 35.6702, lng: 139.7026, radius: 1.5 }
]

// キャッシュ設定
export const CACHE_DURATION = 10 * 60 * 1000 // 10分


// ダミーのルートデータ
export const DUMMY_ROUTES = [
  {
    id: 'route-1',
    title: '東京下町散歩',
    duration: 180, // 分
    tags: ['歴史', '神社仏閣', 'グルメ'],
    author: '山田太郎',
    spotCount: 5
  },
  {
    id: 'route-2', 
    title: '原宿・表参道カフェ巡り',
    duration: 240,
    tags: ['カフェ', 'ショッピング', '写真映え'],
    author: '鈴木花子',
    spotCount: 6
  },
  {
    id: 'route-3',
    title: '鎌倉日帰り旅行',
    duration: 480,
    tags: ['歴史', '自然', '神社仏閣'],
    author: '佐藤次郎',
    spotCount: 8
  }
]

// 予算選択肢
export const BUDGET_OPTIONS = [
  { label: '指定なし', value: null },
  { label: '~¥1,000', value: '1000' },
  { label: '~¥2,000', value: '2000' },
  { label: '~¥3,000', value: '3000' },
  { label: '指定...', value: 'custom' }
]

// 地方と都道府県のデータ
export const REGIONS = [
  { id: 'hokkaido', name: '北海道・東北' },
  { id: 'kanto', name: '関東' },
  { id: 'chubu', name: '中部' },
  { id: 'kansai', name: '関西' },
  { id: 'chugoku-shikoku', name: '中国・四国' },
  { id: 'kyushu-okinawa', name: '九州・沖縄' }
]

export const PREFECTURES_BY_REGION: Record<string, string[]> = {
  'hokkaido': ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  'kanto': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  'chubu': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  'kansai': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  'chugoku-shikoku': ['鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県'],
  'kyushu-okinawa': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
}

// TODO: 残りの定数を順次移動予定
// - デフォルト設定値
// - その他定数

// プレースホルダー定数（削除予定）
export const PLACEHOLDER_CONSTANT = {
  // 段階2で実際の定数に置き換えられます
} as const