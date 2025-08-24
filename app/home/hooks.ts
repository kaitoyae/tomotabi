// app/home/hooks.ts
// カスタムhooks・ビジネスロジックファイル（200行以下）

import { useState, useRef, useCallback, useEffect } from 'react'
import type { OverpassSpot, RouteSpot, SearchChip } from './types'
import { fetchAddressFromNominatim, fetchSpotsFromOverpass, fetchSpotsFromOverpassBounds, getCacheKey, getCachedSpots, setCachedSpots } from './api'
import { AREA_OPTIONS } from './constants'
import { parseNaturalText } from './utils'

// ブラウザ環境チェック関数
const isClientSide = () => {
  return typeof window !== 'undefined'
}

// レスポンシブタグスクロール機能のカスタムhook
export const useResponsiveTagScroll = () => {
  const [visibleTagCount, setVisibleTagCount] = useState<number>(8) // コンパクトモバイルデフォルト
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false)
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true)
  const tagScrollRef = useRef<HTMLDivElement>(null)

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

  return {
    visibleTagCount,
    canScrollLeft,
    canScrollRight,
    tagScrollRef,
    scrollTags
  }
}

// シート表示状態管理のカスタムhook
export const useSheetVisibility = () => {
  const [showCategorySheet, setShowCategorySheet] = useState<boolean>(false)
  const [areaSheetVisible, setAreaSheetVisible] = useState<boolean>(false)
  const [showRoutesSheet, setShowRoutesSheet] = useState<boolean>(false)

  // カテゴリーシート制御
  const openCategorySheet = useCallback(() => {
    setShowCategorySheet(true)
  }, [])

  const closeCategorySheet = useCallback(() => {
    setShowCategorySheet(false)
  }, [])

  // エリアシート制御
  const openAreaSheet = useCallback(() => {
    setAreaSheetVisible(true)
  }, [])

  const closeAreaSheet = useCallback(() => {
    setAreaSheetVisible(false)
  }, [])

  // ルート一覧シート制御
  const openRoutesSheet = useCallback(() => {
    setShowRoutesSheet(true)
  }, [])

  const closeRoutesSheet = useCallback(() => {
    setShowRoutesSheet(false)
  }, [])

  return {
    // 状態
    showCategorySheet,
    areaSheetVisible, 
    showRoutesSheet,
    // アクション
    openCategorySheet,
    closeCategorySheet,
    openAreaSheet,
    closeAreaSheet,
    openRoutesSheet,
    closeRoutesSheet
  }
}

// 検索入力状態管理のカスタムhook
export const useSearchInput = () => {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [areaSearchQuery, setAreaSearchQuery] = useState<string>('')

  // 検索クエリ更新
  const updateSearchQuery = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  // 検索クエリクリア
  const clearSearchQuery = useCallback(() => {
    setSearchQuery('')
  }, [])

  // カテゴリー選択更新
  const updateSelectedCategory = useCallback((category: string | null) => {
    setSelectedCategory(category)
  }, [])

  // エリア検索クエリ更新
  const updateAreaSearchQuery = useCallback((value: string) => {
    setAreaSearchQuery(value)
  }, [])

  // エリア検索クエリクリア
  const clearAreaSearchQuery = useCallback(() => {
    setAreaSearchQuery('')
  }, [])

  return {
    // 状態
    searchQuery,
    selectedCategory,
    areaSearchQuery,
    // アクション
    updateSearchQuery,
    clearSearchQuery,
    updateSelectedCategory,
    updateAreaSearchQuery,
    clearAreaSearchQuery
  }
}

