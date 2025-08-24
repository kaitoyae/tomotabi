// app/home/utils.ts
// ユーティリティ関数・ヘルパー関数ファイル（100行以下）
// ⚠️ 分割作業中 - 段階的に移行中

import type { SearchChip, OverpassSpot } from './types'

// 所要時間を適切な単位で表示するヘルパー関数
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}分`
  } else if (minutes < 1440) { // 24時間未満
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
      return `${hours}時間`
    } else {
      return `${hours}時間${mins}分`
    }
  } else { // 24時間以上
    const days = Math.floor(minutes / 1440)
    const remainingMinutes = minutes % 1440
    if (remainingMinutes === 0) {
      return `${days}日`
    } else {
      const hours = Math.floor(remainingMinutes / 60)
      const mins = remainingMinutes % 60
      if (hours === 0) {
        return `${days}日${mins}分`
      } else if (mins === 0) {
        return `${days}日${hours}時間`
      } else {
        return `${days}日${hours}時間${mins}分`
      }
    }
  }
}

// スポットにマーカーアイコンを追加する関数（SVG）
export const getMarkerIcon = (spot: OverpassSpot, isSelected: boolean = false): string => {
  // カテゴリマッピング
  const getCategoryFromType = (type: string): string => {
    if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(type)) return 'restaurant'
    if (['attraction', 'museum', 'gallery', 'viewpoint', 'artwork'].includes(type)) return 'tourism'
    if (['clothes', 'books', 'gift', 'mall', 'supermarket'].includes(type)) return 'shopping'
    if (['cinema', 'theatre', 'casino', 'nightclub'].includes(type)) return 'leisure'
    if (['place_of_worship'].includes(type)) return 'culture'
    if (['park', 'garden', 'nature_reserve', 'beach', 'peak'].includes(type)) return 'nature'
    if (['spa', 'public_bath', 'hot_spring'].includes(type)) return 'onsen'
    if (['hotel', 'guest_house', 'hostel', 'motel'].includes(type)) return 'accommodation'
    return 'default'
  }

  const iconType = getCategoryFromType(spot.type)
  
  switch (iconType) {
    case 'nature':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></svg>'
    case 'culture':
      return '<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12,2 20,7 4,7"/></svg>'
    case 'restaurant':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>'
    case 'onsen':
      return '<img src="/images/svgicon/onsen.svg" alt="温泉" width="12" height="12" style="filter: brightness(0);" />'
    case 'shopping':
      return '<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z"/></svg>'
    case 'leisure':
      return '<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    case 'accommodation':
      return '<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>'
    default:
      return '<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>'
  }
}

// 自然言語テキストからSearchChipを抽出するパーサー関数
export const parseNaturalText = (text: string): SearchChip[] => {
  const chips: SearchChip[] = []
  const lowerText = text.toLowerCase()
  
  // 予算パターン
  const budgetMatch = text.match(/[〜～]?¥?(\d+)[円]?/)
  if (budgetMatch) {
    const amount = budgetMatch[1]
    chips.push({
      id: `budget-${amount}`,
      type: 'budget',
      label: `~¥${amount}`,
      value: amount
    })
  }
  
  
  
  return chips
}

// スポットをグリッド状にバランスよく分散する関数（数値境界版）
export const distributeSpotsByGrid = (
  spots: OverpassSpot[], 
  bounds: { south: number; west: number; north: number; east: number }, 
  maxSpots: number
): OverpassSpot[] => {
  if (spots.length <= maxSpots) return spots
  
  const { south, west, north, east } = bounds
  
  // 4x4のグリッドを作成（16エリア）
  const gridSize = 4
  const latStep = (north - south) / gridSize
  const lngStep = (east - west) / gridSize
  
  console.log('🎯 グリッド分散開始:', {
    totalSpots: spots.length,
    targetSpots: maxSpots,
    gridSize,
    bounds: { south, west, north, east }
  })
  
  // グリッドごとにスポットを分類
  const grid: OverpassSpot[][][] = Array(gridSize).fill(null).map(() => 
    Array(gridSize).fill(null).map(() => [])
  )
  
  spots.forEach(spot => {
    const gridRow = Math.min(Math.floor((spot.lat - south) / latStep), gridSize - 1)
    const gridCol = Math.min(Math.floor((spot.lng - west) / lngStep), gridSize - 1)
    grid[gridRow][gridCol].push(spot)
  })
  
  // 各グリッドから均等にスポットを選択
  const spotsPerGrid = Math.max(1, Math.floor(maxSpots / (gridSize * gridSize)))
  const result: OverpassSpot[] = []
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellSpots = grid[row][col]
      if (cellSpots.length > 0) {
        // このセルから最大spotsPerGrid個選択
        const selectedFromCell = cellSpots.slice(0, spotsPerGrid)
        result.push(...selectedFromCell)
      }
    }
  }
  
  // 目標数に満たない場合は残りのスポットからランダムに追加
  if (result.length < maxSpots) {
    const remainingSpots = spots.filter(spot => !result.some(s => s.id === spot.id))
    const additionalNeeded = maxSpots - result.length
    const additional = remainingSpots.slice(0, additionalNeeded)
    result.push(...additional)
  }
  
  console.log('✅ グリッド分散完了:', {
    originalCount: spots.length,
    distributedCount: result.length,
    spotsPerGrid
  })
  
  return result.slice(0, maxSpots)
}

// TODO: 残りのユーティリティ関数を順次移動予定
// - その他ヘルパー関数

// プレースホルダー関数（削除予定）
export const placeholderUtilFunction = () => {
  // 段階2で実際のユーティリティ関数に置き換えられます
  return {}
}