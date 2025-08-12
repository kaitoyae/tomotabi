'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Route as ApiRoute, listRecommendedRoutes } from '../lib/mock-api'

// ホーム画面用のRoute型（API型を拡張）
type HomeRoute = {
  id: string
  title: string
  duration: number // 分単位
  tags: string[]
  author: string
  spotCount: number
  coordinates: [number, number][]
  cover?: string
}

type RouteGroup = {
  id: string
  routes: HomeRoute[]
  centerCoordinate: [number, number]
  currentIndex: number
}

type SwipeState = 'closed' | 'open'
type BottomSheetMode = 'routes' | 'filter'

// 検索チップの型定義
type SearchChip = {
  id: string
  type: 'budget' | 'tag' | 'area' | 'spot'
  label: string
  value: string
}

// 絞り込み条件の状態
type FilterState = {
  budget: string | null // '1000', '2000', '3000', 'custom:1000-3000'
  area: {
    type: 'distance' | 'location' | 'name' | null
    value: string | null // '1km', '3km', '5km' | '139.8107,35.7101' | '浅草'
  }
  tags: string[] // 最大3つ
  customBudget: { min: number, max: number } | null
}

// DeviceOrientationEventの型拡張
interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number
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

// API Route型からHomeRoute型への変換関数
const convertApiRouteToHomeRoute = (apiRoute: ApiRoute): HomeRoute => {
  // durationを数値（分）に変換
  const getDurationInMinutes = (duration: string): number => {
    switch (duration) {
      case '90m': return 90
      case 'half': return 240 // 4時間
      case 'day': return 480 // 8時間
      case '2days': return 1440 // 24時間
      case '3days': return 2880 // 48時間
      case '4days': return 4320 // 72時間
      case '5days': return 5760 // 96時間
      case '7days': return 8640 // 144時間
      default: return 180 // デフォルト3時間
    }
  }

  return {
    id: apiRoute.id,
    title: apiRoute.title,
    duration: getDurationInMinutes(apiRoute.duration),
    tags: apiRoute.tags,
    author: apiRoute.author,
    spotCount: apiRoute.spots.length,
    coordinates: apiRoute.spots.map(spot => [spot.lng, spot.lat] as [number, number]),
    cover: apiRoute.cover
  }
}

// ダミーデータ（墨田区エリア） - 一時的に維持
const DUMMY_ROUTES: HomeRoute[] = [
  {
    id: '1',
    title: 'スカイツリー・ソラマチ王道コース',
    duration: 180,
    tags: ['観光', 'ショッピング', '絶景'],
    author: 'スカイツリー案内人',
    spotCount: 4,
    coordinates: [
      [139.8107, 35.7101], // スカイツリー
      [139.8099, 35.7096], // ソラマチ
      [139.8089, 35.7088], // すみだ水族館
      [139.8112, 35.7085]  // プラネタリウム
    ],
    cover: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
  },
  {
    id: '2',
    title: '両国相撲・江戸文化探訪',
    duration: 120,
    tags: ['相撲', '歴史', '文化'],
    author: '両国マスター',
    spotCount: 5,
    coordinates: [
      [139.7929, 35.6969], // 両国国技館
      [139.7925, 35.6965], // 江戸東京博物館
      [139.7918, 35.6958], // 旧安田庭園
      [139.7935, 35.6972], // ちゃんこ横丁
      [139.7922, 35.6975]  // 両国駅周辺
    ],
    cover: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop'
  },
  {
    id: '3',
    title: '隅田川桜並木ウォーク',
    duration: 90,
    tags: ['桜', '散歩', '川辺'],
    author: '桜愛好家',
    spotCount: 6,
    coordinates: [
      [139.8048, 35.7120], // 隅田公園（台東区側）
      [139.8055, 35.7105], // 桜橋
      [139.8070, 35.7092], // 言問橋
      [139.8085, 35.7080], // 吾妻橋
      [139.8095, 35.7070], // 駒形橋
      [139.8105, 35.7055]  // 蔵前橋
    ],
    cover: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&h=300&fit=crop'
  },
  {
    id: '4',
    title: '押上下町カフェ巡り',
    duration: 150,
    tags: ['カフェ', 'スイーツ', '下町'],
    author: 'カフェマニア',
    spotCount: 5,
    coordinates: [
      [139.8120, 35.7108], // 押上駅前カフェ
      [139.8098, 35.7115], // 隠れ家カフェ
      [139.8075, 35.7125], // レトロ喫茶
      [139.8052, 35.7118], // ベーカリーカフェ
      [139.8088, 35.7102]  // スペシャリティコーヒー
    ],
    cover: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'
  },
  {
    id: '5',
    title: '向島花街・芸者文化体験',
    duration: 120,
    tags: ['芸者', '伝統', '花街'],
    author: '向島ガイド',
    spotCount: 4,
    coordinates: [
      [139.8035, 35.7145], // 向島花街
      [139.8028, 35.7138], // 料亭街
      [139.8042, 35.7152], // 三囲神社
      [139.8038, 35.7148]  // 長命寺桜餅本舗
    ],
    cover: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
  },
  {
    id: '6',
    title: '錦糸町グルメ食べ歩き',
    duration: 180,
    tags: ['グルメ', '食べ歩き', 'B級'],
    author: 'グルメ探偵',
    spotCount: 6,
    coordinates: [
      [139.8139, 35.6967], // 錦糸町駅
      [139.8145, 35.6972], // 居酒屋横丁
      [139.8152, 35.6978], // ラーメン街
      [139.8138, 35.6975], // 焼肉通り
      [139.8142, 35.6968], // 立ち飲み街
      [139.8148, 35.6965]  // 夜市
    ],
    cover: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop'
  },
  {
    id: '7',
    title: '墨田川工場夜景クルーズ',
    duration: 90,
    tags: ['夜景', '工場', 'クルーズ'],
    author: '夜景フォトグラファー',
    spotCount: 3,
    coordinates: [
      [139.7890, 35.6885], // 船着場
      [139.7865, 35.6858], // 工場夜景スポット
      [139.7912, 35.6895]  // 橋梁夜景
    ],
    cover: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop'
  },
  {
    id: '8',
    title: 'すみだ北斎美術館・アート巡り',
    duration: 150,
    tags: ['美術', 'アート', '北斎'],
    author: 'アート愛好家',
    spotCount: 4,
    coordinates: [
      [139.8015, 35.6955], // すみだ北斎美術館
      [139.8008, 35.6962], // アートギャラリー
      [139.8025, 35.6948], // 現代美術スペース
      [139.8018, 35.6958]  // クラフト工房
    ],
    cover: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
  },
  {
    id: '9',
    title: '業平・本所深川の老舗めぐり',
    duration: 120,
    tags: ['老舗', '伝統工芸', '下町'],
    author: '伝統文化案内人',
    spotCount: 5,
    coordinates: [
      [139.8088, 35.6988], // 業平橋
      [139.8095, 35.6995], // 伝統工芸店
      [139.8078, 35.6975], // 老舗和菓子店
      [139.8102, 35.6982], // 江戸切子工房
      [139.8085, 35.6992]  // 畳職人工房
    ],
    cover: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
  },
  {
    id: '10',
    title: '東武博物館・鉄道ファン聖地',
    duration: 90,
    tags: ['鉄道', '博物館', 'ファミリー'],
    author: '鉄道マニア',
    spotCount: 3,
    coordinates: [
      [139.8158, 35.6945], // 東武博物館
      [139.8165, 35.6952], // 鉄道写真スポット
      [139.8148, 35.6938]  // 車両基地見学
    ],
    cover: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop'
  }
]