// 位置情報基本状態管理のカスタムhook（Phase 1: 状態 + Phase 2: コア機能）
export const useLocationState = () => {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [deviceHeading, setDeviceHeading] = useState<number>(0)
  const [locationAccuracy, setLocationAccuracy] = useState<number>(0)
  const [orientationPermissionNeeded, setOrientationPermissionNeeded] = useState<boolean>(false)
  const [locationRequestInProgress, setLocationRequestInProgress] = useState<boolean>(false)
  const [hasUserGesture, setHasUserGesture] = useState<boolean>(false)
  
  // Phase 2: 位置情報取得処理用のRef
  const locationRequestRef = useRef<boolean>(false)

  // 位置情報更新
  const updateCurrentLocation = useCallback((location: [number, number] | null) => {
    setCurrentLocation(location)
  }, [])

  // 位置精度更新
  const updateLocationAccuracy = useCallback((accuracy: number) => {
    setLocationAccuracy(accuracy)
  }, [])

  // デバイス方位更新
  const updateDeviceHeading = useCallback((heading: number) => {
    setDeviceHeading(heading)
  }, [])

  // 監視ID更新
  const updateWatchId = useCallback((id: number | null) => {
    setWatchId(id)
  }, [])

  // 制御フラグ更新
  const updateOrientationPermissionNeeded = useCallback((needed: boolean) => {
    setOrientationPermissionNeeded(needed)
  }, [])

  const updateLocationRequestInProgress = useCallback((inProgress: boolean) => {
    setLocationRequestInProgress(inProgress)
  }, [])

  const updateHasUserGesture = useCallback((hasGesture: boolean) => {
    setHasUserGesture(hasGesture)
  }, [])

  // Phase 2: 位置情報の継続監視
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
        updateCurrentLocation([longitude, latitude])
        updateLocationAccuracy(accuracy || 50)
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
    
    updateWatchId(newWatchId)
  }, [watchId, updateCurrentLocation, updateLocationAccuracy, updateWatchId])

  // Phase 2: 位置情報取得関数（重複実行防止強化版）
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
    updateLocationRequestInProgress(true)

    const FALLBACK_LOCATION: [number, number] = [139.5, 35.7] // 東京都心部広域
    
    try {
      console.log('📍 位置情報取得開始 - 環境情報:', {
        userAgent: navigator.userAgent,
        isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
        protocol: typeof window !== 'undefined' ? window.location.protocol : '',
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
        hasUserGesture
      })

      // iOS Safari検出
      const isIosSafari = /iPhone|iPad/.test(navigator.userAgent) && 
                         /Safari/.test(navigator.userAgent) && 
                         !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
      
      console.log('📍 ブラウザタイプ:', isIosSafari ? 'iOS Safari' : 'その他')
      
      // 許可状態を確認
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          console.log('📍 位置情報許可状態:', permission.state)
          
          if (permission.state === 'denied') {
            console.log('⚠️ 位置情報許可が拒否されています、フォールバック使用')
            updateCurrentLocation(FALLBACK_LOCATION)
            updateLocationAccuracy(50)
            return false
          }
        } catch (error) {
          console.log('📍 許可状態確認不可、位置情報取得を継続します')
        }
      }

      // ブラウザ別最適化設定（CoreLocation・Chrome対応）
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
      updateCurrentLocation(newLocation)
      updateLocationAccuracy(accuracy || 100)
      console.log('📍 currentLocation状態更新:', newLocation)
      
      // 成功したら継続監視開始
      startLocationWatch()
      return true

    } catch (error: any) {
      console.log('❌ 位置情報取得失敗（即座にフォールバック使用）:', error.message)
      
      // 再試行は行わず、即座にフォールバック位置を使用
      console.log('🔄 フォールバック位置を使用:', FALLBACK_LOCATION)
      updateCurrentLocation(FALLBACK_LOCATION)
      updateLocationAccuracy(50)
      return false
    } finally {
      locationRequestRef.current = false
      updateLocationRequestInProgress(false)
    }
  }, [hasUserGesture, watchId, startLocationWatch, locationRequestInProgress, updateCurrentLocation, updateLocationAccuracy, updateLocationRequestInProgress])

  return {
    // 状態
    currentLocation,
    watchId,
    deviceHeading,
    locationAccuracy,
    orientationPermissionNeeded,
    locationRequestInProgress,
    hasUserGesture,
    // 更新関数
    updateCurrentLocation,
    updateLocationAccuracy,
    updateDeviceHeading,
    updateWatchId,
    updateOrientationPermissionNeeded,
    updateLocationRequestInProgress,
    updateHasUserGesture,
    // Phase 2: コア機能
    startLocationWatch,
    requestLocationPermission
  }
}

