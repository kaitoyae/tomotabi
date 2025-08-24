// app/home/api.ts
// API関数・データ取得ファイル（300行以下）
// ⚠️ 分割作業中 - 段階的に移行中

import type { OverpassSpot, PrefectureBoundaryData } from './types'

// Overpass APIクエリ構築関数
export const buildOverpassQuery = (
  lat: number, 
  lng: number, 
  radius: number, 
  categories: string[] = ['restaurant']
): string => {
  // 簡単にするため、最初は飲食店のみ対応
  const query = `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"](around:${radius * 1000},${lat},${lng});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"](around:${radius * 1000},${lat},${lng});
);
out geom;`
  
  return query
}

// バウンディングボックス用のOverpass APIクエリ構築
export const buildOverpassBoundsQuery = (
  south: number,
  west: number,
  north: number,
  east: number,
  categories: string[] = ['restaurant']
): string => {
  const bbox = `${south},${west},${north},${east}`
  const query = `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"](${bbox});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"](${bbox});
);
out geom;`
  return query
}

// スポットをグリッド状にバランスよく分散（数値境界版）
const distributeSpotsByGridNumeric = (
  spots: OverpassSpot[],
  bounds: { south: number; west: number; north: number; east: number },
  maxSpots: number
): OverpassSpot[] => {
  if (spots.length <= maxSpots) return spots

  const { south, west, north, east } = bounds
  const gridSize = 4
  const latStep = (north - south) / gridSize
  const lngStep = (east - west) / gridSize

  const grid: OverpassSpot[][][] = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null).map(() => [] as OverpassSpot[]))

  spots.forEach((spot) => {
    const gridRow = Math.min(Math.floor((spot.lat - south) / latStep), gridSize - 1)
    const gridCol = Math.min(Math.floor((spot.lng - west) / lngStep), gridSize - 1)
    grid[gridRow][gridCol].push(spot)
  })

  const spotsPerGrid = Math.max(1, Math.floor(maxSpots / (gridSize * gridSize)))
  const result: OverpassSpot[] = []

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellSpots = grid[row][col]
      if (cellSpots.length > 0) {
        result.push(...cellSpots.slice(0, spotsPerGrid))
      }
    }
  }

  if (result.length < maxSpots) {
    const remainingSpots = spots.filter((spot) => !result.some((s) => s.id === spot.id))
    const additionalNeeded = maxSpots - result.length
    result.push(...remainingSpots.slice(0, additionalNeeded))
  }

  return result.slice(0, maxSpots)
}

// Overpass APIからスポットを取得（矩形範囲・バランス分散）
export const fetchSpotsFromOverpassBounds = async (
  bounds: { south: number; west: number; north: number; east: number },
  categories: string[] = ['restaurant']
): Promise<OverpassSpot[]> => {
  try {
    const query = buildOverpassBoundsQuery(bounds.south, bounds.west, bounds.north, bounds.east, categories)
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Overpass API error response:', errorText)
      throw new Error(`Overpass API error: ${response.status}`)
    }

    const data = await response.json()
    if (!data.elements || !Array.isArray(data.elements)) {
      return []
    }

    const allSpots: OverpassSpot[] = data.elements
      .filter((element: any) => {
        const hasCoords = element.lat && element.lon
        const hasName = element.tags?.name
        return hasCoords && hasName
      })
      .map((element: any) => ({
        id: `${element.type}_${element.id}`,
        name: element.tags.name || 'Unknown',
        lat: element.lat || (element.center ? element.center.lat : 0),
        lng: element.lon || (element.center ? element.center.lon : 0),
        type:
          element.tags.amenity ||
          element.tags.tourism ||
          element.tags.shop ||
          element.tags.historic ||
          element.tags.leisure ||
          element.tags.natural ||
          'other',
        subtype:
          element.tags.cuisine ||
          element.tags.tourism ||
          element.tags.shop ||
          element.tags.historic ||
          'general',
        address:
          element.tags['addr:full'] ||
          `${element.tags['addr:housenumber'] || ''} ${element.tags['addr:street'] || ''}`.trim() ||
          undefined,
        website: element.tags.website,
        phone: element.tags.phone,
        opening_hours: element.tags.opening_hours,
        description: element.tags.description
      }))

    const balanced = distributeSpotsByGridNumeric(allSpots, bounds, 20)
    return balanced
  } catch (error) {
    console.error('Overpass API bounds error:', error)
    return []
  }
}

