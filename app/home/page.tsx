'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchSpotsFromOverpass, fetchAddressFromNominatim, fetchSpotsFromOverpassBounds, fetchPrefectureBoundaryData, getCacheKey, getCachedSpots, setCachedSpots } from './api'

// 型定義インポート
import type { OverpassSpot, RouteSpot, SpotCategory, SearchChip, AreaOption, FilterState, DeviceOrientationEventWithWebkit, PrefectureBoundaryData } from './types'
// 定数インポート
import { SPOT_CATEGORIES, AREA_OPTIONS, CACHE_DURATION, DUMMY_ROUTES, BUDGET_OPTIONS, REGIONS, PREFECTURES_BY_REGION } from './constants'







// カテゴリアイコンコンポーネント
const CategoryIcon = ({ iconType, className = "w-6 h-6" }: { iconType: string, className?: string }) => {
  switch (iconType) {
    case 'nature':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/>
          <path d="M7 16v6"/>
          <path d="M13 19v3"/>
          <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>
        </svg>
      )
    case 'culture':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <line x1="3" x2="21" y1="22" y2="22"/>
          <line x1="6" x2="6" y1="18" y2="11"/>
          <line x1="10" x2="10" y1="18" y2="11"/>
          <line x1="14" x2="14" y1="18" y2="11"/>
          <line x1="18" x2="18" y1="18" y2="11"/>
          <polygon points="12,2 20,7 4,7"/>
        </svg>
      )
    case 'restaurant':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
        </svg>
      )
    case 'onsen':
      return (
        <img src="/images/svgicon/onsen.svg" alt="温泉" className={className} />
      )
    case 'shopping':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z"/>
        </svg>
      )
    case 'leisure':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )
    case 'accommodation':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      )
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      )
  }
}