// 人気タグのダミーデータ
const POPULAR_TAGS = [
  'カフェ', '歴史', 'デート', 'ドライブ', '子連れ', '夜景', 
  '朝活', '雨の日', '公園', '美術館', '神社仏閣', 'ショッピング',
  'グルメ', '温泉', '自然', '写真映え'
]

// 予算選択肢
const BUDGET_OPTIONS = [
  { label: '指定なし', value: null },
  { label: '~¥1,000', value: '1000' },
  { label: '~¥2,000', value: '2000' },
  { label: '~¥3,000', value: '3000' },
  { label: '指定...', value: 'custom' }
]

// エリア選択肢  
const AREA_OPTIONS = [
  { label: '1km', value: '1km', type: 'distance' as const },
  { label: '3km', value: '3km', type: 'distance' as const },
  { label: '5km', value: '5km', type: 'distance' as const }
]

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
  
  // タグパターン（人気タグとの完全一致）
  POPULAR_TAGS.forEach(tag => {
    if (text.includes(tag)) {
      chips.push({
        id: `tag-${tag}`,
        type: 'tag',
        label: tag,
        value: tag
      })
    }
  })
  
  // エリアパターン（簡単な地名）
  const areaPatterns = ['浅草', '新宿', '渋谷', '池袋', '上野', '銀座', '表参道', '原宿']
  areaPatterns.forEach(area => {
    if (text.includes(area)) {
      chips.push({
        id: `area-${area}`,
        type: 'area',
        label: area,
        value: area
      })
    }
  })
  
  return chips
}

// モックAPI
const mockFetchRoutes = async (): Promise<HomeRoute[]> => {
  console.log('🏠 ホーム画面: ルート取得開始')
  try {
    // 実際のAPIからデータを取得
    console.log('📡 API呼び出し中...')
    const apiRoutes = await listRecommendedRoutes()
    console.log('📥 API取得完了:', apiRoutes.length, '件')
    console.log('📝 取得したルート:', apiRoutes.map(r => ({ id: r.id, title: r.title, spots: r.spots.length })))
    
    // API Route型からHomeRoute型に変換
    const homeRoutes = apiRoutes.map(convertApiRouteToHomeRoute)
    console.log('🔄 変換完了:', homeRoutes.length, '件')
    
    // 変換後の最初の3件の詳細を確認
    if (homeRoutes.length > 0) {
      console.log('🏠 変換後の最初の3件:')
      homeRoutes.slice(0, 3).forEach((route, index) => {
        console.log(`  ${index + 1}. ${route.title}`)
        console.log(`     ID: ${route.id}, 作者: ${route.author}`)
        console.log(`     座標数: ${route.coordinates.length}`)
        if (route.coordinates.length > 0) {
          console.log(`     最初の座標: [${route.coordinates[0][0]}, ${route.coordinates[0][1]}]`)
        }
      })
    }
    
    // 元のダミーデータは除外して、APIから取得したデータのみ使用
    return homeRoutes
  } catch (error) {
    console.error('❌ ルートの取得に失敗しました:', error)
    // エラー時はダミーデータのみ返す
    return DUMMY_ROUTES
  }
}