// スポット管理基本状態のカスタムhook（Step 1: 純粋な状態管理のみ）
export const useSpotState = () => {
  const [spots, setSpots] = useState<OverpassSpot[]>([])
  const [selectedSpot, setSelectedSpot] = useState<OverpassSpot | null>(null)
  const [routeSpots, setRouteSpots] = useState<RouteSpot[]>([])
  const [spotsLoading, setSpotsLoading] = useState<boolean>(false)
  const [addedSpotIds, setAddedSpotIds] = useState<Set<string>>(new Set())

  // スポット一覧更新
  const updateSpots = useCallback((newSpots: OverpassSpot[]) => {
    setSpots(newSpots)
  }, [])

  // スポット選択更新
  const updateSelectedSpot = useCallback((spot: OverpassSpot | null) => {
    setSelectedSpot(spot)
  }, [])

  // ルートスポット更新
  const updateRouteSpots = useCallback((newRouteSpots: RouteSpot[]) => {
    setRouteSpots(newRouteSpots)
  }, [])

  // ルートスポット追加
  const addToRouteSpots = useCallback((spotToAdd: RouteSpot) => {
    setRouteSpots(prev => [...prev, spotToAdd])
  }, [])

  // ローディング状態更新
  const updateSpotsLoading = useCallback((loading: boolean) => {
    setSpotsLoading(loading)
  }, [])

  // 追加済みスポットID更新
  const updateAddedSpotIds = useCallback((ids: Set<string>) => {
    setAddedSpotIds(ids)
  }, [])

  // スポットID追加
  const addSpotId = useCallback((spotId: string) => {
    setAddedSpotIds(prev => new Set(Array.from(prev).concat(spotId)))
  }, [])

  // スポットID削除
  const removeSpotId = useCallback((spotId: string) => {
    setAddedSpotIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(spotId)
      return newSet
    })
  }, [])

  return {
    // 状態
    spots,
    selectedSpot,
    routeSpots,
    spotsLoading,
    addedSpotIds,
    // 更新関数
    updateSpots,
    updateSelectedSpot,
    updateRouteSpots,
    addToRouteSpots,
    updateSpotsLoading,
    updateAddedSpotIds,
    addSpotId,
    removeSpotId
  }
}
// TODO: app/home/page.tsx からカスタムhooksを移動予定
// - 地図状態管理hooks
// - Step 2: スポット検索ビジネスロジック
// - ルート作成hooks
// - フィルター管理hooks
// - その他ビジネスロジック

// Step2: スポットビジネスロジック（地図依存なし）
export const useSpotBusinessLogic = (
  spotState: ReturnType<typeof useSpotState>
) => {
  const {
    updateSelectedSpot,
    addToRouteSpots,
    addSpotId
  } = spotState

  // スポットクリック時の住所補完処理
  const handleSpotClick = useCallback(async (spot: OverpassSpot) => {
    // 住所が不完全な場合はNominatim APIで補完
    if (!spot.address) {
      const address = await fetchAddressFromNominatim(spot.lat, spot.lng)
      spot.address = address
    }
    
    updateSelectedSpot(spot)
    // UI状態の変更は呼び出し元で実行（setSpotInfoCardVisible(true)）
  }, [updateSelectedSpot])

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
    
    addToRouteSpots(routeSpot)
    addSpotId(spot.id)
    // UI状態の変更は呼び出し元で実行（setSpotInfoCardVisible(false), updateSelectedSpot(null)）
  }, [addToRouteSpots, addSpotId])

  return {
    handleSpotClick,
    addSpotToRoute
  }
}