// Overpass APIからスポットを取得（円形検索）
export const fetchSpotsFromOverpass = async (
  lat: number,
  lng: number,
  radius: number = 2,
  categories: string[] = ['restaurant']
): Promise<OverpassSpot[]> => {
  try {
    const query = buildOverpassQuery(lat, lng, radius, categories)
    // API呼び出し
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query
    })

    if (!response.ok) {
      // レスポンステキストもログに出す
      const errorText = await response.text()
      console.error('❌ Overpass API error response:', errorText)
      throw new Error(`Overpass API error: ${response.status}`)
    }

    const data = await response.json()
    if (!data.elements || !Array.isArray(data.elements)) {
      return []
    }

    const filteredSpots: OverpassSpot[] = data.elements
      .filter((element: any) => {
        const hasCoords = element.lat && element.lon
        const hasName = element.tags?.name
        return hasCoords && hasName
      })
      .slice(0, 20)
      .map((element: any) => ({
        id: `${element.type}_${element.id}`,
        name: element.tags.name || 'Unknown',
        lat: element.lat || (element.center ? element.center.lat : 0),
        lng: element.lon || (element.center ? element.center.lon : 0),
        type: element.tags.amenity || element.tags.tourism || element.tags.shop || element.tags.historic || element.tags.leisure || element.tags.natural || 'other',
        subtype: element.tags.cuisine || element.tags.tourism || element.tags.shop || element.tags.historic || 'general',
        address: element.tags['addr:full'] || `${element.tags['addr:housenumber'] || ''} ${element.tags['addr:street'] || ''}`.trim() || undefined,
        website: element.tags.website,
        phone: element.tags.phone,
        opening_hours: element.tags.opening_hours,
        description: element.tags.description
      }))

    return filteredSpots
  } catch (error) {
    console.error('Overpass API error:', error)
    return []
  }
}

// BBox計算ユーティリティ（GeoJSONから境界ボックスを計算）
export const calculateBBox = (geojson: any): [number, number, number, number] | null => {
  if (!geojson || !geojson.coordinates) return null
  
  let minLng = Infinity, minLat = Infinity
  let maxLng = -Infinity, maxLat = -Infinity
  
  const processCoordinates = (coords: any) => {
    if (Array.isArray(coords[0])) {
      coords.forEach(processCoordinates)
    } else {
      const [lng, lat] = coords
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }
  }
  
  if (geojson.type === 'Polygon') {
    geojson.coordinates.forEach(processCoordinates)
  } else if (geojson.type === 'MultiPolygon') {
    geojson.coordinates.forEach((polygon: any) => {
      polygon.forEach(processCoordinates)
    })
  }
  
  return [minLng, minLat, maxLng, maxLat]
}

