// app/home/types.ts
// 型定義ファイル（100行以下）
// ⚠️ 分割作業中 - 段階的に移行中

// Overpass APIから取得するスポット情報の型定義
export type OverpassSpot = {
  id: string
  name: string
  lat: number
  lng: number
  type: string // amenity, tourism, shop, etc.
  subtype: string // restaurant, museum, clothing, etc.
  address?: string
  website?: string
  phone?: string
  opening_hours?: string
  description?: string
}

// 作成中のルートのスポット情報
export type RouteSpot = {
  id: string
  name: string
  lat: number
  lng: number
  address?: string
  stayTime: number // 滞在時間（分）
  addedAt: Date
}

// スポットカテゴリーの定義
export type SpotCategory = {
  id: string
  label: string
  overpassQuery: string
  icon: string
}

// 検索チップの型定義
export type SearchChip = {
  id: string
  type: 'budget' | 'tag' | 'area' | 'spot'
  label: string
  value: string
}

// エリア選択オプションの型定義
export type AreaOption = {
  id: string
  label: string
  lat: number
  lng: number
  radius: number // km
}

// 絞り込み条件の状態の型定義
export type FilterState = {
  budget: string | null // '1000', '2000', '3000', 'custom:1000-3000'
  area: {
    type: 'distance' | 'location' | 'name' | null
    value: string | null // '1km', '3km', '5km' | '139.8107,35.7101' | '浅草'
  }
  tags: string[] // 最大3つ
  customBudget: { min: number, max: number } | null
}

// DeviceOrientationEventの型拡張
export interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number
}


// TODO: 残りの型定義を順次移動予定
// - その他画面固有の型定義

// プレースホルダー型定義（削除予定）
// 県境界データの型定義
export type PrefectureBoundaryData = {
  geojson: any | null  // GeoJSON形式の境界データ（Polygon or MultiPolygon）
  coordinates?: { lat: number; lng: number }  // 中心座標
  bbox?: [number, number, number, number]  // [minLng, minLat, maxLng, maxLat]
}