// カテゴリー・エリア選択の基本状態管理
export const useCategoryAreaState = () => {
  // カテゴリー選択状態
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['restaurant'])
  
  // エリア選択状態
  const [selectedAreaId, setSelectedAreaId] = useState<string>('current')
  
  // 地域選択状態（都道府県選択用）
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  // カテゴリー更新関数
  const updateSelectedCategories = useCallback((categories: string[]) => {
    setSelectedCategories(categories)
  }, [])

  // エリア更新関数
  const updateSelectedAreaId = useCallback((areaId: string) => {
    setSelectedAreaId(areaId)
  }, [])

  // 地域更新関数
  const updateSelectedRegion = useCallback((regionId: string | null) => {
    setSelectedRegion(regionId)
  }, [])

  // 現在の選択状態を取得するgetter関数
  const getCurrentSelections = useCallback(() => ({
    categories: selectedCategories,
    areaId: selectedAreaId,
    region: selectedRegion
  }), [selectedCategories, selectedAreaId, selectedRegion])

  return {
    // 状態
    selectedCategories,
    selectedAreaId,
    selectedRegion,
    
    // 更新関数
    updateSelectedCategories,
    updateSelectedAreaId,
    updateSelectedRegion,
    
    // getter
    getCurrentSelections
  }
}

// カテゴリー・エリア選択のビジネスロジック
export const useCategoryAreaBusinessLogic = (categoryAreaState: ReturnType<typeof useCategoryAreaState>) => {
  const { updateSelectedCategories, updateSelectedAreaId, updateSelectedRegion } = categoryAreaState

  // カテゴリー選択のビジネスロジック（純粋関数）
  const selectCategory = useCallback((categoryId: string) => {
    // 単一選択でカテゴリーを更新
    updateSelectedCategories([categoryId])
    
    // 選択されたカテゴリー情報を返す（UI側で検索バー更新に使用）
    return { categoryId, shouldUpdateSearch: true }
  }, [updateSelectedCategories])

  // エリア選択のビジネスロジック（純粋関数）
  const selectArea = useCallback((areaId: string) => {
    updateSelectedAreaId(areaId)
    
    return { areaId, shouldCloseSheet: true }
  }, [updateSelectedAreaId])

  // 地域選択のビジネスロジック（純粋関数）
  const selectRegion = useCallback((regionId: string) => {
    updateSelectedRegion(regionId)
    
    return { regionId, shouldShowPrefectures: true }
  }, [updateSelectedRegion])

  // 都道府県選択のビジネスロジック（純粋関数）
  const selectPrefecture = useCallback((prefecture: string) => {
    // 地域選択をリセット（都道府県選択完了時）
    updateSelectedRegion(null)
    
    return { 
      prefecture, 
      shouldUpdateSearch: true,
      shouldAddChip: true,
      shouldCloseSheet: true,
      shouldFetchBoundary: true
    }
  }, [updateSelectedRegion])

  // エリアボタンクリック時のロジック
  const prepareAreaSelection = useCallback(() => {
    updateSelectedRegion(null)
    
    return { shouldOpenSheet: true, shouldClearSearch: true }
  }, [updateSelectedRegion])

  return {
    selectCategory,
    selectArea,
    selectRegion,
    selectPrefecture,
    prepareAreaSelection
  }
}