// 所要時間を適切な単位で表示するヘルパー関数
const formatDuration = (minutes: number): string => {
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



// Overpass API関連の関数
const buildOverpassQuery = (
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

// buildOverpassBoundsQuery は ./api に移動

// スポットをグリッド状にバランスよく分散させる関数
const distributeSpotsByGrid = (
  spots: OverpassSpot[], 
  bounds: maplibregl.LngLatBounds, 
  maxSpots: number
): OverpassSpot[] => {
  if (spots.length <= maxSpots) return spots
  
  const ne = bounds.getNorthEast()
  const sw = bounds.getSouthWest()
  
  // 4x4のグリッドを作成（16エリア）
  const gridSize = 4
  const latStep = (ne.lat - sw.lat) / gridSize
  const lngStep = (ne.lng - sw.lng) / gridSize
  
  console.log('🎯 グリッド分散開始:', {
    totalSpots: spots.length,
    targetSpots: maxSpots,
    gridSize,
    bounds: { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng }
  })
  
  // グリッドごとにスポットを分類
  const grid: OverpassSpot[][][] = Array(gridSize).fill(null).map(() => 
    Array(gridSize).fill(null).map(() => [])
  )
  
  spots.forEach(spot => {
    const gridRow = Math.min(Math.floor((spot.lat - sw.lat) / latStep), gridSize - 1)
    const gridCol = Math.min(Math.floor((spot.lng - sw.lng) / lngStep), gridSize - 1)
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

// fetchSpotsFromOverpass は ./api に移動

// fetchSpotsFromOverpassBounds は ./api に移動（boundsは数値境界で引き渡し）

// fetchAddressFromNominatim は ./api に移動

// スポットにマーカーアイコンを追加する関数（SVG）
const getMarkerIcon = (spot: OverpassSpot, isSelected: boolean = false): string => {
  const category = SPOT_CATEGORIES.find(cat => 
    spot.type === cat.id || 
    (cat.id === 'restaurant' && ['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(spot.type)) ||
    (cat.id === 'tourism' && ['attraction', 'museum', 'gallery', 'viewpoint', 'artwork'].includes(spot.type)) ||
    (cat.id === 'shopping' && ['clothes', 'books', 'gift', 'mall', 'supermarket'].includes(spot.type)) ||
    (cat.id === 'leisure' && ['cinema', 'theatre', 'casino', 'nightclub'].includes(spot.type)) ||
    (cat.id === 'culture' && ['place_of_worship'].includes(spot.type)) ||
    (cat.id === 'nature' && ['park', 'garden', 'nature_reserve', 'beach', 'peak'].includes(spot.type)) ||
    (cat.id === 'onsen' && ['spa', 'public_bath', 'hot_spring'].includes(spot.type))
  )
  
  const iconType = category?.icon || 'default'
  
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

// キャッシュ機能は api.ts に移行済み

// 人気タグのダミーデータ





// 自然文パース用の簡単なパターンマッチング
const parseNaturalText = (text: string): SearchChip[] => {
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




export default function HomePage() {
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const currentLocationMarker = useRef<maplibregl.Marker | null>(null)
  const spotMarkers = useRef<maplibregl.Marker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // swipeStateは削除
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [deviceHeading, setDeviceHeading] = useState<number>(0)
  const [locationAccuracy, setLocationAccuracy] = useState<number>(0)
  const [orientationPermissionNeeded, setOrientationPermissionNeeded] = useState<boolean>(false)
  const [locationRequestInProgress, setLocationRequestInProgress] = useState<boolean>(false)
  const [hasUserGesture, setHasUserGesture] = useState<boolean>(false)
  const [shouldInitializeMap, setShouldInitializeMap] = useState<boolean>(false)
  
  // レスポンシブタグチップ用のstate
  const [visibleTagCount, setVisibleTagCount] = useState<number>(8) // コンパクトモバイルデフォルト
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false)
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true)
  
  // カテゴリー選択シート用のstate
  const [showCategorySheet, setShowCategorySheet] = useState<boolean>(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const tagScrollRef = useRef<HTMLDivElement>(null)
  
  // 検索関連のstate
  const [searchChips, setSearchChips] = useState<SearchChip[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterState, setFilterState] = useState<FilterState>({
    budget: null,
    area: { type: null, value: null },
    tags: [],
    customBudget: null
  })
  
  // エリア選択のstate
  const [areaSheetVisible, setAreaSheetVisible] = useState<boolean>(false)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [areaSearchQuery, setAreaSearchQuery] = useState<string>('')
  
  // スポット関連のstate
  const [spots, setSpots] = useState<OverpassSpot[]>([])
  const [selectedSpot, setSelectedSpot] = useState<OverpassSpot | null>(null)
  const [routeSpots, setRouteSpots] = useState<RouteSpot[]>([])
  const [spotsLoading, setSpotsLoading] = useState<boolean>(false)
  const [spotInfoCardVisible, setSpotInfoCardVisible] = useState<boolean>(false)
  
  // カテゴリーとエリアのstate
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['restaurant'])
  const [selectedAreaId, setSelectedAreaId] = useState<string>('current')
  const [addedSpotIds, setAddedSpotIds] = useState<Set<string>>(new Set())
  
  // プラン一覧表示用のstate
  const [showRoutesSheet, setShowRoutesSheet] = useState<boolean>(false)
  
  const locationRequestRef = useRef<boolean>(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // コールバック関数
  
  // スポット取得関数（キャッシュ対応）
  const loadSpots = useCallback(async () => {
    console.log('🔍 スポット取得開始:', {
      hasCurrentLocation: !!currentLocation,
      selectedAreaId,
      selectedCategories: selectedCategories.length
    })
    
    if (!currentLocation && selectedAreaId === 'current') {
      console.log('⏳ 現在地未取得のため取得をスキップ')
      return
    }
    
    setSpotsLoading(true)
    try {
      let centerLat: number, centerLng: number, radius: number
      
      if (selectedAreaId === 'current' && currentLocation) {
        [centerLng, centerLat] = currentLocation
        radius = 2
        console.log('📍 現在地中心でスポット検索:', { centerLat, centerLng, radius })
      } else {
        const areaOption = AREA_OPTIONS.find(area => area.id === selectedAreaId)
        if (!areaOption) {
          console.log('⚠️ エリアオプションが見つかりません:', selectedAreaId)
          return
        }
        centerLat = areaOption.lat
        centerLng = areaOption.lng
        radius = areaOption.radius
        console.log('🏙️ エリア指定でスポット検索:', { area: areaOption.label, centerLat, centerLng, radius })
      }
      
      // キャッシュキーを生成
      const cacheKey = getCacheKey(centerLat, centerLng, radius, selectedCategories)
      console.log('🗂️ キャッシュキー:', cacheKey)
      
      // キャッシュから取得を試行
      const cachedSpots = getCachedSpots(cacheKey)
      if (cachedSpots) {
        console.log('💾 キャッシュからスポットを取得:', cachedSpots.length, '件')
        setSpots(cachedSpots)
        setSpotsLoading(false)
        return
      }
      
      // キャッシュにない場合はAPIから取得
      console.log('🌐 Overpass APIからスポットを取得中:', { centerLat, centerLng, radius, categories: selectedCategories })
      const fetchedSpots = await fetchSpotsFromOverpass(
        centerLat, 
        centerLng, 
        radius, 
        selectedCategories
      )
      console.log('✅ Overpass APIから取得完了:', fetchedSpots.length, '件')
      
      // 取得したスポットの詳細ログ
      if (fetchedSpots.length > 0) {
        console.log('📍 取得スポット例:', fetchedSpots.slice(0, 3).map(spot => ({
          name: spot.name,
          type: spot.type,
          lat: spot.lat,
          lng: spot.lng
        })))
      }
      
      // キャッシュに保存
      setCachedSpots(cacheKey, fetchedSpots)
      
      setSpots(fetchedSpots)
      
    } catch (error) {
      console.error('❌ スポット取得エラー:', error)
      setError('スポットの取得に失敗しました')
    } finally {
      setSpotsLoading(false)
    }
  }, [currentLocation, selectedAreaId, selectedCategories])

  // スポットクリック処理
  const handleSpotClick = useCallback(async (spot: OverpassSpot) => {
    // 住所が不完全な場合はNominatim APIで補完
    if (!spot.address) {
      const address = await fetchAddressFromNominatim(spot.lat, spot.lng)
      spot.address = address
    }
    
    setSelectedSpot(spot)
    setSpotInfoCardVisible(true)
  }, [])
  
  // マーカー更新関数
  const updateSpotMarkers = useCallback((spotsData: OverpassSpot[]) => {
    console.log('🗺️ スポットマーカー更新開始:', { 
      mapExists: !!map.current, 
      spotsCount: spotsData.length,
      currentMarkersCount: spotMarkers.current.length
    })
    
    if (!map.current) {
      console.warn('⚠️ 地図が初期化されていません')
      return
    }
    
    try {
      // 既存のマーカーを削除
      console.log('🗑️ 既存マーカーを削除:', spotMarkers.current.length)
      spotMarkers.current.forEach(marker => {
        try {
          marker.remove()
        } catch (err) {
          console.warn('マーカー削除エラー:', err)
        }
      })
      spotMarkers.current = []
      
      // 新しいマーカーを追加
      let createdCount = 0
      spotsData.forEach((spot, index) => {
        try {
          const isAdded = addedSpotIds.has(spot.id)
          
          const markerEl = document.createElement('div')
          markerEl.className = `spot-marker ${isAdded ? 'added' : ''}`
          markerEl.innerHTML = getMarkerIcon(spot)
          markerEl.style.cssText = `
            width: 24px; 
            height: 24px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 12px; 
            cursor: pointer; 
            border: 2px solid ${isAdded ? '#2db5a5' : '#ffffff'};
            background: ${isAdded ? '#2db5a5' : '#f97316'};
            color: ${isAdded ? '#ffffff' : '#ffffff'};
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
          `
          
          // ホバー効果（transform削除、代わりにサイズ変更）
          markerEl.addEventListener('mouseenter', () => {
            markerEl.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)'
            markerEl.style.zIndex = '100'
          })
          
          markerEl.addEventListener('mouseleave', () => {
            markerEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
            markerEl.style.zIndex = '10'
          })
          
          // 名前表示用のポップアップを作成
          const namePopup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'spot-name-popup'
          }).setHTML(`<div style="font-size: 12px; font-weight: bold; color: #333;">${spot.name}</div>`)

          markerEl.addEventListener('click', () => {
            // 一時的にポップアップを表示
            namePopup.setLngLat([spot.lng, spot.lat]).addTo(map.current!)
            setTimeout(() => {
              namePopup.remove()
            }, 2000)
            
            handleSpotClick(spot)
          })
          
          const marker = new maplibregl.Marker({ element: markerEl })
            .setLngLat([spot.lng, spot.lat])
            .addTo(map.current!)
          
          spotMarkers.current.push(marker)
          createdCount++
          
          console.log(`📍 スポットマーカー作成 ${index + 1}/${spotsData.length}:`, {
            name: spot.name,
            lat: spot.lat,
            lng: spot.lng,
            isAdded
          })
        } catch (err) {
          console.error(`❌ スポットマーカー作成エラー (${index}):`, err, spot)
        }
      })
      
      console.log('✅ スポットマーカー更新完了:', { 
        作成済み: createdCount,
        総数: spotsData.length 
      })
      
    } catch (err) {
      console.error('❌ スポットマーカー更新で予期しないエラー:', err)
    }
  }, [addedSpotIds, handleSpotClick])
  
  // スポットをルートに追加
  const addSpotToRoute = useCallback((spot: OverpassSpot, stayTime: number = 60) => {
    const routeSpot: RouteSpot = {
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      address: spot.address,
      stayTime,
      addedAt: new Date()
    }
    
    setRouteSpots(prev => [...prev, routeSpot])
    setAddedSpotIds(prev => new Set(Array.from(prev).concat(spot.id)))
    setSpotInfoCardVisible(false)
    setSelectedSpot(null)
  }, [])

  const onCreateRoute = () => {
    router.push('/plan/create')
  }

  const onProfile = () => {
    router.push('/profile')
  }
  
  const onSelectRoute = (routeId: string) => {
    router.push(`/route/${routeId}`)
  }

  // ブラウザ環境チェック関数
  const isClientSide = () => {
    return typeof window !== 'undefined'
  }

  const hasDeviceOrientationAPI = () => {
    return isClientSide() && 'DeviceOrientationEvent' in window
  }

  // 検索関連の関数
  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value)
    // 検索バーが空になった場合は県境ハイライトを削除
    if (!value.trim()) {
      clearPrefectureHighlight()
    }
  }

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return
    
    // 自然文パースでチップ化
    const parsedChips = parseNaturalText(searchQuery.trim())
    
    // 既存のチップと重複しないように追加
    const newChips = parsedChips.filter(chip => 
      !searchChips.some(existing => existing.id === chip.id)
    )
    
    setSearchChips(prev => [...prev, ...newChips])
    setSearchQuery('')
    
  }

  const addSearchChip = (chip: SearchChip) => {
    // 重複チェック
    const isDuplicate = searchChips.some(existing => existing.id === chip.id)
    if (isDuplicate) return
    
    // タグの場合は最大3つまで
    if (chip.type === 'tag') {
      const currentTags = searchChips.filter(c => c.type === 'tag')
      if (currentTags.length >= 3) return
    }
    
    const newChips = [...searchChips, chip]
    setSearchChips(newChips)
  }

  const removeSearchChip = (chipId: string) => {
    const newChips = searchChips.filter(chip => chip.id !== chipId)
    setSearchChips(newChips)
  }

  const clearAllChips = () => {
    setSearchChips([])
    setFilterState({
      budget: null,
      area: { type: null, value: null },
      tags: [],
      customBudget: null
    })
    // 県境ハイライトを削除
    clearPrefectureHighlight()
  }



  // レスポンシブタグチップ関連の関数
  const updateVisibleTagCount = useCallback(() => {
    if (!isClientSide()) return
    
    const width = window.innerWidth
    if (width >= 1024) { // PC - コンパクト版で全部表示
      setVisibleTagCount(16) 
    } else if (width >= 768) { // タブレット - コンパクトで多め表示
      setVisibleTagCount(14)
    } else if (width >= 640) { // 大きめモバイル - コンパクトで効率的
      setVisibleTagCount(10)
    } else { // 小さなモバイル - コンパクトでも見やすく
      setVisibleTagCount(8)
    }
  }, [])

  const updateScrollButtons = useCallback(() => {
    if (!tagScrollRef.current) return
    
    const { scrollLeft, scrollWidth, clientWidth } = tagScrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  const scrollTags = useCallback((direction: 'left' | 'right') => {
    if (!tagScrollRef.current) return
    
    const scrollAmount = isClientSide() && window.innerWidth >= 768 ? 200 : 120
    const targetScroll = direction === 'left' 
      ? tagScrollRef.current.scrollLeft - scrollAmount
      : tagScrollRef.current.scrollLeft + scrollAmount
    
    tagScrollRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    })
  }, [])

  // エリア選択関連の関数
  const handleAreaButtonClick = () => {
    setAreaSheetVisible(true)
    setSelectedRegion(null)
    setAreaSearchQuery('')
  }
  
  const handleAreaSelect = (areaId: string) => {
    setSelectedAreaId(areaId)
    setAreaSheetVisible(false)
  }

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegion(regionId)
  }

  const handlePrefectureSelect = async (prefecture: string) => {
    // ホーム画面の検索バーに県名を入力
    setSearchQuery(prefecture)
    
    // エリアチップを追加
    const chip: SearchChip = {
      id: `area-${prefecture}`,
      type: 'area',
      label: prefecture,
      value: prefecture
    }
    addSearchChip(chip)
    
    try {
      // 県境データを取得してハイライト表示
      await fetchAndShowPrefectureBoundary(prefecture)
    } catch (error) {
      console.error('エリア検索でエラーが発生しました:', error)
    }
    
    // エリアシートを閉じる
    setAreaSheetVisible(false)
    setSelectedRegion(null)
    setAreaSearchQuery('')
  }

  // カテゴリー選択関連の関数
  const handleCategoryButtonClick = () => {
    setShowCategorySheet(true)
  }

  const handleCategorySelect = (categoryId: string) => {
    const category = SPOT_CATEGORIES.find(cat => cat.id === categoryId)
    if (category) {
      // 検索バーにカテゴリ名を入力
      setSearchQuery(category.label)
      
      // 単一選択に変更
      setSelectedCategories([categoryId])
      
      // シートを閉じる
      setShowCategorySheet(false)
    }
  }

  const handleCategoryToggle = (category: string) => {
    setSearchQuery(category)
    
    // カテゴリーチップを追加
    const chip: SearchChip = {
      id: `tag-${category}`,
      type: 'tag',
      label: category,
      value: category
    }
    addSearchChip(chip)
    
    setShowCategorySheet(false)
    setSelectedCategory(null)
  }

  // GeoJSONからBounding Boxを計算する関数
  // 県境界データを地図に適用するヘルパー関数
  const applyPrefectureBoundaryToMap = (
    mapInstance: maplibregl.Map,
    boundaryData: PrefectureBoundaryData
  ) => {
    // 既存の県境レイヤーがあれば削除
    if (mapInstance.getLayer('prefecture-fill')) {
      mapInstance.removeLayer('prefecture-fill')
    }
    if (mapInstance.getLayer('prefecture-outline')) {
      mapInstance.removeLayer('prefecture-outline')
    }
    if (mapInstance.getSource('prefecture-boundary')) {
      mapInstance.removeSource('prefecture-boundary')
    }
    
    // GeoJSON境界データがある場合
    if (boundaryData.geojson) {
      // GeoJSONソースを追加
      mapInstance.addSource('prefecture-boundary', {
        type: 'geojson',
        data: boundaryData.geojson
      })
      
      // 県境の塗りつぶしレイヤー（薄い色）
      mapInstance.addLayer({
        id: 'prefecture-fill',
        type: 'fill',
        source: 'prefecture-boundary',
        paint: {
          'fill-color': '#2db5a5',
          'fill-opacity': 0.1
        }
      })
      
      // 県境のアウトラインレイヤー（濃い色）
      mapInstance.addLayer({
        id: 'prefecture-outline',
        type: 'line',
        source: 'prefecture-boundary',
        paint: {
          'line-color': '#2db5a5',
          'line-width': 3,
          'line-opacity': 0.8
        }
      })
      
      // バウンディングボックスがある場合、地図を移動
      if (boundaryData.bbox) {
        mapInstance.fitBounds(boundaryData.bbox, {
          padding: 50, // 境界から50pxの余白
          speed: 1.2,
          maxZoom: 11 // 最大ズームレベルを制限（県全体を見せるため）
        })
      }
    } else if (boundaryData.coordinates) {
      // 境界データがない場合は座標で移動
      mapInstance.flyTo({
        center: [boundaryData.coordinates.lng, boundaryData.coordinates.lat],
        zoom: 8, // 県全体が見える縮尺
        speed: 1.2
      })
    }
  }

  // calculateBBox関数は api.ts に移行済み
  // 県境データを取得してハイライト表示する関数
  const fetchAndShowPrefectureBoundary = async (prefecture: string) => {
    if (!map.current) return
    
    try {
      // 純粋API関数を呼び出して県境界データを取得
      const boundaryData = await fetchPrefectureBoundaryData(prefecture)
      
      if (boundaryData) {
        // 地図操作を分離された関数で実行
        applyPrefectureBoundaryToMap(map.current, boundaryData)
      }
    } catch (error) {
      console.error('県境データ取得エラー:', error)
    }
  }

  // 県境ハイライトを削除する関数
  const clearPrefectureHighlight = () => {
    if (!map.current) return
    
    try {
      if (map.current.getLayer('prefecture-fill')) {
        map.current.removeLayer('prefecture-fill')
      }
      if (map.current.getLayer('prefecture-outline')) {
        map.current.removeLayer('prefecture-outline')
      }
      if (map.current.getSource('prefecture-boundary')) {
        map.current.removeSource('prefecture-boundary')
      }
    } catch (error) {
      // レイヤーが存在しない場合のエラーを無視
    }
  }

  // Google Map風の現在地マーカーを作成
  const createCurrentLocationMarker = () => {
    const el = document.createElement('div')
    el.style.cssText = `
      position: relative;
      width: 36px;
      height: 36px;
      transform: translate(-50%, -50%);
      z-index: 1000;
    `

    // 精度を示す円（外側の半透明の円）
    const accuracyCircle = document.createElement('div')
    accuracyCircle.id = 'accuracy-circle'
    accuracyCircle.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90px;
      height: 90px;
      background: rgba(66, 133, 244, 0.1);
      border: 2.25px solid rgba(66, 133, 244, 0.3);
      border-radius: 50%;
      transition: all 0.3s ease;
    `

    // 方向を示す扇形
    const directionCone = document.createElement('div')
    directionCone.id = 'direction-cone'
    directionCone.style.cssText = `
      position: absolute;
      top: -36px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 24px 48px 24px;
      border-color: transparent transparent rgba(66, 133, 244, 0.3) transparent;
      transform-origin: 50% 100%;
      transition: transform 0.3s ease;
    `

    // 中心の青い丸
    const centerDot = document.createElement('div')
    centerDot.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 21px;
      height: 21px;
      background: #4285f4;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
      z-index: 10;
    `

    // 内側の青いリング（パルスアニメーション）
    const pulseRing = document.createElement('div')
    pulseRing.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      background: transparent;
      border: 3px solid rgba(66, 133, 244, 0.8);
      border-radius: 50%;
      animation: pulse 2s infinite;
    `

    // パルスアニメーションのスタイルを追加
    if (!document.getElementById('pulse-animation')) {
      const style = document.createElement('style')
      style.id = 'pulse-animation'
      style.textContent = `
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          70% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }

    el.appendChild(accuracyCircle)
    el.appendChild(directionCone)
    el.appendChild(pulseRing)
    el.appendChild(centerDot)

    return el
  }

  // 位置情報の継続監視
  const startLocationWatch = useCallback(() => {
    if (watchId) {
      console.log('📍 既に監視中のためスキップ')
      return
    }
    
    console.log('📍 位置情報継続監視開始')
    const newWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        console.log('📍 位置情報更新:', { lat: latitude, lng: longitude, accuracy })
        setCurrentLocation([longitude, latitude])
        setLocationAccuracy(accuracy || 50)
      },
      (error) => {
        console.warn('⚠️ 位置監視エラー:', error.message)
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 600000
      }
    )
    
    setWatchId(newWatchId)
  }, [watchId])

  
  
  // 地図の表示範囲に基づいてスポットを取得する関数（バランス分散版）
  const loadSpotsForMapBounds = useCallback(async () => {
    if (!map.current) return
    
    try {
      // 小さなローディングインジケーターを表示
      setSpotsLoading(true)
      
      // 地図の表示範囲（bounds）を取得
      const bounds = map.current.getBounds()
      const center = map.current.getCenter()
      const zoom = map.current.getZoom()
      
      // 表示範囲から検索半径を動的に計算
      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      const latDiff = ne.lat - sw.lat
      const lngDiff = ne.lng - sw.lng
      
      // 表示範囲の対角線距離をベースに検索半径を設定
      const radius = Math.max(
        Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111, // 111km = 1度
        1 // 最小1km
      ) * 0.7 // 70%の範囲で検索
      
      console.log('🗺️ 地図範囲基準でスポット取得（バランス分散）:', {
        centerLat: center.lat,
        centerLng: center.lng,
        bounds: {
          north: ne.lat,
          south: sw.lat,
          east: ne.lng,
          west: sw.lng
        },
        calculatedRadius: radius.toFixed(2) + 'km',
        zoom,
        selectedCategories: selectedCategories.length
      })
      
      // 現在選択されているカテゴリーを使用（デフォルトは飲食店）
      const categories = selectedCategories.length > 0 
        ? selectedCategories
        : ['restaurant']
      
      // Overpass APIからスポット取得（表示範囲を考慮）
      const newSpots = await fetchSpotsFromOverpassBounds({
        south: sw.lat,
        west: sw.lng,
        north: ne.lat,
        east: ne.lng
      }, categories)
      
      if (newSpots.length > 0) {
        setSpots(newSpots)
        console.log(`✅ 地図範囲基準スポット取得完了（バランス分散）: ${newSpots.length} 件`)
      } else {
        console.log('⚠️ 地図範囲基準でスポットが見つかりませんでした')
      }
    } catch (error) {
      console.error('❌ 地図範囲基準スポット取得エラー:', error)
    } finally {
      setSpotsLoading(false)
    }
  }, [selectedCategories])

  // 地図移動時にスポットを更新する関数（デバウンス付き・範囲ベース）
  const updateSpotsOnMapMove = useCallback(() => {
    if (!map.current) return
    
    const bounds = map.current.getBounds()
    const center = map.current.getCenter()
    const zoom = map.current.getZoom()
    
    console.log('🗺️ 地図移動終了、スポット更新（デバウンス開始・範囲ベース）:', {
      centerLat: center.lat,
      centerLng: center.lng,
      zoom,
      selectedCategories: selectedCategories.length
    })
    
    // 既存のタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // 1秒後にスポット取得を実行（デバウンス）
    debounceTimerRef.current = setTimeout(() => {
      console.log('🕒 デバウンス完了、範囲ベーススポット取得実行')
      loadSpotsForMapBounds()
    }, 1000)
  }, [loadSpotsForMapBounds])

  // 実際の位置情報取得関数（重複実行防止強化版）
  const requestLocationPermission = useCallback(async (forceRequest = false): Promise<boolean> => {
    // 重複実行防止（Refベース）
    if (locationRequestRef.current && !forceRequest) {
      console.log('📍 位置情報取得が既に進行中です (Ref)')
      return false
    }
    
    // State重複実行防止
    if (locationRequestInProgress && !forceRequest) {
      console.log('📍 位置情報取得が既に進行中です (State)')
      return false
    }

    locationRequestRef.current = true
    setLocationRequestInProgress(true)

    const FALLBACK_LOCATION: [number, number] = [139.5, 35.7] // 東京都心部広域
    
    try {
      console.log('📍 位置情報取得開始 - 環境情報:', {
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        hasUserGesture
      })

      // iOS Safari検出
      const isIosSafari = /iPhone|iPad/.test(navigator.userAgent) && 
                         /Safari/.test(navigator.userAgent) && 
                         !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
      
      console.log('📍 ブラウザタイプ:', isIosSafari ? 'iOS Safari' : 'その他')

      // iOS Safari 18.5のuser gesture制約チェックを一時的に無効化
      // if (isIosSafari && !hasUserGesture && !forceRequest) {
      //   console.log('📍 iOS Safari - ユーザージェスチャー待機中、フォールバック使用')
      //   setCurrentLocation(FALLBACK_LOCATION)
      //   setLocationAccuracy(50)
      //   return false
      // }
      
      // 許可状態を確認
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          console.log('📍 位置情報許可状態:', permission.state)
          
          if (permission.state === 'denied') {
            console.log('⚠️ 位置情報許可が拒否されています、フォールバック使用')
            setCurrentLocation(FALLBACK_LOCATION)
            setLocationAccuracy(50)
            return false
          }
        } catch (error) {
          console.log('📍 許可状態確認不可、位置情報取得を継続します')
        }
      }

      // ブラウザ別最適化設定（CoreLocation・Chrome対応）
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent)
      
      const options = {
        enableHighAccuracy: false, // 全ブラウザ共通で低精度・高速
        timeout: 3000, // 3秒で短縮
        maximumAge: 300000 // 5分キャッシュ
      }
      
      console.log('📍 位置情報を取得試行...', options)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options)
      })

      const { latitude, longitude, accuracy } = position.coords
      console.log('✅ 位置情報取得成功:', { lat: latitude, lng: longitude, accuracy })
      const newLocation: [number, number] = [longitude, latitude]
      setCurrentLocation(newLocation)
      setLocationAccuracy(accuracy || 100)
      console.log('📍 currentLocation状態更新:', newLocation)
      
      // 成功したら継続監視開始
      startLocationWatch()
      return true

    } catch (error: any) {
      console.log('❌ 位置情報取得失敗（即座にフォールバック使用）:', error.message)
      
      // 再試行は行わず、即座にフォールバック位置を使用
      console.log('🔄 フォールバック位置を使用:', FALLBACK_LOCATION)
      setCurrentLocation(FALLBACK_LOCATION)
      setLocationAccuracy(50)
      return false
    } finally {
      locationRequestRef.current = false
      setLocationRequestInProgress(false)
    }
  }, [hasUserGesture, watchId, startLocationWatch])

  // 初期化時の位置情報取得（高速化・フォールバック優先）
  useEffect(() => {
    console.log('🌍 位置情報取得初期化 - 高速化バージョン')
    
    // 即座にフォールバック位置を設定してUIの初期化を完了
    const FALLBACK_LOCATION: [number, number] = [139.5, 35.7] // 東京都心部広域
    setCurrentLocation(FALLBACK_LOCATION)
    setLocationAccuracy(50)
    console.log('✅ フォールバック位置を即座に設定:', FALLBACK_LOCATION)
    
    if (!navigator.geolocation) {
      console.log('⚠️ Geolocation未対応、フォールバック位置のみ使用')
      return
    }

    // 位置情報取得は背景で非同期実行（1回だけ短時間で試行）
    const tryGetLocationOnce = async () => {
      try {
        console.log('📍 背景で位置情報取得を試行（短時間）')
        
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, // 低精度で高速化
            timeout: 3000, // 3秒で諦める
            maximumAge: 300000 // 5分キャッシュ
          })
        })

        const { latitude, longitude, accuracy } = position.coords
        setCurrentLocation([longitude, latitude])
        setLocationAccuracy(accuracy || 100)
        console.log('✅ 背景での位置情報取得成功:', { lat: latitude, lng: longitude, accuracy })
        
      } catch (error: any) {
        console.log('📍 背景での位置情報取得失敗（フォールバック位置継続使用）:', error.message)
        // フォールバック位置はすでに設定済みなので何もしない
      }
    }

    // 短時間の遅延後に実行して初期化をブロックしない
    const timeoutId = setTimeout(tryGetLocationOnce, 100)

    return () => {
      clearTimeout(timeoutId)
      if (watchId) {
        console.log('📍 位置情報監視停止')
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, []) // 依存関係を空配列に変更して初回のみ実行

  // スポット取得のuseEffect
  useEffect(() => {
    loadSpots()
  }, [loadSpots])
  
  // カテゴリーまたはエリア変更時にスポットを再取得
  useEffect(() => {
    if (currentLocation || selectedAreaId !== 'current') {
      loadSpots()
    }
  }, [selectedCategories, selectedAreaId, currentLocation, loadSpots]) // currentLocationの依存関係を復元
  
  // spotsまたはaddedSpotIdsが更新されたらマーカーを更新
  useEffect(() => {
    if (spots.length > 0) {
      updateSpotMarkers(spots)
    }
  }, [spots, addedSpotIds, updateSpotMarkers])

  // ユーザージェスチャー検出と自動位置情報取得（iOS Safari 18.5対応）
  useEffect(() => {
    const isIosSafari = /iPhone|iPad/.test(navigator.userAgent) && 
                       /Safari/.test(navigator.userAgent) && 
                       !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)

    if (!isIosSafari) {
      return // iOS Safari以外は不要
    }

    console.log('📍 iOS Safari用ユーザージェスチャー検出開始')

    // 複数のユーザーインタラクションを検出
    const handleUserGesture = async (eventType: string) => {
      if (hasUserGesture) {
        return // 既に検出済み
      }

      console.log('📍 ユーザージェスチャー検出:', eventType)
      setHasUserGesture(true)

      // 位置情報取得を試行
      const success = await requestLocationPermission(true)
      if (success) {
        console.log('✅ ユーザージェスチャー後の位置情報取得成功')
      }

      // 方位センサー許可も同時に試行（ブラウザ環境のみ）
      if (typeof window !== 'undefined' && 
          typeof DeviceOrientationEvent !== 'undefined' && 
          'DeviceOrientationEvent' in window &&
          typeof (window.DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          console.log('🧭 ユーザージェスチャー後の方位センサー許可要求')
          const response = await (window.DeviceOrientationEvent as any).requestPermission()
          if (response === 'granted') {
            console.log('🧭 方位センサー許可成功')
            setOrientationPermissionNeeded(false)
            
            // イベントリスナーを登録
            const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
              const evt = event as DeviceOrientationEventWithWebkit
              if (evt.alpha !== null || evt.webkitCompassHeading !== undefined) {
                let heading: number
                if (evt.webkitCompassHeading !== undefined) {
                  heading = evt.webkitCompassHeading
                } else if (evt.alpha !== null) {
                  heading = 360 - evt.alpha
                } else {
                  return
                }
                setDeviceHeading(heading)
                console.log('🧭 方位更新:', heading.toFixed(1) + '°')
              }
            }
            
            window.addEventListener('deviceorientation', handleDeviceOrientation, true)
          } else {
            console.warn('⚠️ 方位センサー許可が拒否されました')
          }
        } catch (error) {
          console.error('❌ 方位センサー許可エラー:', error)
        }
      }
    }

    // 各種ユーザーインタラクションをリスニング
    const handleTouch = () => handleUserGesture('touch')
    const handleClick = () => handleUserGesture('click')
    const handleScroll = () => handleUserGesture('scroll')
    const handleKeydown = () => handleUserGesture('keydown')
    const handlePointerDown = () => handleUserGesture('pointerdown')

    // イベントリスナーを追加（Passive & Once）
    document.addEventListener('touchstart', handleTouch, { passive: true, once: true })
    document.addEventListener('click', handleClick, { passive: true, once: true })
    document.addEventListener('scroll', handleScroll, { passive: true, once: true })
    document.addEventListener('keydown', handleKeydown, { passive: true, once: true })
    document.addEventListener('pointerdown', handlePointerDown, { passive: true, once: true })
    
    // 少し遅延してからIntersection Observerによる自動トリガーも試行
    const intersectionTimer = setTimeout(() => {
      if (!hasUserGesture) {
        console.log('📍 3秒後の自動トリガー試行')
        handleUserGesture('intersection-fallback')
      }
    }, 3000)

    return () => {
      // クリーンアップ
      clearTimeout(intersectionTimer)
      document.removeEventListener('touchstart', handleTouch)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [hasUserGesture, requestLocationPermission])

  // 方位センサーの監視開始（全ブラウザ対応）
  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const evt = event as DeviceOrientationEventWithWebkit
      
      console.log('🧭 方位センサー受信:', {
        alpha: evt.alpha,
        webkitCompassHeading: evt.webkitCompassHeading,
        absolute: evt.absolute
      })
      
      if (evt.alpha !== null || evt.webkitCompassHeading !== undefined) {
        // iOSの場合はwebkitCompassHeading、Android/Chromeの場合は360 - alphaを使用
        let heading: number
        if (evt.webkitCompassHeading !== undefined) {
          heading = evt.webkitCompassHeading
          console.log('🧭 iOS方位:', heading)
        } else if (evt.alpha !== null) {
          heading = 360 - evt.alpha
          console.log('🧭 Android/Chrome方位:', heading)
        } else {
          return
        }
        
        setDeviceHeading(heading)
        console.log('🧭 方位更新:', heading.toFixed(1) + '°')
      }
    }

    // 方位センサーの許可とイベント登録（全ブラウザ統一版）
    const setupOrientation = async () => {
      console.log('🧭 方位センサー初期化開始')
      
      // iOS Safari検出
      const isIosSafari = /iPhone|iPad/.test(navigator.userAgent) && 
                         /Safari/.test(navigator.userAgent) && 
                         !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)

      console.log('🧭 ブラウザ検出:', {
        isIosSafari,
        userAgent: navigator.userAgent
      })

      // iOS13以降での許可確認
      if (typeof window !== 'undefined' && 
          'DeviceOrientationEvent' in window && 
          typeof (window.DeviceOrientationEvent as any).requestPermission === 'function') {
        console.log('🧭 許可が必要なデバイス（iOS等）検出')
        if (isIosSafari) {
          // iOS Safariでは統合された自動許可戦略に任せる
          console.log('🧭 iOS Safari - 統合戦略により自動処理される')
          setOrientationPermissionNeeded(true)
        } else {
          // iOS Chrome等では従来通り手動許可
          console.log('🧭 iOS Chrome等 - 手動許可が必要')
          setOrientationPermissionNeeded(true)
        }
      } else {
        // Chrome、Android等 - Chrome 83以降では許可が必要
        console.log('🧭 Chrome/Android - Device Orientation API許可確認中')
        
        // Chrome向けの許可要求実装
        const requestChromePermission = async () => {
          // Chrome 88+では navigator.permissions でDevice Orientation許可確認
          if ('permissions' in navigator) {
            try {
              // @ts-ignore - Chrome実験的API
              const permission = await navigator.permissions.query({ name: 'accelerometer' })
              console.log('🧭 Chrome加速度センサー許可状態:', permission.state)
              
              if (permission.state === 'denied') {
                console.log('⚠️ Chrome Device Orientation許可が拒否されています')
                return false
              }
            } catch (error) {
              console.log('🧭 Chrome許可状態確認不可、直接試行します')
            }
          }
          
          // 直接イベントリスナーを登録してテスト
          let orientationDataReceived = false
          
          const testHandler = (event: DeviceOrientationEvent) => {
            orientationDataReceived = true
            console.log('🧭 Chrome方位データ受信テスト成功:', event.alpha)
            window.removeEventListener('deviceorientation', testHandler)
            window.removeEventListener('deviceorientationabsolute', testHandler)
          }
          
          window.addEventListener('deviceorientation', testHandler, true)
          window.addEventListener('deviceorientationabsolute', testHandler, true)
          
          // 2秒間待ってデータ受信確認
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          window.removeEventListener('deviceorientation', testHandler)
          window.removeEventListener('deviceorientationabsolute', testHandler)
          
          return orientationDataReceived
        }
        
        try {
          const hasPermission = await requestChromePermission()
          if (hasPermission) {
            console.log('✅ Chrome Device Orientation API 利用可能 - イベント登録')
            window.addEventListener('deviceorientation', handleDeviceOrientation, true)
            window.addEventListener('deviceorientationabsolute', handleDeviceOrientation, true)
          } else {
            console.log('⚠️ Chrome Device Orientation API 利用不可 - ユーザージェスチャー後に再試行')
            // ユーザージェスチャー検出後の統合戦略に任せる
            setOrientationPermissionNeeded(true)
          }
        } catch (error) {
          console.error('❌ Chrome Device Orientation API 設定エラー:', error)
          setOrientationPermissionNeeded(true)
        }
      }
    }

    setupOrientation()

    return () => {
      console.log('🧭 方位センサークリーンアップ')
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true)
      window.removeEventListener('deviceorientationabsolute', handleDeviceOrientation, true)
    }
  }, [])


  // 位置情報取得後に地図初期化をトリガー（一度だけ）
  useEffect(() => {
    if (currentLocation && !shouldInitializeMap && !map.current) {
      console.log('🎯 位置情報取得完了、地図初期化をトリガー')
      setShouldInitializeMap(true)
    }
  }, [currentLocation, shouldInitializeMap]) // 必要な依存関係を維持

  // 地図の初期化（一度だけ実行）
  useEffect(() => {
    let cleanup: (() => void) | null = null
    
    // 初期化条件をチェック
    if (!shouldInitializeMap || map.current) {
      console.log('🚫 地図初期化スキップ:', {
        shouldInitialize: shouldInitializeMap,
        hasMap: !!map.current
      })
      return
    }
    
    // 位置情報の最終確認
    if (!currentLocation) {
      console.log('⚠️ 位置情報が取得されていません')
      return
    }
    
    const waitForContainer = (): Promise<HTMLDivElement> => {
      return new Promise((resolve, reject) => {
        const checkContainer = () => {
          if (mapContainer.current) {
            console.log('✅ 地図コンテナ発見')
            resolve(mapContainer.current)
            return
          }
          
          console.log('⏳ 地図コンテナ待機中...')
          setTimeout(checkContainer, 100)
        }
        
        // 5秒でタイムアウト
        setTimeout(() => {
          reject(new Error('地図コンテナが見つかりませんでした'))
        }, 5000)
        
        checkContainer()
      })
    }
    
    const initializeMap = async () => {
      try {
        console.log('🗺️ 地図初期化開始:', {
          currentLocation,
          hasMapContainer: !!mapContainer.current,
          hasMap: !!map.current,
          loading
        })

        // 既存の現在地マーカーをクリア
        if (currentLocationMarker.current) {
          console.log('🗺️ 既存の現在地マーカーを削除')
          currentLocationMarker.current.remove()
          currentLocationMarker.current = null
        }

        // この時点では地図は存在しないはず（上の条件でチェック済み）

        // DOM コンテナの準備を待つ
        console.log('🏗️ 地図コンテナ待機開始...')
        let container: HTMLDivElement
        try {
          container = await waitForContainer()
        } catch (err) {
          console.error('❌ 地図コンテナ取得失敗:', err)
          setError('地図の初期化に失敗しました')
          setLoading(false)
          return
        }

        console.log('🗺️ 地図初期化開始...', {
          container: !!container,
          currentLocation,
          containerId: container.id,
          containerSize: { 
            width: container.offsetWidth, 
            height: container.offsetHeight 
          }
        })
        
        try {
          const mapInstance = new maplibregl.Map({
            container: container,
            style: {
              version: 8,
              sources: {
                osm: {
                  type: 'raster',
                  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                  tileSize: 256,
                  attribution: '© OpenStreetMap contributors'
                }
              },
              layers: [{
                id: 'osm',
                type: 'raster',
                source: 'osm'
              }]
            },
            center: [139.7, 35.68], // 東京固定値（位置情報による自動初期化を防ぐ）
            zoom: 10
          })

          console.log('🗺️ MapLibre インスタンス作成完了:', {
            mapInstance: !!mapInstance,
            center: [139.7, 35.68],
            zoom: 10
          })
          map.current = mapInstance

          // 地図ロード完了を待つ
          const handleLoad = () => {
            console.log('🗺️ 地図ロード完了')
            try {
              console.log('✅ 地図初期化完了')
              setLoading(false)
              
              // 地図初期化完了後に現在地マーカーを追加
              if (currentLocation && !currentLocationMarker.current) {
                console.log('📍 地図ロード完了後に現在地マーカーを作成:', currentLocation)
                const markerElement = createCurrentLocationMarker()
                currentLocationMarker.current = new maplibregl.Marker({ 
                  element: markerElement,
                  anchor: 'center'
                })
                  .setLngLat(currentLocation)
                  .addTo(mapInstance)
                console.log('✅ 現在地マーカー作成完了')
              } else {
                console.log('⚠️ 現在地マーカー作成スキップ:', {
                  hasCurrentLocation: !!currentLocation,
                  currentLocation,
                  hasExistingMarker: !!currentLocationMarker.current
                })
              }
              
              // 地図初期化完了後にスポットマーカーを表示
              if (spots.length > 0) {
                console.log('🗺️ 地図ロード完了後にスポットマーカーを更新:', spots.length)
                updateSpotMarkers(spots)
              }
              
              // 地図ロード完了を少し待ってから再度マーカーを確認
              setTimeout(() => {
                if (currentLocation && !currentLocationMarker.current && mapInstance) {
                  console.log('📍 遅延チェック: 現在地マーカーが未作成のため作成')
                  try {
                    const markerElement = createCurrentLocationMarker()
                    currentLocationMarker.current = new maplibregl.Marker({ 
                      element: markerElement,
                      anchor: 'center'
                    })
                      .setLngLat(currentLocation)
                      .addTo(mapInstance)
                    console.log('✅ 遅延作成: 現在地マーカー作成完了')
                  } catch (err) {
                    console.error('❌ 遅延作成: 現在地マーカー作成エラー:', err)
                  }
                }
              }, 500)
            } catch (err) {
              console.error('地図ロード後のエラー:', err)
              map.current = null // エラー時は地図を削除してリトライ可能にする
              setLoading(false)
            }
          }


          // エラーハンドリング
          const handleError = (e: any) => {
            console.error('❌ MapLibre error:', e)
            setError('地図の読み込みに失敗しました')
            setLoading(false)
          }

          console.log('🎧 イベントリスナー登録')
          mapInstance.on('load', handleLoad)
          mapInstance.on('error', handleError)
          
          // 地図移動終了時にスポットを更新
          mapInstance.on('moveend', () => {
            updateSpotsOnMapMove()
          })


          console.log('🗺️ 地図初期化処理完了、ロードイベント待機中...')

          // クリーンアップ関数を設定
          cleanup = () => {
            try {
              if (currentLocationMarker.current) {
                console.log('🗺️ クリーンアップ: 現在地マーカーを削除')
                currentLocationMarker.current.remove()
                currentLocationMarker.current = null
              }
              if (mapInstance) {
                mapInstance.off('load', handleLoad)
                mapInstance.off('error', handleError)
                
                mapInstance.remove()
              }
              map.current = null
            } catch (err) {
              console.error('地図クリーンアップエラー:', err)
            }
          }

        } catch (mapCreationError) {
          console.error('❌ MapLibre インスタンス作成エラー:', mapCreationError)
          map.current = null // エラー時は地図を削除してリトライ可能にする
          setError('地図の初期化に失敗しました')
          setLoading(false)
        }
      } catch (err) {
        console.error('❌ 地図初期化全体エラー:', err)
        map.current = null // エラー時は地図を削除してリトライ可能にする
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
        setLoading(false)
      }
    }

    // 初期化実行
    initializeMap()

    return () => {
      if (cleanup) cleanup()
      // デバウンスタイマーのクリーンアップ
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [shouldInitializeMap, updateSpotsOnMapMove]) // currentLocationの依存関係を除去

  // 現在地マーカーの更新（位置と方位）
  useEffect(() => {
    console.log('📍 現在地マーカー更新処理:', {
      hasCurrentLocation: !!currentLocation,
      currentLocation,
      hasMap: !!map.current,
      hasMarker: !!currentLocationMarker.current,
      markerDetails: currentLocationMarker.current ? 'マーカー存在' : 'マーカーなし'
    })
    
    // 地図と現在地の両方が存在する場合のみ処理
    if (currentLocation && map.current) {
      // 地図がロードされているか確認
      if (!map.current.loaded()) {
        console.log('⏳ 地図がまだロードされていないため現在地マーカー処理をスキップ')
        return
      }
      
      // マーカーがない場合、または既存マーカーが現在の地図に存在しない場合は新規作成
      const markerElement = currentLocationMarker.current?.getElement()
      const isMarkerOnCurrentMap = markerElement && markerElement.parentElement
      
      if (!currentLocationMarker.current || !isMarkerOnCurrentMap) {
        console.log('📍 現在地マーカー新規作成:', {
          currentLocation,
          hasExistingMarker: !!currentLocationMarker.current,
          isOnMap: isMarkerOnCurrentMap,
          mapLoaded: map.current.loaded()
        })
        
        // 既存マーカーがある場合は削除
        if (currentLocationMarker.current) {
          try {
            currentLocationMarker.current.remove()
          } catch (e) {
            console.warn('マーカー削除時の警告:', e)
          }
          currentLocationMarker.current = null
        }
        
        try {
          const newMarkerElement = createCurrentLocationMarker()
          currentLocationMarker.current = new maplibregl.Marker({ 
            element: newMarkerElement,
            anchor: 'center'
          })
            .setLngLat(currentLocation)
            .addTo(map.current)
          console.log('✅ 現在地マーカー作成完了')
        } catch (err) {
          console.error('❌ 現在地マーカー作成エラー:', err)
        }
      } else {
        // 既存マーカーの位置のみ更新
        console.log('📍 現在地マーカー位置更新:', currentLocation)
        try {
          currentLocationMarker.current.setLngLat(currentLocation)
        } catch (err) {
          console.error('❌ 現在地マーカー位置更新エラー:', err)
        }
      }
      
      // マーカー要素を取得して方位を更新
      const currentMarkerElement = currentLocationMarker.current?.getElement()
      if (currentMarkerElement) {
        const directionCone = currentMarkerElement.querySelector('#direction-cone') as HTMLElement
        if (directionCone) {
          // 方位に応じて扇形を回転（transform-originを正しく設定）
          directionCone.style.transform = `translateX(-50%) rotate(${deviceHeading}deg)`
          directionCone.style.transformOrigin = '50% 100%'
          console.log('🧭 マーカー方位更新:', deviceHeading.toFixed(1) + '°')
        }
        
        // 精度に応じて精度円のサイズを調整
        const accuracyCircle = currentMarkerElement.querySelector('#accuracy-circle') as HTMLElement
        if (accuracyCircle && map.current) {
          // 地図のズームレベルに応じてサイズを調整
          const zoom = map.current.getZoom()
          const metersPerPixel = 156543.03392 * Math.cos(currentLocation[1] * Math.PI / 180) / Math.pow(2, zoom)
          const pixelRadius = Math.min(locationAccuracy / metersPerPixel, 100) // 最大100px
          const size = Math.max(60, pixelRadius * 2) // 最小60px
          
          accuracyCircle.style.width = `${size}px`
          accuracyCircle.style.height = `${size}px`
        }
      }
    }
  }, [currentLocation, deviceHeading, locationAccuracy])



  // レスポンシブタグチップの初期化とリサイズ対応
  useEffect(() => {
    if (!isClientSide()) return

    // 初期設定
    updateVisibleTagCount()
    
    const handleResize = () => {
      updateVisibleTagCount()
      setTimeout(updateScrollButtons, 100) // DOM更新後にスクロール状態チェック
    }

    const handleScroll = () => {
      updateScrollButtons()
    }

    // リサイズイベント
    window.addEventListener('resize', handleResize)
    
    // スクロールイベント
    if (tagScrollRef.current) {
      tagScrollRef.current.addEventListener('scroll', handleScroll, { passive: true })
    }

    // 初期スクロール状態チェック
    setTimeout(updateScrollButtons, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (tagScrollRef.current) {
        tagScrollRef.current.removeEventListener('scroll', handleScroll)
      }
    }
  }, [updateVisibleTagCount, updateScrollButtons])

  // 地図範囲内のプランを取得（ズームレベル対応）







  // Chrome向け方位センサー有効化（User Gesture必須）
  const requestChromeOrientationPermission = async () => {
    // ブラウザ環境チェック
    if (typeof window === 'undefined') {
      console.log('🧭 SSR環境 - 方位センサー許可要求スキップ')
      return false
    }

    console.log('🧭 Chrome方位センサー許可要求開始（User Gesture）')
    
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const evt = event as DeviceOrientationEventWithWebkit
      
      if (evt.alpha !== null || evt.webkitCompassHeading !== undefined) {
        let heading: number
        if (evt.webkitCompassHeading !== undefined) {
          heading = evt.webkitCompassHeading
        } else if (evt.alpha !== null) {
          heading = 360 - evt.alpha
        } else {
          return
        }
        
        setDeviceHeading(heading)
        console.log('🧭 User Gesture後の方位更新:', heading.toFixed(1) + '°')
      }
    }

    try {
      // Generic Sensor API許可要求（Chrome実験的）
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        try {
          // @ts-ignore - Chrome実験的API
          const accelerometer = await navigator.permissions.query({ name: 'accelerometer' })
          // @ts-ignore - Chrome実験的API  
          const gyroscope = await navigator.permissions.query({ name: 'gyroscope' })
          console.log('🧭 Chrome センサー許可状態:', { accel: accelerometer.state, gyro: gyroscope.state })
        } catch (error) {
          console.log('🧭 Chrome Generic Sensor API未対応')
        }
      }

      // 直接Device Orientation APIを試行
      window.addEventListener('deviceorientation', handleDeviceOrientation, true)
      window.addEventListener('deviceorientationabsolute', handleDeviceOrientation, true)
      console.log('✅ Chrome方位センサー User Gesture後有効化完了')
      
      return true
    } catch (error) {
      console.error('❌ Chrome方位センサー有効化失敗:', error)
      return false
    }
  }

  // 現在地ボタン
  const handleCurrentLocation = async () => {
    console.log('📍 現在地ボタンクリック - User Gesture検出')
    setHasUserGesture(true) // ユーザージェスチャーマーク

    // 方位センサーをUser Gesture後に有効化（Chrome対応）
    if (orientationPermissionNeeded) {
      console.log('🧭 User Gesture後の方位センサー有効化試行')
      const success = await requestChromeOrientationPermission()
      if (success) {
        setOrientationPermissionNeeded(false)
      }
    }

    if (currentLocation && map.current) {
      // フォールバック位置（東京都心部）が設定されている場合は実際の位置情報取得を試行
      const [lng, lat] = currentLocation
      const isUsingFallback = Math.abs(lng - 139.5) < 0.1 && Math.abs(lat - 35.7) < 0.1
      
      if (isUsingFallback) {
        console.log('📍 フォールバック位置検出 - 実際の位置情報取得を試行')
        await requestLocationPermission(true)
      } else {
        console.log('📍 現在地へ地図を移動:', currentLocation)
        map.current.flyTo({
          center: currentLocation,
          zoom: 15, // ズームレベルを上げて詳細表示
          bearing: 0 // 北向きに設定
        })
        
        // 現在地マーカーが存在しない場合は作成
        if (!currentLocationMarker.current) {
          console.log('📍 現在地ボタンクリック時にマーカーが存在しないため作成')
          try {
            const markerElement = createCurrentLocationMarker()
            currentLocationMarker.current = new maplibregl.Marker({ 
              element: markerElement,
              anchor: 'center'
            })
              .setLngLat(currentLocation)
              .addTo(map.current)
            console.log('✅ 現在地ボタン経由でマーカー作成完了')
          } catch (err) {
            console.error('❌ 現在地ボタン経由でマーカー作成エラー:', err)
          }
        }
      }
    } else if (!currentLocation) {
      // 位置情報がない場合は取得を試行
      console.log('📍 位置情報がないため取得を試行')
      await requestLocationPermission(true)
    }
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-50 px-4 py-3 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="/images/logo_tomotabi.png" 
            alt="トモタビ" 
            className="w-12 h-12 mr-2"
          />
          <h1 className="text-xl font-black font-logo">トモタビ</h1>
        </div>
        <button
          onClick={onProfile}
          className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center"
          aria-label="プロフィール"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
          </svg>
        </button>
      </header>

      {/* 検索バー - コンパクト版 */}
      <div className="fixed top-16 left-0 right-0 z-40 px-4 py-1">
        <div className="bg-white rounded-lg shadow-sm flex items-center px-2 py-2">
          <svg 
            className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            placeholder="お出かけプランを検索"
            className="flex-1 text-base outline-none placeholder-gray-400 min-w-0"
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearchSubmit()
              }
            }}
            onFocus={(e) => {
              e.currentTarget.parentElement!.style.boxShadow = '0 0 0 2px #2db5a5'
            }}
            onBlur={(e) => {
              e.currentTarget.parentElement!.style.boxShadow = ''
            }}
          />
        </div>
        
        {/* 選択済みチップ表示（コンパクト版） */}
      </div>

      {/* タグバー：エリア・キーワード・ルートの3つのボタン */}
      <div 
        className="fixed left-0 right-0 z-30 bg-white shadow-sm border-b border-gray-100" 
        style={{ 
          top: '115px' // 検索バー(96) + 安全間隔(19)
        }}
      >
        {/* デスクトップ・タブレット用（md以上） */}
        <div className="hidden md:block px-4 py-3">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {/* エリアボタン */}
            <button
              onClick={handleAreaButtonClick}
              className="flex-1 px-4 py-2 mx-1 rounded-lg text-sm font-medium border-2 transition-all duration-150 hover:scale-105 active:scale-95 bg-white text-gray-700 border-gray-300 hover:border-teal-400 hover:text-teal-600"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span>エリア</span>
              </div>
            </button>

            {/* カテゴリーボタン */}
            <button
              onClick={handleCategoryButtonClick}
              className="flex-1 px-4 py-2 mx-1 rounded-lg text-sm font-medium border-2 transition-all duration-150 hover:scale-105 active:scale-95 bg-white text-gray-700 border-gray-300 hover:border-teal-400 hover:text-teal-600"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H3m10 14H7"/>
                </svg>
                <span>カテゴリー</span>
              </div>
            </button>
            
            {/* プランボタン */}
            <button
              onClick={() => setShowRoutesSheet(true)}
              className="flex-1 px-4 py-2 mx-1 rounded-lg text-sm font-medium border-2 transition-all duration-150 hover:scale-105 active:scale-95 bg-white text-gray-700 border-gray-300 hover:border-teal-400 hover:text-teal-600"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>プラン</span>
              </div>
            </button>

          </div>
        </div>

        {/* モバイル用（sm以下）- 1行コンパクトデザイン */}
        <div className="block md:hidden px-3 py-1.5">
          <div className="flex items-center justify-between">
            {/* エリアボタン - モバイル1行 */}
            <button
              onClick={handleAreaButtonClick}
              className="flex-1 px-2 py-1.5 mx-0.5 rounded text-xs font-medium border transition-all duration-150 active:scale-95 bg-white text-gray-700 border-gray-300 active:border-teal-400 active:text-teal-600 active:bg-teal-50"
            >
              <div className="flex items-center justify-center space-x-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span className="text-xs">エリア</span>
              </div>
            </button>

            {/* カテゴリーボタン - モバイル1行 */}
            <button
              onClick={handleCategoryButtonClick}
              className="flex-1 px-2 py-1.5 mx-0.5 rounded text-xs font-medium border transition-all duration-150 active:scale-95 bg-white text-gray-700 border-gray-300 active:border-teal-400 active:text-teal-600 active:bg-teal-50"
            >
              <div className="flex items-center justify-center space-x-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H3m10 14H7"/>
                </svg>
                <span className="text-xs">カテゴリー</span>
              </div>
            </button>
            
            {/* プランボタン - モバイル1行 */}
            <button
              onClick={() => setShowRoutesSheet(true)}
              className="flex-1 px-2 py-1.5 mx-0.5 rounded text-xs font-medium border transition-all duration-150 active:scale-95 bg-white text-gray-700 border-gray-300 active:border-teal-400 active:text-teal-600 active:bg-teal-50"
            >
              <div className="flex items-center justify-center space-x-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="text-xs">プラン</span>
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* 地図コンテナ */}
      <div 
        className="absolute left-0 right-0 bottom-0"
        style={{ 
          top: '140px' // 中段タグバー(115) + タグバー高さ(25)
        }}
      >
        {/* 地図コンテナは常に存在させる */}
        <div 
          ref={mapContainer} 
          className="w-full h-full" 
        />
        
        {/* ローディングオーバーレイ（地図の初期化時のみ） */}
        {loading && (
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center z-10">
            <div className="text-gray-500">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p>地図を読み込み中...</p>
            </div>
          </div>
        )}
      </div>

      {/* 現在地ボタン */}
      <button
        onClick={handleCurrentLocation}
        className="fixed right-4 bg-white rounded-full p-3 shadow-lg z-40"
        style={{ top: '180px' }}
        aria-label="現在地を表示"
        title="現在地を地図の中心に移動します"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </button>

      {/* スポット取得中のインジケーター（シンプル版） */}
      {spotsLoading && (
        <div className="fixed right-4 bg-white rounded-full p-2 shadow-lg z-40" style={{ top: '240px' }}>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
        </div>
      )}

      {/* スポット情報ボックス（小さなボックス、背景暗化なし） */}
      {selectedSpot && (
        <div
          className="fixed left-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-50 transition-all duration-300"
          style={{
            bottom: '110px' // CTAボタンから少し上に
          }}
        >
          {/* クローズボタン */}
          <button
            onClick={() => setSelectedSpot(null)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          
          {/* スポット情報を横並びに */}
          <div className="flex items-center justify-between pr-8">
            <div className="flex-1">
              {/* スポット名 */}
              <h3 className="text-sm font-bold text-gray-900 mb-1">{selectedSpot.name}</h3>
              {/* 住所 */}
              <p className="text-xs text-gray-600">{selectedSpot.address}</p>
            </div>
            
            {/* ルートに追加ボタン */}
            <button
              onClick={() => {
                setAddedSpotIds(prev => new Set(Array.from(prev).concat(selectedSpot.id)))
                setSelectedSpot(null)
              }}
              disabled={addedSpotIds.has(selectedSpot.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-3"
              style={{
                backgroundColor: addedSpotIds.has(selectedSpot.id) ? '#e5e7eb' : '#f97316',
                color: 'white'
              }}
            >
              {addedSpotIds.has(selectedSpot.id) ? '追加済み' : 'ルートに追加'}
            </button>
          </div>
        </div>
      )}

      {/* ルート作成CTAボタン（固定位置） */}
      <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-200 p-4 z-40">
        <button
          onClick={onCreateRoute}
          disabled={addedSpotIds.size === 0}
          className="w-full text-white rounded-xl py-4 px-6 shadow-lg flex items-center justify-center font-bold text-lg transition-all"
          style={{ 
            backgroundColor: addedSpotIds.size === 0 ? '#e5e7eb' : '#2db5a5',
            color: addedSpotIds.size === 0 ? '#9ca3af' : 'white',
            cursor: addedSpotIds.size === 0 ? 'not-allowed' : 'pointer'
          }}
          aria-label={addedSpotIds.size === 0 ? 'スポットを追加してください' : '作ったルートを確認'}
        >
          {addedSpotIds.size === 0 ? (
            'スポットを追加してルートを作成'
          ) : (
            <>
              作ったルートを確認
              {addedSpotIds.size > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-1 rounded-full text-sm">
                  {addedSpotIds.size}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* プラン一覧シート */}
      {showRoutesSheet && (() => {
        const visibleRoutes = DUMMY_ROUTES // 実際のアプリではフィルタリングされたルートを使用
        
        return (
          <>
            {/* 背景オーバーレイ */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={() => setShowRoutesSheet(false)}
            />
            
          {/* シート本体 */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-xl z-50 max-h-[80vh] flex flex-col">
            {/* ハンドル */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                おすすめルート ({visibleRoutes.length}件)
              </h2>
              <button
                onClick={() => setShowRoutesSheet(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto p-4">
              {searchChips.length > 0 && (
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {searchChips.map((chip) => (
                      <span
                        key={chip.id}
                        className="inline-flex items-center px-2 py-1 text-xs bg-teal-100 text-teal-800 rounded-full"
                      >
                        {chip.label}
                        <button
                          onClick={() => removeSearchChip(chip.id)}
                          className="ml-1 text-teal-600 hover:text-teal-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={clearAllChips}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    クリア
                  </button>
                </div>
              )}
              
              <div className="space-y-3">
                {visibleRoutes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => {
                      onSelectRoute(route.id)
                      setShowRoutesSheet(false)
                    }}
                    className="w-full bg-gray-50 rounded-lg p-4 text-left hover:bg-gray-100 transition-colors"
                    aria-label={`${route.title}を選択`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {route.title}
                      </h3>
                      <span className="text-sm text-gray-500">{formatDuration(route.duration)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {route.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>作成: {route.author}</span>
                      <span>{route.spotCount}スポット</span>
                    </div>
                  </button>
                ))}
              </div>
              
              {visibleRoutes.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                  </div>
                  <p className="text-gray-500">条件に一致するルートがありません</p>
                  <p className="text-sm text-gray-400 mt-1">エリアやカテゴリーを変更してみてください</p>
                </div>
              )}
            </div>
          </div>
        </>
        )
      })()}

      {/* エリア選択スライドシート */}
      {areaSheetVisible && (
        <>
          {/* 背景オーバーレイ */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setAreaSheetVisible(false)}
          />
          
          {/* スライドシート */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[70vh] flex flex-col">
            {/* ハンドル */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            
            {/* ヘッダー */}
            <div className="px-4 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  エリアを選択
                </h2>
                <button
                  onClick={() => setAreaSheetVisible(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedRegion ? (
                // 地方選択画面
                <div className="space-y-3">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">地方を選択してください</h3>
                  </div>
                  {REGIONS.map((region) => (
                    <button
                      key={region.id}
                      onClick={() => handleRegionSelect(region.id)}
                      className="w-full p-4 rounded-lg border border-gray-200 text-left transition-all hover:border-teal-400 hover:bg-teal-50 flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-800">{region.name}</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                // 都道府県選択画面
                <div className="space-y-3">
                  <div className="mb-4 flex items-center">
                    <button
                      onClick={() => setSelectedRegion(null)}
                      className="mr-2 p-1 rounded-lg hover:bg-gray-100"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                      </svg>
                    </button>
                    <h3 className="text-sm font-medium text-gray-700">
                      {REGIONS.find(r => r.id === selectedRegion)?.name}の都道府県
                    </h3>
                  </div>
                  {PREFECTURES_BY_REGION[selectedRegion]?.map((prefecture) => (
                    <button
                      key={prefecture}
                      onClick={() => handlePrefectureSelect(prefecture)}
                      className="w-full p-4 rounded-lg border border-gray-200 text-left transition-all hover:border-teal-400 hover:bg-teal-50"
                    >
                      <span className="font-medium text-gray-800">{prefecture}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* カテゴリー選択シート */}
      {showCategorySheet && (
        <>
          {/* オーバーレイ */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowCategorySheet(false)}
          />
          
          {/* シート本体 */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-xl z-50 max-h-[80vh] flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">カテゴリー選択</h2>
              <button
                onClick={() => setShowCategorySheet(false)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* カテゴリ選択 */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    カテゴリを選択してください（1つまで）
                  </label>
                  
                  <div className="space-y-3">
                    {SPOT_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`w-full p-4 rounded-lg border text-left transition-all ${
                          selectedCategories.includes(category.id)
                            ? 'border-teal-500 bg-teal-50 text-teal-900' 
                            : 'border-gray-200 hover:border-teal-400 hover:bg-teal-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <CategoryIcon iconType={category.icon} className="w-6 h-6 text-gray-600" />
                          <div>
                            <div className="font-medium text-gray-800">{category.label}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* エラートースト */}
      {error && (
        <div className="absolute top-20 left-4 right-4 bg-red-500 text-white p-3 rounded-lg shadow-lg z-50 mt-20">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium">エラーが発生しました</p>
              <p className="text-xs mt-1 opacity-90">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100"
              aria-label="エラーを閉じる"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      
      
      {/* ルート確認CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 p-4">
        <button
          onClick={() => {
            // ルート確認画面にデータを渡すためのセッションストレージを使用
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('routeSpots', JSON.stringify(routeSpots))
            }
            router.push('/plan/confirm')
          }}
          disabled={routeSpots.length === 0}
          className="w-full py-4 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          style={{
            backgroundColor: routeSpots.length > 0 ? '#2db5a5' : '#9ca3af'
          }}
        >
          <span>作ったルートを確認</span>
          {routeSpots.length > 0 && (
            <span className="bg-white text-teal-600 px-2 py-1 rounded-full text-sm font-bold min-w-[24px] h-6 flex items-center justify-center">
              {routeSpots.length}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}