// Nominatim APIで住所を取得（補完用）
export const fetchAddressFromNominatim = async (
  lat: number,
  lng: number
): Promise<string | undefined> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    )

    if (!response.ok) return undefined

    const data = await response.json()
    if (data.display_name) {
      return data.display_name as string
    }
  } catch (error) {
    console.error('Nominatim API error:', error)
  }
  return undefined
}
// 県の座標のみを取得（フォールバック用）
export const fetchPrefectureCoordinates = async (
  prefecture: string
): Promise<{ lat: number; lng: number } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(prefecture + ', Japan')}&limit=1&addressdetails=1`
    )
    
    if (!response.ok) {
      console.error('Nominatim API error:', response.status)
      return null
    }
    
    const results = await response.json()
    
    if (results.length > 0) {
      const result = results[0]
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      }
    }
    
    return null
  } catch (error) {
    console.error('県座標取得エラー:', error)
    return null
  }
}
// 県境界データを取得（メイン関数）
export const fetchPrefectureBoundaryData = async (
  prefecture: string
): Promise<PrefectureBoundaryData | null> => {
  try {
    // 1. 境界データ付きで検索
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(prefecture + ', Japan')}&limit=1&polygon_geojson=1&addressdetails=1`
    )
    
    if (!response.ok) {
      console.error('Nominatim API error:', response.status)
      // フォールバックで座標のみ取得を試みる
      const coordData = await fetchPrefectureCoordinates(prefecture)
      return coordData ? { geojson: null, coordinates: coordData } : null
    }
    
    const results = await response.json()
    
    if (results.length > 0 && results[0].geojson) {
      const result = results[0]
      const geojson = result.geojson
      const bbox = calculateBBox(geojson)
      
      return {
        geojson,
        bbox: bbox || undefined,
        coordinates: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        }
      }
    }
    
    // 2. 境界データが取得できない場合、フォールバックで座標のみ取得
    const coordData = await fetchPrefectureCoordinates(prefecture)
    return coordData ? { geojson: null, coordinates: coordData } : null
    
  } catch (error) {
    console.error('県境データ取得エラー:', error)
    return null
  }
}
// キャッシュマネージャークラス（シングルトン）
class SpotsCacheManager {
  private static instance: SpotsCacheManager
  private cache: Map<string, { data: OverpassSpot[], timestamp: number }>
  private readonly CACHE_DURATION = 10 * 60 * 1000 // 10分

  private constructor() {
    this.cache = new Map()
  }

  static getInstance(): SpotsCacheManager {
    if (!SpotsCacheManager.instance) {
      SpotsCacheManager.instance = new SpotsCacheManager()
    }
    return SpotsCacheManager.instance
  }

  // キャッシュキー生成（既存ロジックそのまま）
  getCacheKey(lat: number, lng: number, radius: number, categories: string[]): string {
    return `${Math.round(lat * 1000)}_${Math.round(lng * 1000)}_${radius}_${categories.sort().join(',')}`
  }

  // キャッシュ取得（既存の getCachedSpots を置き換え）
  get(cacheKey: string): OverpassSpot[] | null {
    const cached = this.cache.get(cacheKey)
    if (!cached) return null
    
    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION
    if (isExpired) {
      this.cache.delete(cacheKey)
      return null
    }
    
    return cached.data
  }

  // キャッシュ保存（既存の setCachedSpots を置き換え）
  set(cacheKey: string, spots: OverpassSpot[]): void {
    this.cache.set(cacheKey, {
      data: spots,
      timestamp: Date.now()
    })
  }

  // キャッシュクリア（オプション）
  clear(): void {
    this.cache.clear()
  }
}

// エクスポート用のラッパー関数（互換性維持）
export const getCacheKey = (lat: number, lng: number, radius: number, categories: string[]): string => {
  return SpotsCacheManager.getInstance().getCacheKey(lat, lng, radius, categories)
}

export const getCachedSpots = (cacheKey: string): OverpassSpot[] | null => {
  return SpotsCacheManager.getInstance().get(cacheKey)
}

export const setCachedSpots = (cacheKey: string, spots: OverpassSpot[]): void => {
  SpotsCacheManager.getInstance().set(cacheKey, spots)
}

// TODO: 残りのAPI関数を順次移動予定
// - fetchSpotsFromOverpass
// - fetchSpotsFromOverpassBounds
// - reverseGeocode
// - calculateRoute
// - その他API関数

// プレースホルダー関数（削除予定）
export const placeholderApiFunction = async () => {
  // 段階2で実際のAPI関数に置き換えられます
  return {}
}