// スポット取得の純粋なAPIロジック（UI状態に依存しない）
export const useSpotFetching = () => {
  
  // 純粋なスポット取得ロジック（APIのみ）
  const fetchSpotsData = useCallback(async (
    categoryAreaState: ReturnType<typeof useCategoryAreaState>,
    currentLocation: [number, number] | null
  ) => {
    const { selectedAreaId, selectedCategories } = categoryAreaState
    
    console.log('🔍 スポット取得開始:', {
      hasCurrentLocation: !!currentLocation,
      selectedAreaId,
      selectedCategories: selectedCategories.length
    })
    
    // 現在地が必要だが取得できていない場合
    if (!currentLocation && selectedAreaId === 'current') {
      console.log('⏳ 現在地未取得のため取得をスキップ')
      return { 
        spots: null, 
        error: null,
        shouldSkip: true,
        cacheKey: null
      }
    }

    try {
      let centerLat: number, centerLng: number, radius: number
      
      // 座標とradiusの計算（純粋な計算処理）
      if (selectedAreaId === 'current' && currentLocation) {
        [centerLng, centerLat] = currentLocation
        radius = 2
        console.log('📍 現在地中心でスポット検索:', { centerLat, centerLng, radius })
      } else {
        const areaOption = AREA_OPTIONS.find(area => area.id === selectedAreaId)
        if (!areaOption) {
          console.log('⚠️ エリアオプションが見つかりません:', selectedAreaId)
          return { 
            spots: null, 
            error: 'エリアオプションが見つかりません',
            shouldSkip: false,
            cacheKey: null
          }
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
        return { 
          spots: cachedSpots, 
          error: null,
          shouldSkip: false,
          cacheKey,
          fromCache: true
        }
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
      
      return { 
        spots: fetchedSpots, 
        error: null,
        shouldSkip: false,
        cacheKey,
        fromCache: false
      }
      
    } catch (error) {
      console.error('❌ スポット取得エラー:', error)
      return { 
        spots: null, 
        error: 'スポットの取得に失敗しました',
        shouldSkip: false,
        cacheKey: null
      }
    }
  }, [])

  // 地図範囲ベースの純粋なスポット取得ロジック（bounds API使用・キャッシュ対応）
  const fetchSpotsDataForBounds = useCallback(async (
    bounds: { south: number; west: number; north: number; east: number },
    categories: string[]
  ) => {
    console.log('🗺️ 地図範囲ベーススポット取得開始:', { bounds, categories: categories.length })
    
    try {
      // 現在選択されているカテゴリーを使用（デフォルトは飲食店）
      const finalCategories = categories.length > 0 ? categories : ['restaurant']
      
      // スマートキャッシュ戦略: より広い範囲でキャッシュ（レート制限対策）
      // 0.02度（約2km）単位で丸めて、隣接範囲も同じキャッシュを使用
      const cacheGrid = 0.02 // 約2km単位のグリッド
      const roundedBounds = {
        south: Math.floor(bounds.south / cacheGrid) * cacheGrid,
        west: Math.floor(bounds.west / cacheGrid) * cacheGrid,
        north: Math.ceil(bounds.north / cacheGrid) * cacheGrid,
        east: Math.ceil(bounds.east / cacheGrid) * cacheGrid
      }
      
      // さらに余裕を持ったキャッシュ範囲（API呼び出し頻度削減）
      const expandedBounds = {
        south: roundedBounds.south - cacheGrid,
        west: roundedBounds.west - cacheGrid,
        north: roundedBounds.north + cacheGrid,
        east: roundedBounds.east + cacheGrid
      }
      
      const boundsCacheKey = `smart_bounds_${expandedBounds.south}_${expandedBounds.west}_${expandedBounds.north}_${expandedBounds.east}_${finalCategories.sort().join('_')}`
      console.log('🗂️ 範囲ベースキャッシュキー:', boundsCacheKey)
      
      // キャッシュから取得を試行
      const cachedSpots = getCachedSpots(boundsCacheKey)
      if (cachedSpots) {
        console.log('💾 範囲ベースキャッシュからスポットを取得:', cachedSpots.length, '件')
        return { 
          spots: cachedSpots, 
          error: null,
          shouldSkip: false,
          fromBounds: true,
          fromCache: true
        }
      }
      
      // キャッシュにない場合のみAPIを呼び出し（拡張範囲で取得）
      console.log('🌐 Overpass API (bounds) からスポットを取得中:', { 
        originalBounds: bounds, 
        expandedBounds, 
        categories: finalCategories,
        cacheStrategy: '広域取得でキャッシュ効率向上'
      })
      const fetchedSpots = await fetchSpotsFromOverpassBounds(expandedBounds, finalCategories)
      console.log('✅ Overpass API (bounds) から取得完了:', fetchedSpots.length, '件')
      
      // キャッシュに保存
      if (fetchedSpots && fetchedSpots.length > 0) {
        setCachedSpots(boundsCacheKey, fetchedSpots)
        console.log('💾 範囲ベースキャッシュに保存完了')
      }
      
      return { 
        spots: fetchedSpots, 
        error: null,
        shouldSkip: false,
        fromBounds: true,
        fromCache: false
      }
      
    } catch (error) {
      console.error('❌ 地図範囲ベーススポット取得エラー:', error)
      return { 
        spots: null, 
        error: '地図範囲でのスポット取得に失敗しました（レート制限の可能性）',
        shouldSkip: false,
        fromBounds: true
      }
    }
  }, [])

  return {
    fetchSpotsData,
    fetchSpotsDataForBounds
  }
}

// UI統合ラッパー関数のカスタムhook
export const useUIWrapperFunctions = (dependencies: {
  // スポット関連依存
  handleSpotClick: (spot: OverpassSpot) => Promise<void>
  addSpotToRoute: (spot: OverpassSpot, stayTime?: number) => void
  setSpotInfoCardVisible: (visible: boolean) => void
  updateSelectedSpot: (spot: OverpassSpot | null) => void
  
  // カテゴリー・エリア選択依存
  prepareAreaSelection: () => { shouldOpenSheet: boolean; shouldClearSearch: boolean }
  selectArea: (areaId: string) => { shouldCloseSheet: boolean }
  selectRegion: (regionId: string) => void
  selectPrefecture: (prefecture: string) => {
    shouldUpdateSearch: boolean
    shouldAddChip: boolean
    shouldCloseSheet: boolean
    shouldFetchBoundary: boolean
  }
  selectCategory: (categoryId: string) => { shouldUpdateSearch: boolean }
  
  // UI状態管理依存
  openAreaSheet: () => void
  closeAreaSheet: () => void
  openCategorySheet: () => void
  closeCategorySheet: () => void
  clearAreaSearchQuery: () => void
  
  // 検索関連依存
  updateSearchQuery: (query: string) => void
  clearSearchQuery: () => void
  updateSelectedCategory: (category: string | null) => void
  clearPrefectureHighlight: () => void
  
  // その他依存
  router: any
  searchQuery: string
  parseNaturalText: (text: string) => any[]
  searchChips: any[]
  setSearchChips: (chips: any) => void
  addSearchChip: (chip: any) => void
  SPOT_CATEGORIES: any[]
  fetchAndShowPrefectureBoundary?: (prefecture: string) => Promise<void>
}) => {
  const {
    handleSpotClick, addSpotToRoute, setSpotInfoCardVisible, updateSelectedSpot,
    prepareAreaSelection, selectArea, selectRegion, selectPrefecture, selectCategory,
    openAreaSheet, closeAreaSheet, openCategorySheet, closeCategorySheet, clearAreaSearchQuery,
    updateSearchQuery, clearSearchQuery, updateSelectedCategory, clearPrefectureHighlight,
    router, searchQuery, parseNaturalText, searchChips, setSearchChips, addSearchChip,
    SPOT_CATEGORIES, fetchAndShowPrefectureBoundary
  } = dependencies

  // UI状態を含むスポットクリック処理のラッパー
  const handleSpotClickWithUI = useCallback(async (spot: OverpassSpot) => {
    await handleSpotClick(spot)
    setSpotInfoCardVisible(true)
  }, [handleSpotClick, setSpotInfoCardVisible])
  
  // UI状態を含むルート追加処理のラッパー
  const addSpotToRouteWithUI = useCallback((spot: OverpassSpot, stayTime: number = 60) => {
    addSpotToRoute(spot, stayTime)
    setSpotInfoCardVisible(false)
    updateSelectedSpot(null)
  }, [addSpotToRoute, setSpotInfoCardVisible, updateSelectedSpot])

  // ナビゲーション関数群
  const onCreateRoute = useCallback(() => {
    router.push('/plan/create')
  }, [router])

  const onProfile = useCallback(() => {
    router.push('/profile')
  }, [router])
  
  const onSelectRoute = useCallback((routeId: string) => {
    router.push(`/route/${routeId}`)
  }, [router])

  // 検索関連のUI統合関数
  const handleSearchInputChange = useCallback((value: string) => {
    updateSearchQuery(value)
    // 検索バーが空になった場合は県境ハイライトを削除
    if (!value.trim()) {
      clearPrefectureHighlight()
    }
  }, [updateSearchQuery, clearPrefectureHighlight])

  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) return
    
    // 自然文パースでチップ化
    const parsedChips = parseNaturalText(searchQuery.trim())
    
    // 既存のチップと重複しないように追加
    const newChips = parsedChips.filter((chip: any) => 
      !searchChips.some((existing: any) => existing.id === chip.id)
    )
    
    setSearchChips((prev: any[]) => [...prev, ...newChips])
    clearSearchQuery()
  }, [searchQuery, parseNaturalText, searchChips, setSearchChips, clearSearchQuery])

  // カテゴリー・エリア選択のwrapper関数（UI統合版）
  const handleAreaButtonClick = useCallback(() => {
    const { shouldOpenSheet, shouldClearSearch } = prepareAreaSelection()
    
    if (shouldOpenSheet) {
      openAreaSheet()
    }
    if (shouldClearSearch) {
      clearAreaSearchQuery()
    }
  }, [prepareAreaSelection, openAreaSheet, clearAreaSearchQuery])
  
  const handleAreaSelect = useCallback((areaId: string) => {
    const { shouldCloseSheet } = selectArea(areaId)
    
    if (shouldCloseSheet) {
      closeAreaSheet()
    }
  }, [selectArea, closeAreaSheet])

  const handleRegionSelect = useCallback((regionId: string) => {
    selectRegion(regionId)
    // UI側では何もしない（都道府県リスト表示は状態で制御）
  }, [selectRegion])

  const handlePrefectureSelect = useCallback(async (prefecture: string) => {
    const { 
      shouldUpdateSearch, shouldAddChip, shouldCloseSheet, shouldFetchBoundary
    } = selectPrefecture(prefecture)
    
    if (shouldUpdateSearch) {
      updateSearchQuery(prefecture)
    }
    
    if (shouldAddChip) {
      const chip: any = {
        id: `area-${prefecture}`,
        type: 'area',
        label: prefecture,
        value: prefecture
      }
      addSearchChip(chip)
    }
    
    if (shouldFetchBoundary && fetchAndShowPrefectureBoundary) {
      try {
        await fetchAndShowPrefectureBoundary(prefecture)
      } catch (error) {
        console.error('エリア検索でエラーが発生しました:', error)
      }
    }
    
    if (shouldCloseSheet) {
      closeAreaSheet()
      clearAreaSearchQuery()
    }
  }, [selectPrefecture, updateSearchQuery, addSearchChip, closeAreaSheet, clearAreaSearchQuery, fetchAndShowPrefectureBoundary])

  // カテゴリー選択関連の関数
  const handleCategoryButtonClick = useCallback(() => {
    openCategorySheet()
  }, [openCategorySheet])

  const handleCategorySelect = useCallback((categoryId: string) => {
    const { shouldUpdateSearch } = selectCategory(categoryId)
    
    if (shouldUpdateSearch) {
      const category = SPOT_CATEGORIES.find((cat: any) => cat.id === categoryId)
      if (category) {
        updateSearchQuery(category.label)
      }
    }
    
    // シートを閉じる
    closeCategorySheet()
  }, [selectCategory, updateSearchQuery, closeCategorySheet, SPOT_CATEGORIES])

  const handleCategoryToggle = useCallback((category: string) => {
    updateSearchQuery(category)
    
    // カテゴリーチップを追加
    const chip: any = {
      id: `tag-${category}`,
      type: 'tag',
      label: category,
      value: category
    }
    addSearchChip(chip)
    
    closeCategorySheet()
    updateSelectedCategory(null)
  }, [updateSearchQuery, addSearchChip, closeCategorySheet, updateSelectedCategory])

  return {
    // スポット関連UI統合関数
    handleSpotClickWithUI,
    addSpotToRouteWithUI,
    
    // ナビゲーション関数
    onCreateRoute,
    onProfile,
    onSelectRoute,
    
    // 検索関連UI統合関数
    handleSearchInputChange,
    handleSearchSubmit,
    
    // カテゴリー・エリア選択UI統合関数
    handleAreaButtonClick,
    handleAreaSelect,
    handleRegionSelect,
    handlePrefectureSelect,
    handleCategoryButtonClick,
    handleCategorySelect,
    handleCategoryToggle
  }
}

export const usePlaceholder = () => {
  // 段階2で実際のhooksに置き換えられます
  return {}
}