export default function HomePage() {
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const currentLocationMarker = useRef<maplibregl.Marker | null>(null)
  const planMarkers = useRef<maplibregl.Marker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [routes, setRoutes] = useState<HomeRoute[]>([])
  const [swipeState, setSwipeState] = useState<SwipeState>('closed')
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [visibleRoutes, setVisibleRoutes] = useState<HomeRoute[]>([])
  const [routeGroups, setRouteGroups] = useState<RouteGroup[]>([])
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
  const tagScrollRef = useRef<HTMLDivElement>(null)
  
  // 検索関連のstate
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode>('routes')
  const [searchChips, setSearchChips] = useState<SearchChip[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterState, setFilterState] = useState<FilterState>({
    budget: null,
    area: { type: null, value: null },
    tags: [],
    customBudget: null
  })
  const locationRequestRef = useRef<boolean>(false)

  // コールバック関数
  const onSelectRoute = (id: string) => {
    router.push(`/route/${id}`)
  }

  const onCreateRoute = () => {
    router.push('/plan/create')
  }

  const onProfile = () => {
    router.push('/profile')
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
    
    // 検索実行
    applyFilters([...searchChips, ...newChips])
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
    applyFilters(newChips)
  }

  const removeSearchChip = (chipId: string) => {
    const newChips = searchChips.filter(chip => chip.id !== chipId)
    setSearchChips(newChips)
    applyFilters(newChips)
  }

  const clearAllChips = () => {
    setSearchChips([])
    setFilterState({
      budget: null,
      area: { type: null, value: null },
      tags: [],
      customBudget: null
    })
    // 全ルートを表示
    setVisibleRoutes(routes)
  }

  const toggleFilterMode = () => {
    if (bottomSheetMode === 'filter' && swipeState === 'open') {
      // フィルターモードが開いている場合 → 閉じる（ルート表示に切り替えてから）
      closeBottomSheet()
      console.log('フィルターボトムシートを閉じました')
    } else {
      // その他の場合 → フィルターモードで開く
      setBottomSheetMode('filter')
      setSwipeState('open')
      console.log('フィルターボトムシートを開きました')
    }
  }

  const closeFilterAndShowRoutes = () => {
    setBottomSheetMode('routes')
    setSwipeState('open') // ルート表示モードで開く
    // 現在のチップに基づいてフィルタリング実行
    applyFilters(searchChips)
    console.log('フィルターモードを終了し、ルート表示モードに切り替えました')
  }

  const closeBottomSheet = () => {
    if (bottomSheetMode === 'filter') {
      // フィルターモードの場合はルート表示に切り替えてから閉じる
      setBottomSheetMode('routes')
    }
    setSwipeState('closed')
    console.log('ボトムシートを閉じました')
  }

  const applyFilters = (chips: SearchChip[]) => {
    // チップから絞り込み条件を構築
    const budget = chips.find(c => c.type === 'budget')?.value || null
    const area = chips.find(c => c.type === 'area')?.value || null
    const tags = chips.filter(c => c.type === 'tag').map(c => c.value)
    
    // フィルターロジック（ダミー実装）
    let filteredRoutes = [...routes]
    
    // タグフィルタリング
    if (tags.length > 0) {
      filteredRoutes = filteredRoutes.filter(route => 
        tags.some(tag => route.tags.includes(tag))
      )
    }
    
    // エリアフィルタリング（簡単な実装）
    if (area) {
      // エリア名が含まれるルートを検索
      filteredRoutes = filteredRoutes.filter(route => 
        route.title.includes(area) || route.tags.includes(area)
      )
    }
    
    setVisibleRoutes(filteredRoutes)
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

  // Google Map風の現在地マーカーを作成
  const createCurrentLocationMarker = () => {
    const el = document.createElement('div')
    el.style.cssText = `
      position: relative;
      width: 36px;
      height: 36px;
      transform: translate(-50%, -50%);
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
      z-index: 2;
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

      // iOS Safari向け最適化された設定（18.5対応）
      const options = isIosSafari ? {
        enableHighAccuracy: false, // iOS Safari 18.5では低精度の方が安定
        timeout: 10000, // タイムアウト短縮
        maximumAge: 300000 // キャッシュ時間延長
      } : {
        enableHighAccuracy: false, // 全体的に安定性重視
        timeout: 8000,
        maximumAge: 300000 // 5分間キャッシュ
      }
      
      console.log('📍 位置情報を取得試行...', options)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options)
      })

      const { latitude, longitude, accuracy } = position.coords
      console.log('✅ 位置情報取得成功:', { lat: latitude, lng: longitude, accuracy })
      setCurrentLocation([longitude, latitude])
      setLocationAccuracy(accuracy || 100)
      
      // 成功したら継続監視開始
      startLocationWatch()
      return true

    } catch (error: any) {
      console.error('❌ 位置情報取得失敗:', error.message)
      console.log('🔄 フォールバック位置を使用:', FALLBACK_LOCATION)
      setCurrentLocation(FALLBACK_LOCATION)
      setLocationAccuracy(50)
      return false
    } finally {
      locationRequestRef.current = false
      setLocationRequestInProgress(false)
    }
  }, [hasUserGesture, watchId, startLocationWatch])

  // 初期化時の位置情報取得（全ブラウザ統一）
  useEffect(() => {
    console.log('🌍 位置情報取得初期化')
    
    if (!navigator.geolocation) {
      console.log('⚠️ Geolocation未対応、フォールバック位置を使用')
      const FALLBACK_LOCATION: [number, number] = [139.5, 35.7]
      setCurrentLocation(FALLBACK_LOCATION)
      setLocationAccuracy(50)
      return
    }

    // 全ブラウザで統一的に位置情報取得を試行
    console.log('📍 全ブラウザ統一 - 位置情報取得開始')
    requestLocationPermission(true)

    return () => {
      if (watchId) {
        console.log('📍 位置情報監視停止')
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [requestLocationPermission])

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

  // ルートデータの初期化
  useEffect(() => {
    let mounted = true
    
    const fetchRoutes = async () => {
      try {
        console.log('📍 ルートデータ取得開始...')
        const fetchedRoutes = await mockFetchRoutes()
        
        if (mounted) {
          console.log('📍 ルートデータ取得完了:', fetchedRoutes.length, '件')
          setRoutes(fetchedRoutes)
          
          // ルートデータ取得後、地図が存在する場合はマーカー更新
          setTimeout(() => {
            if (map.current && !loading) {
              console.log('🔄 ルートデータ取得後のマーカー更新実行')
              updateVisiblePlanMarkers()
            }
          }, 100)
        }
      } catch (err) {
        if (mounted) {
          console.error('ルートデータ取得エラー:', err)
          setError(err instanceof Error ? err.message : 'ルートデータの取得に失敗しました')
        }
      }
    }

    fetchRoutes()
    
    return () => {
      mounted = false
    }
  }, [])

  // 位置情報取得後に地図初期化をトリガー（一度だけ）
  useEffect(() => {
    if (currentLocation && !shouldInitializeMap && !map.current) {
      console.log('🎯 位置情報取得完了、地図初期化をトリガー')
      setShouldInitializeMap(true)
    }
  }, [currentLocation, shouldInitializeMap])

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

        console.log('🗺️ 地図初期化開始...')
        
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
            center: currentLocation, // 実際の位置情報を使用
            zoom: 10
          })

          console.log('🗺️ MapLibre インスタンス作成完了')
          map.current = mapInstance

          // 地図ロード完了を待つ
          const handleLoad = () => {
            console.log('🗺️ 地図ロード完了')
            try {
              console.log('✅ 地図初期化完了')
              setLoading(false)
              
              // 地図初期化後にマーカー更新を実行
              setTimeout(() => {
                if (routes.length > 0 && map.current) {
                  console.log('🔄 地図初期化後のマーカー更新実行')
                  updateVisiblePlanMarkers()
                }
              }, 100)
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

          // 地図移動・ズーム時にマーカー更新（エラーハンドリング付き）
          const safeUpdateMarkers = () => {
            try {
              updateVisiblePlanMarkers()
            } catch (err) {
              console.error('マーカー更新エラー:', err)
            }
          }
          
          mapInstance.on('moveend', safeUpdateMarkers)
          mapInstance.on('zoomend', safeUpdateMarkers)

          console.log('🗺️ 地図初期化処理完了、ロードイベント待機中...')

          // クリーンアップ関数を設定
          cleanup = () => {
            try {
              if (mapInstance) {
                mapInstance.off('load', handleLoad)
                mapInstance.off('error', handleError)
                mapInstance.off('moveend', safeUpdateMarkers)
                mapInstance.off('zoomend', safeUpdateMarkers)
                
                // プランマーカーをクリーンアップ
                planMarkers.current.forEach(marker => marker.remove())
                planMarkers.current = []
                
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
    }
  }, [shouldInitializeMap])

  // 現在地マーカーの更新（位置と方位）
  useEffect(() => {
    if (currentLocation && map.current) {
      // マーカーがない場合のみ新規作成
      if (!currentLocationMarker.current) {
        console.log('📍 現在地マーカー新規作成:', currentLocation)
        const markerElement = createCurrentLocationMarker()
        currentLocationMarker.current = new maplibregl.Marker({ 
          element: markerElement,
          anchor: 'center'
        })
          .setLngLat(currentLocation)
          .addTo(map.current)
      } else {
        // 既存マーカーの位置のみ更新
        currentLocationMarker.current.setLngLat(currentLocation)
      }
      
      // マーカー要素を取得して方位を更新
      const markerElement = currentLocationMarker.current.getElement()
      if (markerElement) {
        const directionCone = markerElement.querySelector('#direction-cone') as HTMLElement
        if (directionCone) {
          // 方位に応じて扇形を回転（transform-originを正しく設定）
          directionCone.style.transform = `translateX(-50%) rotate(${deviceHeading}deg)`
          directionCone.style.transformOrigin = '50% 100%'
          console.log('🧭 マーカー方位更新:', deviceHeading.toFixed(1) + '°')
        }
        
        // 精度に応じて精度円のサイズを調整
        const accuracyCircle = markerElement.querySelector('#accuracy-circle') as HTMLElement
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

  // 地図とルートデータの両方が準備できたらマーカーを更新
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    
    const checkAndUpdateMarkers = () => {
      console.log('📍 ルートデータ & 地図状態チェック:', {
        routesLength: routes.length,
        hasMap: !!map.current,
        isStyleLoaded: map.current?.isStyleLoaded(),
        loading
      })

      if (routes.length > 0 && map.current && !loading) {
        // 地図が完全に読み込まれるまで待つ
        if (map.current.isStyleLoaded()) {
          console.log('✅ 条件クリア - マーカー更新開始')
          try {
            updateVisiblePlanMarkers()
          } catch (err) {
            console.error('マーカー更新エラー:', err)
          }
        } else {
          console.log('⏳ 地図読み込み待機中...')
          // タイムアウトで強制的にマーカー更新を試行
          timeoutId = setTimeout(() => {
            if (map.current) {
              console.log('⏰ タイムアウト - マーカー更新を強制実行')
              try {
                updateVisiblePlanMarkers()
              } catch (err) {
                console.error('強制マーカー更新エラー:', err)
              }
            }
          }, 2000)
          
          // 地図の読み込みが完了したら実行
          const handleStyleData = () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
            console.log('✅ 地図読み込み完了 - マーカー更新開始')
            try {
              updateVisiblePlanMarkers()
            } catch (err) {
              console.error('styledata マーカー更新エラー:', err)
            }
            map.current?.off('styledata', handleStyleData) // 一度だけ実行
          }
          map.current.on('styledata', handleStyleData)
        }
      }
    }
    
    checkAndUpdateMarkers()
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [routes, loading])

  // ルートグループが更新されたときにマーカーを再作成
  useEffect(() => {
    if (routeGroups.length > 0 && map.current && map.current.isStyleLoaded()) {
      // 既存のマーカーを削除
      planMarkers.current.forEach(marker => marker.remove())
      planMarkers.current = []
      
      // 新しいマーカーを追加
      routeGroups.forEach((group, index) => {
        const marker = createGroupMarker(group)
        if (marker) {
          marker.addTo(map.current!)
          planMarkers.current.push(marker)
        }
      })
    }
  }, [routeGroups])

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
  const getVisibleRoutes = (): HomeRoute[] => {
    if (!map.current) {
      console.log('getVisibleRoutes: no map')
      return routes.slice(0, 50) // 地図未初期化時は全ルートの最初の50件を返す
    }
    
    const bounds = map.current.getBounds()
    const zoom = map.current.getZoom()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    
    console.log('Map bounds:', { sw: [sw.lng, sw.lat], ne: [ne.lng, ne.lat], zoom })
    
    // ズームレベルに応じた初期フィルタリング数を決定
    const initialLimit = zoom < 10 ? 20 : zoom < 13 ? 30 : 40
    
    // 画面範囲内のルートを取得し、距離で優先度付け
    const center = map.current.getCenter()
    const centerCoord: [number, number] = [center.lng, center.lat]
    
    // 表示範囲内のプランをフィルタリング
    console.log('🗺️ 範囲フィルタリング実行中 - 全ルート数:', routes?.length || 0)
    
    // 最初の5件のルートの座標を詳細確認
    if (routes && routes.length > 0) {
      console.log('🔍 最初の5件のルート座標詳細:')
      routes.slice(0, 5).forEach((route, index) => {
        console.log(`  ${index + 1}. ${route.title}`)
        console.log(`     spotCount: ${route.spotCount}`)
        console.log(`     coordinates配列: ${route.coordinates ? '存在' : '無し'} (長さ: ${route.coordinates?.length || 0})`)
        if (route.coordinates && route.coordinates.length > 0) {
          console.log(`     最初のcoordinate: [${route.coordinates[0][0]}, ${route.coordinates[0][1]}]`)
        }
      })
    }
    
    // routesが存在しない場合は空配列を返す
    if (!routes || !Array.isArray(routes)) {
      console.log('⚠️ ルートデータが無効です')
      return []
    }
    
    const visibleRoutes = routes
      .filter(route => {
        // ルートまたは座標が存在しない場合は除外
        if (!route || !route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length === 0) {
          console.log(`❌ ルート "${route?.title || 'unknown'}" はスキップ - 座標データなし`)
          return false
        }
        
        // ルートの任意の座標が表示範囲内にあれば表示対象とする
        const hasCoordInBounds = route.coordinates.some(coord => {
          // 座標が無効な場合はスキップ
          if (!coord || !Array.isArray(coord) || coord.length < 2 || 
              typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
            return false
          }
          
          const lng = coord[0]  // coordinates[0] = longitude
          const lat = coord[1]  // coordinates[1] = latitude
          
          // 表示範囲内にあるかチェック
          const inBounds = lng >= sw.lng && lng <= ne.lng && 
                          lat >= sw.lat && lat <= ne.lat
          
          if (inBounds) {
            console.log(`✅ ルート "${route.title}" が範囲内: [${lng}, ${lat}]`)
          }
          
          return inBounds
        })
        
        return hasCoordInBounds
      })
      .sort((a, b) => {
        // 地図中心からの距離でソート（安全チェック付き）
        if (!a.coordinates?.[0] || !b.coordinates?.[0]) return 0
        
        const distA = calculateDistance(centerCoord, [a.coordinates[0][0], a.coordinates[0][1]])
        const distB = calculateDistance(centerCoord, [b.coordinates[0][0], b.coordinates[0][1]])
        return distA - distB
      })
      .slice(0, initialLimit) // ズームレベルに応じた件数制限
    
    console.log(`🎯 範囲フィルタリング結果: ${visibleRoutes.length}/${routes.length}件 (zoom: ${zoom.toFixed(1)})`)
    console.log(`📍 表示範囲: SW[${sw.lng.toFixed(4)}, ${sw.lat.toFixed(4)}] - NE[${ne.lng.toFixed(4)}, ${ne.lat.toFixed(4)}]`)
    
    return visibleRoutes
  }

  // 2点間の距離を計算（メートル）
  const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
    const [lng1, lat1] = coord1
    const [lng2, lat2] = coord2
    const R = 6371000 // 地球の半径（メートル）
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lng2 - lng1) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  // ズームレベルに応じたクラスタリング距離を計算
  const getClusteringDistance = (): number => {
    if (!map.current) return 100

    const zoom = map.current.getZoom()
    
    // クラスタリング距離を大幅縮小してより多くのマーカーを表示
    console.log(`🎯 クラスタリング距離計算: zoom=${zoom.toFixed(1)}`)
    
    if (zoom < 8) return 800    // 極端なズームアウト時は800m
    if (zoom < 10) return 400   // 大きくズームアウト時は400m (2000m→400m)
    if (zoom < 12) return 200   // 中程度のズームアウト時は200m (800m→200m)  
    if (zoom < 14) return 100   // 中ズーム時は100m (300m→100m)
    return 50                   // ズームイン時は50m (100m→50m)
  }

  // マーカー表示数の上限を計算
  const getMaxMarkerCount = (): number => {
    if (!map.current) return 8

    const zoom = map.current.getZoom()
    
    // ズームレベルに応じて表示数を制限
    if (zoom < 10) return 5     // 大きくズームアウト時は最大5個
    if (zoom < 13) return 8     // 中程度のズームアウト時は最大8個
    if (zoom < 15) return 12    // 中ズーム時は最大12個
    return 15                   // ズームイン時は最大15個
  }

  // ピクセル距離での重複チェック
  const isOverlappingInPixels = (coord1: [number, number], coord2: [number, number]): boolean => {
    if (!map.current) return false

    const point1 = map.current.project(coord1)
    const point2 = map.current.project(coord2)
    
    const pixelDistance = Math.sqrt(
      Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
    )
    
    // マーカーの幅が約220pxなので、150px以内は重複とみなす
    return pixelDistance < 150
  }

  // プランをグループ化（ズームレベル対応）
  const groupRoutes = (visibleRoutes: HomeRoute[]): RouteGroup[] => {
    const clusterDistance = getClusteringDistance()
    const maxMarkers = getMaxMarkerCount()
    
    console.log(`🔗 グループ化開始: ${visibleRoutes.length}件のルート, クラスター距離: ${clusterDistance}m, 最大マーカー: ${maxMarkers}`)
    
    const groups: RouteGroup[] = []
    const processed = new Set<string>()

    // 優先度付けのためにルートをソート（スポット数が多い順）
    const sortedRoutes = [...visibleRoutes].sort((a, b) => b.spotCount - a.spotCount)

    sortedRoutes.forEach((route, routeIndex) => {
      if (processed.has(route.id)) return

      const [lng, lat] = route.coordinates[0]
      const groupRoutes = [route]
      processed.add(route.id)
      
      console.log(`📍 新しいグループ作成: "${route.title}" [${lng}, ${lat}]`)

      let addedToGroup = 0
      // 同じ場所の近くにある他のルートを探す
      sortedRoutes.forEach(otherRoute => {
        if (processed.has(otherRoute.id) || route.id === otherRoute.id) return

        const [otherLng, otherLat] = otherRoute.coordinates[0]
        const distance = calculateDistance([lng, lat], [otherLng, otherLat])

        if (distance <= clusterDistance) {
          groupRoutes.push(otherRoute)
          processed.add(otherRoute.id)
          addedToGroup++
          console.log(`  ➕ グループに追加: "${otherRoute.title}" (距離: ${distance.toFixed(0)}m)`)
        }
      })
      
      console.log(`✅ グループ完成: ${groupRoutes.length}件のルート (メイン: ${route.title})`)

      groups.push({
        id: `group-${route.id}`,
        routes: groupRoutes,
        centerCoordinate: [lng, lat],
        currentIndex: 0
      })
    })

    console.log(`📊 地理的グループ化完了: ${groups.length}個のグループ`)

    // ピクセル距離での重複チェックと除去
    const filteredGroups = groups.filter((group, index) => {
      // 既に追加されたグループとピクセル距離をチェック
      for (let i = 0; i < index; i++) {
        if (isOverlappingInPixels(group.centerCoordinate, groups[i].centerCoordinate)) {
          console.log(`🚫 ピクセル重複により除外: "${group.routes[0]?.title}"`)
          return false // 重複している場合は除外
        }
      }
      return true
    })

    console.log(`🔍 ピクセル重複除去後: ${filteredGroups.length}個のグループ`)

    // 最大表示数に制限
    const finalGroups = filteredGroups.slice(0, maxMarkers)
    console.log(`🎯 最終結果: ${finalGroups.length}個のマーカーを表示 (上限: ${maxMarkers})`)
    
    return finalGroups
  }

  // グループ内のコース切り替え
  const handleGroupNavigation = (groupId: string, direction: 'prev' | 'next') => {
    setRouteGroups(prevGroups => {
      return prevGroups.map(g => {
        if (g.id === groupId) {
          const newIndex = direction === 'prev' 
            ? Math.max(0, g.currentIndex - 1)
            : Math.min(g.routes.length - 1, g.currentIndex + 1)
          return { ...g, currentIndex: newIndex }
        }
        return g
      })
    })
  }

  // グループ用プランマーカーの作成
  const createGroupMarker = (group: RouteGroup) => {
    console.log('Creating marker for group:', group.id, 'at', group.centerCoordinate)
    const [lng, lat] = group.centerCoordinate
    
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      console.warn('Invalid coordinates for group:', group)
      return null
    }

    const currentRoute = group.routes[group.currentIndex]
    const isMultiple = group.routes.length > 1
    
    console.log('Current route in group:', currentRoute.title, 'isMultiple:', isMultiple)

    // 看板のHTML要素を作成
    const el = document.createElement('div')
    el.className = 'plan-group-marker'
    el.style.cssText = `
      position: relative;
      width: 220px;
      cursor: pointer;
      transform: translateX(-50%) translateY(-100%);
      filter: drop-shadow(0 6px 12px rgba(0,0,0,0.12));
      transition: all 0.2s ease-out;
      z-index: 1;
      pointer-events: auto;
    `
    
    el.innerHTML = `
      <div style="position: relative;">
        ${isMultiple ? `
          <!-- 重なり表現用の背景カード（より視認性の高いデザイン） -->
          <div style="
            position: absolute;
            top: 8px;
            left: 8px;
            right: -8px;
            bottom: -8px;
            background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
            border-radius: 14px;
            border: 1px solid rgba(0,0,0,0.1);
            z-index: -2;
            transform: rotate(3deg);
          "></div>
          <div style="
            position: absolute;
            top: 4px;
            left: 4px;
            right: -4px;
            bottom: -4px;
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            border-radius: 13px;
            border: 1px solid rgba(0,0,0,0.08);
            z-index: -1;
            transform: rotate(1.5deg);
          "></div>
        ` : ''}
        
        <!-- メインカード -->
        <div id="card-${group.id}" style="
          background: white;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.08);
          transform-origin: center center;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        ">
          <!-- ヘッダー（画像エリア） -->
          <div style="
            width: 100%;
            height: 80px;
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            position: relative;
            overflow: hidden;
          ">
            ${currentRoute.cover ? `
              <img src="${currentRoute.cover}" style="
                width: 100%;
                height: 100%;
                object-fit: cover;
              " onload="this.style.opacity=1" onerror="this.style.display='none'" />
            ` : ''}
            
            <!-- 時間バッジ -->
            <div style="
              position: absolute;
              top: 6px;
              right: 6px;
              background: rgba(255,255,255,0.9);
              backdrop-filter: blur(8px);
              border-radius: 4px;
              padding: 2px 6px;
              font-size: 10px;
              font-weight: 500;
              color: #374151;
            ">
              ${formatDuration(currentRoute.duration)}
            </div>
            
            ${isMultiple ? `
              <!-- グループ数バッジ（より目立つデザイン） -->
              <div style="
                position: absolute;
                top: 6px;
                left: 6px;
                background: linear-gradient(135deg, #2db5a5 0%, #239b8f 100%);
                color: white;
                border-radius: 16px;
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 700;
                box-shadow: 0 2px 8px rgba(45, 181, 165, 0.3);
                display: flex;
                align-items: center;
                gap: 4px;
                z-index: 10;
              ">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="0" y="0" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
                  <rect x="3" y="3" width="5" height="5" rx="1" fill="white" opacity="0.7"/>
                  <rect x="4" y="4" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
                </svg>
                ${group.routes.length}プラン
              </div>
              
              <!-- ナビゲーション矢印（改善されたデザイン） -->
              <button id="prev-${group.id}" style="
                position: absolute;
                bottom: 8px;
                left: 8px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: ${group.currentIndex === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)'};
                backdrop-filter: blur(8px);
                border: 2px solid rgba(255,255,255,0.3);
                color: white;
                font-size: 14px;
                font-weight: bold;
                cursor: ${group.currentIndex === 0 ? 'not-allowed' : 'pointer'};
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                transform: scale(1);
              " title="前のプラン" ${group.currentIndex === 0 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8L10 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button id="next-${group.id}" style="
                position: absolute;
                bottom: 8px;
                right: 8px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: ${group.currentIndex === group.routes.length - 1 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)'};
                backdrop-filter: blur(8px);
                border: 2px solid rgba(255,255,255,0.3);
                color: white;
                font-size: 14px;
                font-weight: bold;
                cursor: ${group.currentIndex === group.routes.length - 1 ? 'not-allowed' : 'pointer'};
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                transform: scale(1);
              " title="次のプラン" ${group.currentIndex === group.routes.length - 1 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 12L10 8L6 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            ` : ''}
          </div>
          
          <!-- コンテンツエリア -->
          <div style="padding: 8px;">
            <h3 style="
              font-size: 12px;
              font-weight: 600;
              color: #111827;
              margin: 0 0 6px 0;
              line-height: 1.3;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            ">${currentRoute.title}</h3>
            
            <div style="
              display: flex;
              flex-wrap: wrap;
              gap: 3px;
              margin-bottom: 6px;
            ">
              ${currentRoute.tags.slice(0, 2).map(tag => `
                <span style="
                  background: #f3f4f6;
                  color: #6b7280;
                  font-size: 9px;
                  padding: 1px 4px;
                  border-radius: 3px;
                  white-space: nowrap;
                ">${tag}</span>
              `).join('')}
            </div>
            
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <span style="
                color: #9ca3af;
                font-size: 10px;
              ">${currentRoute.author}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="
                  color: #9ca3af;
                  font-size: 10px;
                ">${currentRoute.spotCount}スポット</span>
                ${isMultiple ? `
                  <div style="
                    display: flex;
                    gap: 2px;
                    align-items: center;
                  ">
                    ${group.routes.map((_, index) => `
                      <div style="
                        width: ${index === group.currentIndex ? '16px' : '6px'};
                        height: 6px;
                        border-radius: 3px;
                        background: ${index === group.currentIndex ? '#2db5a5' : '#d1d5db'};
                        transition: all 0.3s ease;
                      "></div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 下部の矢印 -->
      <div style="
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid white;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      "></div>
    `
    
    // ホバー効果（位置を維持したまま拡大）
    el.addEventListener('mouseenter', () => {
      const innerCard = el.querySelector('div > div') as HTMLElement
      if (innerCard) {
        innerCard.style.transform = 'scale(1.05)'
        innerCard.style.zIndex = '10'
      }
    })
    
    el.addEventListener('mouseleave', () => {
      const innerCard = el.querySelector('div > div') as HTMLElement
      if (innerCard) {
        innerCard.style.transform = 'scale(1)'
        innerCard.style.zIndex = '1'
      }
    })

    // ナビゲーションボタンのイベントリスナー
    if (isMultiple) {
      const prevBtn = el.querySelector(`#prev-${group.id}`)
      const nextBtn = el.querySelector(`#next-${group.id}`)
      
      prevBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        if (group.currentIndex > 0) {
          // カードのフェードアニメーション
          const card = el.querySelector(`#card-${group.id}`) as HTMLElement
          if (card) {
            card.style.opacity = '0'
            card.style.transform = 'scale(0.95)'
            setTimeout(() => {
              handleGroupNavigation(group.id, 'prev')
              setTimeout(() => {
                const newCard = el.querySelector(`#card-${group.id}`) as HTMLElement
                if (newCard) {
                  newCard.style.opacity = '1'
                  newCard.style.transform = 'scale(1)'
                }
              }, 50)
            }, 150)
          } else {
            handleGroupNavigation(group.id, 'prev')
          }
        }
      })
      
      nextBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        if (group.currentIndex < group.routes.length - 1) {
          // カードのフェードアニメーション
          const card = el.querySelector(`#card-${group.id}`) as HTMLElement
          if (card) {
            card.style.opacity = '0'
            card.style.transform = 'scale(0.95)'
            setTimeout(() => {
              handleGroupNavigation(group.id, 'next')
              setTimeout(() => {
                const newCard = el.querySelector(`#card-${group.id}`) as HTMLElement
                if (newCard) {
                  newCard.style.opacity = '1'
                  newCard.style.transform = 'scale(1)'
                }
              }, 50)
            }, 150)
          } else {
            handleGroupNavigation(group.id, 'next')
          }
        }
      })
      
      // ホバー効果をボタンに追加
      prevBtn?.addEventListener('mouseenter', () => {
        if (group.currentIndex > 0) {
          (prevBtn as HTMLElement).style.transform = 'scale(1.1)'
          ;(prevBtn as HTMLElement).style.background = 'rgba(0,0,0,0.9)'
        }
      })
      
      prevBtn?.addEventListener('mouseleave', () => {
        (prevBtn as HTMLElement).style.transform = 'scale(1)'
        ;(prevBtn as HTMLElement).style.background = group.currentIndex === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)'
      })
      
      nextBtn?.addEventListener('mouseenter', () => {
        if (group.currentIndex < group.routes.length - 1) {
          (nextBtn as HTMLElement).style.transform = 'scale(1.1)'
          ;(nextBtn as HTMLElement).style.background = 'rgba(0,0,0,0.9)'
        }
      })
      
      nextBtn?.addEventListener('mouseleave', () => {
        (nextBtn as HTMLElement).style.transform = 'scale(1)'
        ;(nextBtn as HTMLElement).style.background = group.currentIndex === group.routes.length - 1 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)'
      })
    }
    
    // クリックでプラン詳細へ
    el.addEventListener('click', () => {
      onSelectRoute(currentRoute.id)
    })
    
    return new maplibregl.Marker({
      element: el,
      anchor: 'bottom'
    }).setLngLat([lng, lat])
  }

  // 単体ルート用マーカー作成（フォールバック）
  const createSingleRouteMarker = (route: HomeRoute) => {
    console.log('Creating single marker for route:', route.title)
    
    if (!route.coordinates || route.coordinates.length === 0) {
      console.warn('Route has no coordinates:', route)
      return null
    }
    
    const [lng, lat] = route.coordinates[0]
    
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      console.warn('Invalid coordinates for route:', route)
      return null
    }
    
    const el = document.createElement('div')
    el.className = 'plan-single-marker'
    el.style.cssText = `
      position: relative;
      width: 200px;
      cursor: pointer;
      transform: translateX(-50%) translateY(-100%);
      filter: drop-shadow(0 6px 12px rgba(0,0,0,0.12));
      transition: all 0.2s ease-out;
      z-index: 1;
    `
    
    el.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,0.08);
        transform-origin: center center;
        transition: all 0.2s ease-out;
      ">
        <div style="
          width: 100%;
          height: 80px;
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          position: relative;
          overflow: hidden;
        ">
          ${route.cover ? `
            <img src="${route.cover}" style="
              width: 100%;
              height: 100%;
              object-fit: cover;
            " />
          ` : ''}
          <div style="
            position: absolute;
            top: 6px;
            right: 6px;
            background: rgba(255,255,255,0.9);
            backdrop-filter: blur(8px);
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: 500;
            color: #374151;
          ">
            ${formatDuration(route.duration)}
          </div>
        </div>
        <div style="padding: 8px;">
          <h3 style="
            font-size: 12px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 6px 0;
            line-height: 1.3;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          ">${route.title}</h3>
          <div style="
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            margin-bottom: 6px;
          ">
            ${route.tags.slice(0, 2).map(tag => `
              <span style="
                background: #f3f4f6;
                color: #6b7280;
                font-size: 9px;
                padding: 1px 4px;
                border-radius: 3px;
                white-space: nowrap;
              ">${tag}</span>
            `).join('')}
          </div>
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <span style="
              color: #9ca3af;
              font-size: 10px;
            ">${route.author}</span>
            <span style="
              color: #9ca3af;
              font-size: 10px;
            ">${route.spotCount}スポット</span>
          </div>
        </div>
      </div>
      <div style="
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid white;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      "></div>
    `
    
    // ホバー効果（位置を維持したまま拡大）
    el.addEventListener('mouseenter', () => {
      const innerCard = el.querySelector('div') as HTMLElement
      if (innerCard) {
        innerCard.style.transform = 'scale(1.05)'
        innerCard.style.zIndex = '10'
      }
    })
    
    el.addEventListener('mouseleave', () => {
      const innerCard = el.querySelector('div') as HTMLElement
      if (innerCard) {
        innerCard.style.transform = 'scale(1)'
        innerCard.style.zIndex = '1'
      }
    })
    
    // クリックでプラン詳細へ
    el.addEventListener('click', () => {
      onSelectRoute(route.id)
    })
    
    return new maplibregl.Marker({
      element: el,
      anchor: 'bottom'
    }).setLngLat([lng, lat])
  }

  // プランマーカーの更新（改善版）
  const updateVisiblePlanMarkers = () => {
    try {
      const zoom = map.current?.getZoom()
      console.log('🔄 マーカー更新開始', { 
        zoom: zoom?.toFixed(1), 
        routes: routes.length,
        hasMap: !!map.current,
        isStyleLoaded: map.current?.isStyleLoaded(),
        loading
      })
      
      if (!map.current || routes.length === 0) {
        console.log('⚠️ 早期リターン - 条件未達成', { 
          hasMap: !!map.current, 
          routesCount: routes.length 
        })
        return
      }

      // スタイル読み込みチェックを緩和（読み込み済みでなくても進める）
      if (!map.current.isStyleLoaded()) {
        console.log('⚠️ スタイル未読み込みだが処理続行')
      }
    
    // 既存のマーカーを削除
    planMarkers.current.forEach(marker => marker.remove())
    planMarkers.current = []
    
    // 表示範囲内のプランを取得
    const visibleRoutes = getVisibleRoutes()
    console.log('📍 表示候補ルート:', visibleRoutes.length)
    setVisibleRoutes(visibleRoutes)
    
    // プランをグループ化
    const groups = groupRoutes(visibleRoutes)
    const clusterDistance = getClusteringDistance()
    const maxMarkers = getMaxMarkerCount()
    console.log('🔗 グループ化完了:', {
      groups: groups.length,
      clusterDistance: `${clusterDistance}m`,
      maxMarkers,
      zoom: zoom?.toFixed(1)
    })
    
    // 既存のグループ状態を保持してマージ
    const updatedGroups = groups.map(newGroup => {
      const existingGroup = routeGroups.find(g => g.id === newGroup.id)
      return existingGroup ? { ...newGroup, currentIndex: existingGroup.currentIndex } : newGroup
    })
    setRouteGroups(updatedGroups)
    
    // 新しいマーカーを追加
    let successfulMarkers = 0
    updatedGroups.forEach((group, index) => {
      const marker = createGroupMarker(group)
      if (marker) {
        marker.addTo(map.current!)
        planMarkers.current.push(marker)
        successfulMarkers++
      }
    })
    
    // フォールバック：グループ化に失敗した場合は個別マーカーを表示
    if (updatedGroups.length === 0 && visibleRoutes.length > 0) {
      console.log('🔄 フォールバック: 個別マーカー作成')
      visibleRoutes.slice(0, maxMarkers).forEach((route) => {
        const marker = createSingleRouteMarker(route)
        if (marker) {
          marker.addTo(map.current!)
          planMarkers.current.push(marker)
          successfulMarkers++
        }
      })
    }
    
      console.log('✅ マーカー更新完了:', {
        visibleRoutes: visibleRoutes.length,
        groups: updatedGroups.length,
        markers: successfulMarkers,
        zoom: zoom?.toFixed(1)
      })
    } catch (err) {
      console.error('❌ マーカー更新中にエラー:', err)
      // エラーが発生してもローディングは解除
      if (loading) {
        setLoading(false)
      }
    }
  }


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
      // フォールバック位置（スカイツリー）が設定されている場合は実際の位置情報取得を試行
      const [lng, lat] = currentLocation
      const isUsingFallback = Math.abs(lng - 139.8107) < 0.001 && Math.abs(lat - 35.7101) < 0.001
      
      if (isUsingFallback) {
        console.log('📍 フォールバック位置 - 実際の位置情報取得を試行')
        await requestLocationPermission(true)
      } else {
        map.current.flyTo({
          center: currentLocation,
          zoom: 12,
          bearing: 0 // 北向きに設定
        })
      }
    } else if (!currentLocation) {
      // 位置情報がない場合は取得を試行
      console.log('📍 位置情報がないため取得を試行')
      await requestLocationPermission(true)
    }
  }

  // スワイプパネルの高さ計算
  const panelHeight = swipeState === 'closed' ? '180px' : '65%'

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
          <button
            onClick={toggleFilterMode}
            className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="絞り込み"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
        
        {/* 選択済みチップ表示（コンパクト版） */}
      </div>

      {/* 中段：コンパクト即効チップ */}
      <div 
        className="fixed left-0 right-0 z-30 bg-white shadow-sm border-b border-gray-100" 
        style={{ 
          top: '115px' // 検索バー(96) + 安全間隔(19)
        }}
      >
        {/* デスクトップ用：コンパクトグリッド */}
        <div className="hidden lg:block px-2 py-1.5">
          <div className="grid grid-cols-10 xl:grid-cols-12 gap-1 max-w-6xl mx-auto">
            {POPULAR_TAGS.slice(0, visibleTagCount).map(tag => {
              const isActive = searchChips.some(chip => chip.type === 'tag' && chip.value === tag)
              const tagChips = searchChips.filter(chip => chip.type === 'tag')
              const canSelect = !isActive && tagChips.length < 3
              
              return (
                <button
                  key={tag}
                  onClick={() => {
                    if (canSelect) {
                      addSearchChip({
                        id: `tag-${tag}`,
                        type: 'tag',
                        label: tag,
                        value: tag
                      })
                    }
                  }}
                  disabled={!canSelect && !isActive}
                  className={`px-2 py-1 rounded-full text-xs font-medium border transition-all duration-150 hover:scale-[1.02] ${
                    isActive
                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                      : canSelect
                      ? 'bg-white text-gray-700 border-gray-300 hover:border-teal-400 hover:text-teal-600'
                      : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                  style={isActive ? { backgroundColor: '#2db5a5', borderColor: '#2db5a5' } : {}}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* タブレット用：コンパクト2行 */}
        <div className="hidden md:block lg:hidden px-2 py-1.5">
          <div className="grid grid-cols-7 gap-1">
            {POPULAR_TAGS.slice(0, visibleTagCount).map(tag => {
              const isActive = searchChips.some(chip => chip.type === 'tag' && chip.value === tag)
              const tagChips = searchChips.filter(chip => chip.type === 'tag')
              const canSelect = !isActive && tagChips.length < 3
              
              return (
                <button
                  key={tag}
                  onClick={() => {
                    if (canSelect) {
                      addSearchChip({
                        id: `tag-${tag}`,
                        type: 'tag',
                        label: tag,
                        value: tag
                      })
                    }
                  }}
                  disabled={!canSelect && !isActive}
                  className={`px-2 py-1 rounded-full text-xs border transition-all duration-150 hover:scale-[1.01] ${
                    isActive
                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                      : canSelect
                      ? 'bg-white text-gray-700 border-gray-300 hover:border-teal-400 hover:text-teal-600'
                      : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                  style={isActive ? { backgroundColor: '#2db5a5', borderColor: '#2db5a5' } : {}}
                >
                  {tag}
                </button>
              )
            })}
            <button
              onClick={() => {
                setBottomSheetMode('filter')
                setSwipeState('open')
              }}
              className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 hover:bg-yellow-200 transition-all duration-150"
              style={{ backgroundColor: '#fef3c7', borderColor: '#f2b938' }}
            >
              ＋他
            </button>
          </div>
        </div>

        {/* モバイル用：コンパクト横スクロール */}
        <div className="block md:hidden relative px-2 py-1.5">
          {/* スクロール左ボタン */}
          {canScrollLeft && (
            <button
              onClick={() => scrollTags('left')}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 w-6 h-6 bg-white/90 border border-gray-300 rounded-full shadow-sm flex items-center justify-center backdrop-blur-sm hover:bg-white transition-all duration-150"
              aria-label="左にスクロール"
            >
              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
          
          {/* スクロール右ボタン */}
          {canScrollRight && (
            <button
              onClick={() => scrollTags('right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 w-6 h-6 bg-white/90 border border-gray-300 rounded-full shadow-sm flex items-center justify-center backdrop-blur-sm hover:bg-white transition-all duration-150"
              aria-label="右にスクロール"
            >
              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          )}

          {/* コンパクトタグスクロールコンテナ */}
          <div 
            ref={tagScrollRef}
            className="flex items-center space-x-2 overflow-x-auto scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* 左端のスペーサー */}
            <div className="flex-shrink-0 w-1"></div>
            
            {POPULAR_TAGS.slice(0, visibleTagCount).map(tag => {
              const isActive = searchChips.some(chip => chip.type === 'tag' && chip.value === tag)
              const tagChips = searchChips.filter(chip => chip.type === 'tag')
              const canSelect = !isActive && tagChips.length < 3
              
              return (
                <button
                  key={tag}
                  onClick={() => {
                    if (canSelect) {
                      addSearchChip({
                        id: `tag-${tag}`,
                        type: 'tag',
                        label: tag,
                        value: tag
                      })
                    }
                  }}
                  disabled={!canSelect && !isActive}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 active:scale-95 ${
                    isActive
                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                      : canSelect
                      ? 'bg-white text-gray-700 border-gray-300 shadow-sm'
                      : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                  style={isActive ? { backgroundColor: '#2db5a5', borderColor: '#2db5a5' } : {}}
                >
                  {tag}
                </button>
              )
            })}
            
            {/* コンパクト「すべて」ボタン */}
            <button
              onClick={() => {
                setBottomSheetMode('filter')
                setSwipeState('open')
              }}
              className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300 shadow-sm transition-all duration-150 active:scale-95"
              style={{ backgroundColor: '#fef3c7', borderColor: '#f2b938' }}
            >
              ＋他
            </button>

            {/* 右端のスペーサー */}
            <div className="flex-shrink-0 w-1"></div>
          </div>
        </div>

        {/* カスタムスクロールバースタイル */}
        <style jsx>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
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
        
        {/* ローディングオーバーレイ */}
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


      {/* プラン作成ボタン */}
      <button
        onClick={onCreateRoute}
        className={`absolute left-4 right-4 text-white rounded-xl py-3 px-6 shadow-xl z-40 flex items-center justify-center font-bold text-lg transition-all transform hover:scale-[1.02] hover:shadow-2xl ${
          swipeState === 'open' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ 
          bottom: swipeState === 'closed' ? '190px' : '280px', // ボトムシートと被らないよう動的調整
          background: 'linear-gradient(135deg, #EF4444 0%, #F59E0B 50%, #f2b938 100%)',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)'
        }}
        aria-label="1分でお出かけプランを作成"
      >
        <svg 
          className="w-7 h-7 mr-3" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
        1分でお出かけプランを作成
      </button>

      {/* スワイプパネル */}
      <div
        className="absolute left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 z-30 flex flex-col"
        style={{ 
          bottom: '0px', // iPhone14のChromeでタイトルまで見えるように0px上に配置
          height: panelHeight,
          pointerEvents: 'none'
        }}
      >
        {/* スワイプハンドル */}
        <button
          onClick={() => {
            if (bottomSheetMode === 'filter') {
              // フィルターモードの場合：closeBottomSheet関数を使用
              closeBottomSheet()
            } else {
              // ルートモードの場合：通常のトグル動作
              setSwipeState(prev => prev === 'closed' ? 'open' : 'closed')
            }
          }}
          className="w-full py-3 flex justify-center flex-shrink-0"
          style={{ pointerEvents: 'auto' }}
          aria-label={
            bottomSheetMode === 'filter' 
              ? 'ボトムシートを閉じる'
              : swipeState === 'closed' ? 'パネルを開く' : 'パネルを閉じる'
          }
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </button>

        {/* コンテンツ：モードに応じて切り替え */}
        <div 
          className="flex-1 flex flex-col px-4 pb-4 min-h-0"
          style={{ pointerEvents: swipeState === 'open' ? 'auto' : 'none' }}
        >
          {bottomSheetMode === 'routes' ? (
            // ルートリストモード
            <>
              <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <h2 className="text-lg font-semibold">
                  おすすめルート ({visibleRoutes.length}件)
                </h2>
                {searchChips.length > 0 && (
                  <button
                    onClick={clearAllChips}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    クリア
                  </button>
                )}
              </div>
              
              <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain">
                {visibleRoutes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => onSelectRoute(route.id)}
                    className="w-full bg-gray-50 rounded-lg p-4 text-left hover:bg-gray-100 transition-colors flex-shrink-0"
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
            </>
          ) : (
            // フィルターモード
            <>
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold">条件をえらぶ</h2>
                <button
                  onClick={closeBottomSheet}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex-1 space-y-6 overflow-y-auto">
                {/* 予算設定 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">予算（1人あたり）</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {BUDGET_OPTIONS.map(option => (
                      <button
                        key={option.label}
                        onClick={() => {
                          setFilterState(prev => ({ ...prev, budget: option.value }))
                          if (option.value && option.value !== 'custom') {
                            const chip: SearchChip = {
                              id: `budget-${option.value}`,
                              type: 'budget',
                              label: option.label,
                              value: option.value
                            }
                            addSearchChip(chip)
                          }
                        }}
                        className={`p-3 text-sm rounded-lg border transition-colors ${
                          filterState.budget === option.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* エリア設定 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">エリア（現在地から）</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {AREA_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterState(prev => ({ 
                            ...prev, 
                            area: { type: option.type, value: option.value }
                          }))
                          const chip: SearchChip = {
                            id: `area-${option.value}`,
                            type: 'area',
                            label: option.label,
                            value: option.value
                          }
                          addSearchChip(chip)
                        }}
                        className={`p-3 text-sm rounded-lg border transition-colors ${
                          filterState.area.value === option.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* タグ設定 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    タグ（3つまで選べます）
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {POPULAR_TAGS.map(tag => {
                      const isSelected = searchChips.some(chip => chip.type === 'tag' && chip.value === tag)
                      const tagCount = searchChips.filter(chip => chip.type === 'tag').length
                      const canSelect = !isSelected && tagCount < 3
                      
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            if (isSelected) {
                              removeSearchChip(`tag-${tag}`)
                            } else if (canSelect) {
                              addSearchChip({
                                id: `tag-${tag}`,
                                type: 'tag',
                                label: tag,
                                value: tag
                              })
                            }
                          }}
                          disabled={!canSelect && !isSelected}
                          className={`p-3 text-sm rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : canSelect
                              ? 'border-gray-300 hover:border-gray-400'
                              : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              {/* フッターCTA */}
              <div className="flex-shrink-0 pt-4 border-t border-gray-200">
                <div className="flex space-x-3">
                  <button
                    onClick={clearAllChips}
                    className="flex-1 p-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    すべて解除
                  </button>
                  <button
                    onClick={closeFilterAndShowRoutes}
                    className="flex-1 p-3 text-white rounded-lg transition-colors"
                    style={{ backgroundColor: '#2db5a5' }}
                  >
                    {visibleRoutes.length}件を表示
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* パネル外をタップした時の背景 */}
      {swipeState === 'open' && (
        <div
          className="absolute inset-0 bg-black bg-opacity-20 z-20"
          onClick={() => {
            if (bottomSheetMode === 'filter') {
              closeBottomSheet()
            } else {
              setSwipeState('closed')
            }
          }}
          aria-label="パネルを閉じる"
        />
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
    </div>
  )
}