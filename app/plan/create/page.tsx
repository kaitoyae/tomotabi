'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// 型定義
type Spot = {
  id: string
  name: string
  lat: number
  lng: number
  photo?: string
  comment?: string
  stayTime: number // 滞在時間（分）
  isLodging?: boolean // 宿泊フラグ
}

type FormData = {
  title: string
  spots: Spot[]
  memo: string
  scheduledDate?: string // 日付部分（YYYY-MM-DD形式）
  scheduledHour?: string // 時間部分（0-23）
  scheduledMinute?: string // 分部分（00または30のみ）
  budget?: number // 予算（円）
  dayBreaks: number[] // 日付区切りの位置（スポットインデックス）
}

type BottomSheetState = 'closed' | 'half' | 'full'

// SpotSearchMini用の型
type SearchSpot = {
  id: string
  name: string
  lat: number
  lng: number
  source: 'nominatim' | 'overpass'
  tags?: Record<string, string>
}


// Haversine距離計算関数
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3 // 地球の半径（メートル）
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // メートル単位
}

// 総所要時間を計算
const calculateTotalDuration = (spots: Spot[]): number => {
  if (spots.length === 0) return 0
  
  let totalMinutes = 0
  
  // 滞在時間の合計
  spots.forEach(spot => {
    totalMinutes += spot.stayTime
  })
  
  // 移動時間の計算（徒歩4.5km/h = 75m/分）
  for (let i = 0; i < spots.length - 1; i++) {
    const distance = haversineDistance(
      spots[i].lat,
      spots[i].lng,
      spots[i + 1].lat,
      spots[i + 1].lng
    )
    const walkingTime = Math.ceil(distance / 75) // 分単位
    totalMinutes += walkingTime
  }
  
  return totalMinutes
}

// 宿泊アイコンのSVGコンポーネント
const AccommodationIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

// 日別にスポットを分割する関数
const getDaysSpotsBreakdown = (spots: Spot[], dayBreaks: number[]): Spot[][] => {
  const sortedBreaks = [...dayBreaks].sort((a, b) => a - b)
  const days: Spot[][] = []
  let currentStart = 0
  
  for (const breakIndex of sortedBreaks) {
    if (breakIndex > currentStart) {
      days.push(spots.slice(currentStart, breakIndex))
    }
    currentStart = breakIndex
  }
  
  // 最後の日
  if (currentStart < spots.length) {
    days.push(spots.slice(currentStart))
  }
  
  return days
}

// 総日数を取得
const getTotalDays = (dayBreaks: number[], spotsLength: number): number => {
  if (spotsLength === 0) return 0
  return Math.max(1, dayBreaks.length + 1)
}

// 人気タグ定数
const POPULAR_TAGS = [
  'グルメ', 'カフェ', '観光', '散歩', 'デート', 'ショッピング', 
  'アート', '歴史', '自然', '夜景', '写真', 'ファミリー',
  '桜', '紅葉', '温泉', '海', '山', '神社', '寺', '美術館'
]

// Dayタブコンポーネント  
const DayTabs = ({ 
  totalDays, 
  currentDay, 
  onDaySelect, 
  onAddDay 
}: {
  totalDays: number
  currentDay: number
  onDaySelect: (day: number) => void
  onAddDay: () => void
}) => (
  <div className="fixed top-16 left-0 right-0 bg-white border-b border-gray-200 z-40 px-4 py-2">
    <div className="flex items-center overflow-x-auto">
      {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
        <button
          key={day}
          onClick={() => onDaySelect(day)}
          className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap mr-2 ${
            currentDay === day
              ? 'text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          style={currentDay === day ? { backgroundColor: '#2db5a5' } : {}}
        >
          {day}日目{day === 1 && totalDays === 1 ? '(日帰り)' : ''}
        </button>
      ))}
      {totalDays < 7 && (
        <button
          onClick={onAddDay}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
        >
          ＋
        </button>
      )}
    </div>
  </div>
)

export default function CreatePlanPage() {
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null)
  const currentLocationMarker = useRef<maplibregl.Marker | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    spots: [],
    memo: '',
    scheduledDate: '',
    scheduledHour: '',
    scheduledMinute: '',
    budget: undefined,
    dayBreaks: []
  })
  
  const [bottomSheetState, setBottomSheetState] = useState<BottomSheetState>('half')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [hourDropdownOpen, setHourDropdownOpen] = useState(false)
  const [minuteDropdownOpen, setMinuteDropdownOpen] = useState(false)
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false)
  const tagScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  
  // プルダウンを閉じる処理
  useEffect(() => {
    const closeDropdowns = () => {
      setHourDropdownOpen(false)
      setMinuteDropdownOpen(false)
      setDateDropdownOpen(false)
      setDayDropdownOpen(false)
    }
    
    if (hourDropdownOpen || minuteDropdownOpen || dateDropdownOpen || dayDropdownOpen) {
      document.addEventListener('scroll', closeDropdowns)
      return () => {
        document.removeEventListener('scroll', closeDropdowns)
      }
    }
  }, [hourDropdownOpen, minuteDropdownOpen, dateDropdownOpen, dayDropdownOpen])
  const [isAddingSpot, setIsAddingSpot] = useState(false)
  const [newSpotName, setNewSpotName] = useState('')
  const [newSpotCoords, setNewSpotCoords] = useState<[number, number] | null>(null)
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishForm, setPublishForm] = useState({
    tags: [] as string[],
    comment: ''
  })
  const [publishing, setPublishing] = useState(false)
  const [currentDay, setCurrentDay] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchSpot[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [isLodgingSearchMode, setIsLodgingSearchMode] = useState(false)
  const [lodgingSearchForDay, setLodgingSearchForDay] = useState<number | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  
  // 自動計算された所要時間
  const autoCalculatedDuration = calculateTotalDuration(formData.spots)
  
  // 総日数
  const totalDays = getTotalDays(formData.dayBreaks, formData.spots.length)
  
  // 集合・解散スポットを判定するヘルパー関数
  const getStartEndIds = (spots: Spot[]) => {
    if (spots.length === 0) return { startId: null, endId: null }
    if (spots.length === 1) return { startId: spots[0].id, endId: null }
    return { startId: spots[0].id, endId: spots[spots.length - 1].id }
  }
  
  // 下書きの確認とプラン確認画面からの復元
  useEffect(() => {
    // プラン確認画面から戻ってきた場合の復元を優先
    const restorePlan = sessionStorage.getItem('restorePlan')
    if (restorePlan) {
      try {
        const data = JSON.parse(restorePlan)
        setFormData(data)
        sessionStorage.removeItem('restorePlan') // 復元後は削除
        
        // 地図を最初のスポットにフォーカス
        if (data.spots.length > 0 && map.current) {
          setTimeout(() => {
            map.current?.flyTo({
              center: [data.spots[0].lng, data.spots[0].lat],
              zoom: 14
            })
          }, 500)
        }
        return
      } catch (error) {
        console.error('Restore plan parse error:', error)
        sessionStorage.removeItem('restorePlan')
      }
    }
    
    // プラン確認画面からの復元がない場合のみ下書きをチェック
    const savedDraft = localStorage.getItem('planDraft')
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        // 下書きがある場合はバナーを表示
        setHasDraft(true)
        setShowDraftBanner(true)
      } catch (error) {
        console.error('Draft parse error:', error)
      }
    }
  }, [])
  
  // 下書きの復元
  const handleRestoreDraft = () => {
    const savedDraft = localStorage.getItem('planDraft')
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        setFormData(draft)
        setShowDraftBanner(false)
        showToast('下書きを復元しました', 'success')
        
        // 地図を最初のスポットにフォーカス
        if (draft.spots.length > 0 && map.current) {
          map.current.flyTo({
            center: [draft.spots[0].lng, draft.spots[0].lat],
            zoom: 14
          })
        }
      } catch (error) {
        console.error('Draft restore error:', error)
        showToast('下書きの復元に失敗しました', 'error')
      }
    }
  }
  
  // 下書きの削除
  const handleDeleteDraft = () => {
    localStorage.removeItem('planDraft')
    setHasDraft(false)
    setShowDraftBanner(false)
  }
  
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
    el.appendChild(pulseRing)
    el.appendChild(centerDot)

    return el
  }

  // 位置情報の取得
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('🚫 Geolocation未対応')
      setCurrentLocation([139.7745, 35.6820])
      return
    }

    // iOS対応の位置情報取得
    const requestLocationPermission = async () => {
      try {
        // 高精度位置情報を一度取得
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000 // 1分間はキャッシュ使用
            }
          )
        })

        const { latitude, longitude } = position.coords
        console.log('📍 位置情報取得成功:', { lat: latitude, lng: longitude })
        setCurrentLocation([longitude, latitude])
      } catch (error: any) {
        console.error('❌ 位置情報取得失敗:', error.message)
        setCurrentLocation([139.7745, 35.6820]) // 東京駅
      }
    }

    requestLocationPermission()
  }, [])
  
  // 地図の初期化 - 現在地取得後に実行
  useEffect(() => {
    if (!mapContainer.current || !currentLocation) return
    
    if (!map.current) {
      try {
        
        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            name: 'OpenStreetMap',
            sources: {
              'osm-raster': {
                type: 'raster',
                tiles: [
                  'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
                maxzoom: 19
              }
            },
            layers: [{
              id: 'osm-raster-layer',
              type: 'raster',
              source: 'osm-raster',
              minzoom: 0,
              maxzoom: 19
            }]
          },
          center: currentLocation,
          zoom: 14,
          attributionControl: false
        })

      // 地図ロード完了を待つ
      map.current.on('load', () => {
        console.log('Map loaded successfully')
        setMapLoading(false)
        setMapError(null)
        
        // 現在地マーカー（カスタム1.5倍サイズ）
        const markerElement = createCurrentLocationMarker()
        currentLocationMarker.current = new maplibregl.Marker({ 
          element: markerElement,
          anchor: 'center'
        })
          .setLngLat(currentLocation)
          .addTo(map.current!)
      })
      
      // 地図長押しでスポット追加
      let pressTimer: NodeJS.Timeout
      let isLongPress = false
      
      map.current.on('mousedown', () => {
        isLongPress = false
        pressTimer = setTimeout(() => {
          isLongPress = true
        }, 500)
      })
      
      map.current.on('mouseup', () => {
        clearTimeout(pressTimer)
      })
      
      map.current.on('click', (e) => {
        if (isLongPress) {
          setNewSpotCoords([e.lngLat.lng, e.lngLat.lat])
          setIsAddingSpot(true)
        }
      })
      
      // エラーハンドリング
      map.current.on('error', (e) => {
        console.error('MapLibre error:', e)
        setMapError('地図の読み込みに失敗しました')
        setMapLoading(false)
        showToast('地図の読み込みに失敗しました', 'error')
      })
      } catch (error) {
        console.error('Map initialization error:', error)
        setMapError('地図の初期化に失敗しました')
        setMapLoading(false)
        showToast('地図の初期化に失敗しました', 'error')
      }
    }
    
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
      // マーカーをクリーンアップ
      markers.current.forEach(marker => marker.remove())
      markers.current = []
      if (currentLocationMarker.current) {
        currentLocationMarker.current.remove()
        currentLocationMarker.current = null
      }
    }
  }, [currentLocation]) // 現在地が変更されたら地図を初期化
  
  // 現在地マーカーの更新と地図中心の移動
  useEffect(() => {
    if (currentLocation && map.current && currentLocationMarker.current) {
      // マーカーの位置を更新
      currentLocationMarker.current.setLngLat(currentLocation)
      
      // 地図の中心を現在地に移動（スムーズに）
      map.current.flyTo({
        center: currentLocation,
        zoom: 14,
        duration: 2000
      })
    }
  }, [currentLocation])
  
  // マーカーの更新
  useEffect(() => {
    if (!map.current) return
    
    // 既存のマーカーをクリア
    markers.current.forEach(marker => marker.remove())
    markers.current = []
    
    // 選択中の日のスポットを取得
    const dayBreakdown = getDaysSpotsBreakdown(formData.spots, formData.dayBreaks)
    const currentDaySpots = dayBreakdown[currentDay - 1] || []
    
    // スポットのマーカーを追加
    formData.spots.forEach((spot, index) => {
      const isCurrentDay = currentDaySpots.includes(spot)
      
      const marker = new maplibregl.Marker({
        color: isCurrentDay ? '#EF4444' : '#D1D5DB', // 選択中の日は赤、他は灰色
        draggable: true
      })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map.current!)
      
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat()
        updateSpotLocation(spot.id, lngLat.lng, lngLat.lat)
      })
      
      markers.current.push(marker)
    })
    
    // ルートラインの描画（選択中の日のみ濃く表示）
    if (formData.spots.length > 1 && map.current?.isStyleLoaded()) {
      const dayBreakdown = getDaysSpotsBreakdown(formData.spots, formData.dayBreaks)
      const currentDaySpots = dayBreakdown[currentDay - 1] || []
      
      // 全体のルートライン（薄い表示）
      const allCoordinates = formData.spots.map(spot => [spot.lng, spot.lat])
      
      // 選択中の日のルートライン（濃い表示）
      const currentDayCoordinates = currentDaySpots.map(spot => [spot.lng, spot.lat])
      
      try {
        // 全体のルートライン（薄い）
        if (map.current.getSource('route-all')) {
          (map.current.getSource('route-all') as maplibregl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: allCoordinates
            }
          })
        } else {
          map.current.addSource('route-all', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: allCoordinates
              }
            }
          })
          
          map.current.addLayer({
            id: 'route-all',
            type: 'line',
            source: 'route-all',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#D1D5DB',
              'line-width': 2,
              'line-opacity': 0.5
            }
          })
        }
        
        // 選択中の日のルートライン（濃い）
        if (currentDayCoordinates.length > 1) {
          if (map.current.getSource('route-current')) {
            (map.current.getSource('route-current') as maplibregl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: currentDayCoordinates
              }
            })
          } else {
            map.current.addSource('route-current', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: currentDayCoordinates
                }
              }
            })
            
            map.current.addLayer({
              id: 'route-current',
              type: 'line',
              source: 'route-current',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#3B82F6',
                'line-width': 3
              }
            })
          }
        } else {
          // 選択中の日のスポットが1個以下の場合は現在のルートラインを削除
          if (map.current.getLayer('route-current')) {
            map.current.removeLayer('route-current')
          }
          if (map.current.getSource('route-current')) {
            map.current.removeSource('route-current')
          }
        }
      } catch (error) {
        console.error('Route line error:', error)
      }
    } else if (formData.spots.length <= 1) {
      // スポットが1個以下の場合は全てのルートラインを削除
      try {
        ['route-all', 'route-current'].forEach(layerId => {
          if (map.current?.getLayer(layerId)) {
            map.current.removeLayer(layerId)
          }
          if (map.current?.getSource(layerId)) {
            map.current.removeSource(layerId)
          }
        })
      } catch (error) {
        console.error('Route cleanup error:', error)
      }
    }
  }, [formData.spots, formData.dayBreaks, currentDay])
  
  const updateSpotLocation = (spotId: string, lng: number, lat: number) => {
    setFormData(prev => ({
      ...prev,
      spots: prev.spots.map(spot =>
        spot.id === spotId ? { ...spot, lng, lat } : spot
      )
    }))
  }
  
  // 地図のbounds取得関数
  const getMapBounds = useCallback(() => {
    if (!map.current) {
      // デフォルトのbounds（東京周辺）
      return {
        south: 35.6,
        west: 139.7,
        north: 35.7,
        east: 139.8
      }
    }
    
    const bounds = map.current.getBounds()
    return {
      south: bounds.getSouth(),
      west: bounds.getWest(),  
      north: bounds.getNorth(),
      east: bounds.getEast()
    }
  }, [])
  
  
  // 現在地に戻る機能
  const goToCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [position.coords.longitude, position.coords.latitude]
          setCurrentLocation(newLocation)
          
          if (map.current) {
            map.current.flyTo({
              center: newLocation,
              zoom: 16,
              duration: 1500
            })
          }
          
          // 現在地マーカーを更新
          if (currentLocationMarker.current) {
            currentLocationMarker.current.setLngLat(newLocation)
          }
        },
        (error) => {
          console.error('Geolocation error:', error)
          showToast('現在地の取得に失敗しました', 'error')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    }
  }
  
  const addSpot = (name: string, lng: number, lat: number) => {
    const newSpot: Spot = {
      id: `spot-${Date.now()}-${Math.random()}`,
      name,
      lat,
      lng,
      stayTime: 20 // デフォルト20分
    }
    
    setFormData(prev => ({
      ...prev,
      spots: [...prev.spots, newSpot]
    }))
    
    // 地図を新しいスポットにフォーカス
    if (map.current) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 15
      })
    }
    
    setIsAddingSpot(false)
    setNewSpotName('')
    setNewSpotCoords(null)
  }
  
  const removeSpot = (spotId: string) => {
    setFormData(prev => ({
      ...prev,
      spots: prev.spots.filter(spot => spot.id !== spotId)
    }))
  }
  
  const updateSpotStayTime = (spotId: string, stayTime: number) => {
    setFormData(prev => ({
      ...prev,
      spots: prev.spots.map(spot =>
        spot.id === spotId ? { ...spot, stayTime } : spot
      )
    }))
  }
  
  // スポットがどの日にあるかを判定
  const getDayForSpot = (spotIndex: number, dayBreaks: number[]): number => {
    let day = 1
    for (const breakIndex of dayBreaks) {
      if (spotIndex <= breakIndex) {
        return day
      }
      day++
    }
    return day
  }

  // 指定した日の宿泊スポットを取得
  const getLodgingForDay = (dayNumber: number): Spot | null => {
    const dayBreakdown = getDaysSpotsBreakdown(formData.spots, formData.dayBreaks)
    if (dayNumber <= dayBreakdown.length) {
      const daySpots = dayBreakdown[dayNumber - 1]
      return daySpots.find(spot => spot.isLodging) || null
    }
    return null
  }

  // 指定した日に宿泊スポットがあるかを判定
  const hasLodgingForDay = (dayNumber: number): boolean => {
    return getLodgingForDay(dayNumber) !== null
  }

  // 宿泊検索を開始
  const startLodgingSearch = (dayNumber: number) => {
    setIsLodgingSearchMode(true)
    setLodgingSearchForDay(dayNumber)
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }

  // 宿泊スポットを削除（宿泊のみ削除、区切りは維持）
  const removeLodgingForDay = (dayNumber: number) => {
    const lodgingSpot = getLodgingForDay(dayNumber)
    if (lodgingSpot) {
      const spotIndex = formData.spots.findIndex(spot => spot.id === lodgingSpot.id)
      if (spotIndex !== -1) {
        setFormData(prev => {
          const newSpots = [...prev.spots]
          newSpots.splice(spotIndex, 1)
          
          // 削除によって影響を受ける dayBreaks を調整
          const adjustedDayBreaks = prev.dayBreaks.map(breakIndex => 
            breakIndex > spotIndex ? breakIndex - 1 : breakIndex
          )
          
          return {
            ...prev,
            spots: newSpots,
            dayBreaks: adjustedDayBreaks
          }
        })
      }
    }
  }

  // 日付をまたぐ移動かどうかを判定
  const isCrossDayMove = (fromIndex: number, toIndex: number, dayBreaks: number[]): boolean => {
    const fromDay = getDayForSpot(fromIndex, dayBreaks)
    const toDay = getDayForSpot(toIndex, dayBreaks)
    return fromDay !== toDay
  }

  // 日付区切りを考慮したスポット移動関数
  const performSpotMove = (fromIndex: number, toIndex: number) => {
    console.log('🔥 === DAY-AWARE MOVE START ===')
    console.log('🔥 Moving from:', fromIndex, '→ to position:', toIndex)
    console.log('🔥 Current spots:', formData.spots.map((s, i) => `${i}:${s.name}`))
    console.log('🔥 Current dayBreaks:', formData.dayBreaks)
    
    if (fromIndex === toIndex) {
      console.log('🔥 Same position, skipping')
      return
    }
    
    // 範囲チェック
    const safeFromIndex = Math.max(0, Math.min(fromIndex, formData.spots.length - 1))
    let safeToIndex = Math.max(0, Math.min(toIndex, formData.spots.length))
    
    // 移動元と移動先の日を判定
    const fromDay = getDayForSpot(safeFromIndex, formData.dayBreaks)
    const toDay = getDayForSpot(safeToIndex, formData.dayBreaks)
    const crossDay = fromDay !== toDay
    
    console.log('🔥 From day:', fromDay, 'To day:', toDay, 'Cross-day move:', crossDay)
    
    const newSpots = [...formData.spots]
    const movingSpot = newSpots[safeFromIndex]
    
    console.log('🔥 Moving:', movingSpot.name, 'from index', safeFromIndex, 'to index', safeToIndex)
    
    // 要素を削除
    const [movedSpot] = newSpots.splice(safeFromIndex, 1)
    console.log('🔥 After removal:', newSpots.map(s => s.name))
    
    // 削除によって影響を受ける日付区切りを調整
    let newDayBreaks = formData.dayBreaks.map(breakIndex => {
      if (breakIndex > safeFromIndex) {
        return breakIndex - 1
      }
      return breakIndex
    }).filter(breakIndex => breakIndex >= 0) // 無効なインデックスを除去
    
    console.log('🔥 DayBreaks after removal:', newDayBreaks)
    
    // 挿入位置の計算
    let insertIndex = safeToIndex
    if (safeFromIndex < safeToIndex) {
      insertIndex = safeToIndex - 1
    }
    
    // 配列の範囲内に収める
    insertIndex = Math.max(0, Math.min(insertIndex, newSpots.length))
    
    console.log('🔥 Final insert index:', insertIndex)
    console.log('🔥 Will insert before:', newSpots[insertIndex]?.name || '[END]')
    
    // 要素を挿入
    newSpots.splice(insertIndex, 0, movedSpot)
    
    // 挿入によって影響を受ける日付区切りを調整
    const finalDayBreaks = newDayBreaks.map(breakIndex => {
      if (breakIndex >= insertIndex) {
        return breakIndex + 1
      }
      return breakIndex
    })
    
    console.log('🔥 FINAL spots:', newSpots.map((s, i) => `${i}:${s.name}`))
    console.log('🔥 FINAL dayBreaks:', finalDayBreaks)
    console.log('🔥 === DAY-AWARE MOVE END ===')
    
    setFormData(prev => ({ 
      ...prev, 
      spots: newSpots,
      dayBreaks: finalDayBreaks
    }))
  }
  
  const handleSaveDraft = () => {
    // 下書き保存の処理
    try {
      localStorage.setItem('planDraft', JSON.stringify(formData))
      localStorage.setItem('planDraftDate', new Date().toISOString())
      console.log('Save draft:', formData)
      showToast('下書きを保存しました', 'success')
    } catch (error) {
      console.error('Draft save error:', error)
      showToast('下書きの保存に失敗しました', 'error')
    }
  }
  
  const handleCreateShareLink = async () => {
    if (formData.spots.length < 1) return
    
    try {
      // プランデータをsessionStorageに保存して確認ページへ
      sessionStorage.setItem('previewPlan', JSON.stringify(formData))
      console.log('Moving to preview page with plan data:', formData)
      
      // プラン確認ページへ遷移
      router.push('/plan/preview')
    } catch (error) {
      console.error('Preview error:', error)
      showToast('エラーが発生しました', 'error')
    }
  }
  
  const handlePublish = () => {
    console.log('handlePublish called, spots:', formData.spots.length)
    if (formData.spots.length < 1) {
      showToast('1つ以上のスポットが必要です', 'error')
      return
    }
    
    // 投稿フォームに現在のプラン名を設定
    setPublishForm(prev => ({
      ...prev,
      tags: [],
      comment: ''
    }))
    
    console.log('Setting showPublishModal to true')
    setShowPublishModal(true)
  }
  
  const handlePublishConfirm = async () => {
    if (formData.spots.length < 1) return
    
    setPublishing(true)
    try {
      // プランIDを生成
      const planId = Date.now().toString()
      
      // プランデータを作成（日時は除外してマップに投稿）
      const planData = {
        ...formData,
        title: formData.title || `プラン${planId}`,
        tags: publishForm.tags,
        comment: publishForm.comment,
        isPublic: true,
        publishedAt: new Date().toISOString(),
        // マップ投稿時は日時を除外
        scheduledDate: undefined
      }
      
      console.log('Publishing plan (without scheduledDate):', planData)
      
      // APIコール（モック）
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      showToast('マップに投稿しました！', 'success')
      setShowPublishModal(false)
      setPublishForm({ tags: [], comment: '' })
      
      // 投稿完了後、ホーム画面へ遷移
      setTimeout(() => {
        router.push('/home')
      }, 1000)
    } catch (error) {
      console.error('Publish error:', error)
      showToast('投稿に失敗しました', 'error')
    } finally {
      setPublishing(false)
    }
  }
  
  const toggleTag = (tag: string) => {
    setPublishForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
  
  // 所要時間を適切な単位で表示するヘルパー関数
  const formatDurationMinutes = (minutes: number): string => {
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

  const getDurationText = () => {
    const minutes = autoCalculatedDuration
    return formatDurationMinutes(minutes)
  }
  
  // 日を追加する関数
  const handleAddDay = () => {
    if (formData.spots.length === 0) {
      showToast('スポットを追加してから日を追加してください', 'error')
      return
    }
    
    const lastSpotIndex = formData.spots.length - 1
    if (!formData.dayBreaks.includes(lastSpotIndex)) {
      setFormData(prev => ({
        ...prev,
        dayBreaks: [...prev.dayBreaks, lastSpotIndex]
      }))
      // 実際に日付区切りが追加された場合のみcurrentDayを更新
      setCurrentDay(totalDays + 1)
    } else {
      // 既に日付区切りがある場合はメッセージを表示
      showToast('この位置には既に日付区切りがあります', 'error')
    }
  }
  
  // 区切りカードを削除する関数
  const removeDayBreak = (breakIndex: number) => {
    setFormData(prev => ({
      ...prev,
      dayBreaks: prev.dayBreaks.filter(index => index !== breakIndex)
    }))
  }
  
  // 宿泊関連関数を削除（スポット検索で手動で宿泊タグを付けるように変更）
  
  // 検索関数
  const handleSearchInputChange = useCallback(async (value: string) => {
    setSearchQuery(value)
    
    if (!value.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    
    setSearchLoading(true)
    setShowSearchResults(true)
    
    try {
      // Nominatim検索を試行
      const nominatimResults = await searchNominatim(value)
      if (nominatimResults.length > 0) {
        setSearchResults(nominatimResults)
      } else {
        // フォールバック検索
        const fallbackResults = await searchFallback(value)
        setSearchResults(fallbackResults)
      }
    } catch (error) {
      console.error('Search error:', error)
      const fallbackResults = await searchFallback(value)
      setSearchResults(fallbackResults)
    } finally {
      setSearchLoading(false)
    }
  }, [])
  
  // タグ選択ハンドラ
  const handleTagSelect = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag))
    } else if (selectedTags.length < 3) {
      setSelectedTags(prev => [...prev, tag])
    }
  }
  
  // スポット追加ハンドラ（検索結果から）
  const handleAddSpotFromSearch = (searchSpot: SearchSpot) => {
    const newSpot: Spot = {
      id: `spot-${Date.now()}-${Math.random()}`,
      name: searchSpot.name,
      lat: searchSpot.lat,
      lng: searchSpot.lng,
      stayTime: 20, // デフォルト20分
      isLodging: isLodgingSearchMode // 宿泊モードの場合はisLodgingをtrueに
    }
    
    if (isLodgingSearchMode && lodgingSearchForDay !== null) {
      // 宿泊モードの場合：既存宿泊の削除と新宿泊の追加を一括で実行
      setFormData(prev => {
        // 同日内の既存宿泊を探す（現在の状態から）
        const dayBreakdown = getDaysSpotsBreakdown(prev.spots, prev.dayBreaks)
        let existingLodging: Spot | null = null
        if (lodgingSearchForDay <= dayBreakdown.length) {
          const daySpots = dayBreakdown[lodgingSearchForDay - 1]
          existingLodging = daySpots.find(spot => spot.isLodging) || null
        }
        
        let currentSpots = [...prev.spots]
        let currentDayBreaks = [...prev.dayBreaks]
        
        // 既存宿泊がある場合は削除
        if (existingLodging) {
          const existingIndex = currentSpots.findIndex(spot => spot.id === existingLodging.id)
          if (existingIndex !== -1) {
            currentSpots = currentSpots.filter((_, index) => index !== existingIndex)
            // 削除によって影響を受ける dayBreaks を調整
            currentDayBreaks = currentDayBreaks.map(breakIndex => 
              breakIndex > existingIndex ? breakIndex - 1 : breakIndex
            )
          }
        }
        
        // 区切り位置を計算（該当日の最後）
        let insertIndex = currentSpots.length
        if (lodgingSearchForDay <= currentDayBreaks.length) {
          const targetBreakIndex = currentDayBreaks[lodgingSearchForDay - 1]
          if (targetBreakIndex !== undefined) {
            insertIndex = targetBreakIndex
          }
        }
        
        // 宿泊スポットを区切り直前に挿入
        currentSpots.splice(insertIndex, 0, newSpot)
        
        // 挿入によって影響を受ける dayBreaks を調整
        const finalDayBreaks = currentDayBreaks.map(breakIndex => 
          breakIndex >= insertIndex ? breakIndex + 1 : breakIndex
        )
        
        return {
          ...prev,
          spots: currentSpots,
          dayBreaks: finalDayBreaks
        }
      })
      
      // 宿泊モードを終了
      setIsLodgingSearchMode(false)
      setLodgingSearchForDay(null)
    } else {
      // 通常モード：スポットリストの最後に追加
      setFormData(prev => ({
        ...prev,
        spots: [...prev.spots, newSpot]
      }))
    }
    
    // 検索をクリア
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
    
    // 地図を新しいスポットにフォーカス
    if (map.current) {
      map.current.flyTo({
        center: [searchSpot.lng, searchSpot.lat],
        zoom: 15
      })
    }
  }
  
  // Nominatim API検索（既存のSpotSearchMiniから移植）
  const searchNominatim = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return []
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: searchQuery,
          format: 'json',
          limit: '10',
          countrycodes: 'jp',
          'accept-language': 'ja,en'
        })
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Tomotabi/1.0)',
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!Array.isArray(data)) {
        return []
      }
      
      const results = data.map((item: any) => ({
        id: `nominatim-${item.place_id}`,
        name: item.display_name?.split(',')[0] || item.name || 'Unknown',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        source: 'nominatim' as const,
        tags: { display_name: item.display_name, type: item.type, class: item.class }
      }))
      
      return results
    } catch (error) {
      console.error('Nominatim search error:', error)
      throw error
    }
  }, [])

  // フォールバック検索（既存のSpotSearchMiniから移植）
  const searchFallback = useCallback(async (searchQuery: string) => {
    const fallbackSpots = [
      { name: '東京タワー', lat: 35.6586, lng: 139.7454 },
      { name: '浅草寺', lat: 35.7148, lng: 139.7967 },
      { name: 'スカイツリー', lat: 35.7101, lng: 139.8107 },
      { name: '明治神宮', lat: 35.6764, lng: 139.6993 },
      { name: '上野動物園', lat: 35.7176, lng: 139.7713 },
      { name: '築地場外市場', lat: 35.6658, lng: 139.7703 },
      { name: '皇居東御苑', lat: 35.6851, lng: 139.7530 },
      { name: '原宿', lat: 35.6702, lng: 139.7026 },
      { name: 'お台場', lat: 35.6267, lng: 139.7762 },
      { name: '六本木ヒルズ', lat: 35.6606, lng: 139.7292 },
      { name: '渋谷', lat: 35.6598, lng: 139.7006 },
      { name: '新宿', lat: 35.6896, lng: 139.7006 },
      { name: '銀座', lat: 35.6717, lng: 139.7648 },
      { name: '表参道', lat: 35.6654, lng: 139.7124 },
      { name: '上野公園', lat: 35.7140, lng: 139.7744 }
    ]
    
    const query = searchQuery.toLowerCase()
    const matchedSpots = fallbackSpots.filter(spot => 
      spot.name.toLowerCase().includes(query) ||
      spot.name.toLowerCase().replace(/\s/g, '').includes(query.replace(/\s/g, ''))
    ).slice(0, 8)
    
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return matchedSpots.map((spot, index) => ({
      id: `fallback-${Date.now()}-${index}`,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      source: 'nominatim' as const,
      tags: { display_name: `${spot.name}, 東京, 日本`, type: 'fallback' }
    }))
  }, [])

  // タグスクロール関連
  const checkScrollButtons = useCallback(() => {
    if (tagScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tagScrollRef.current
      setCanScrollLeft(scrollLeft > 10)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }, [])

  const scrollTags = (direction: 'left' | 'right') => {
    if (tagScrollRef.current) {
      const scrollAmount = 200
      const newScrollLeft = direction === 'left' 
        ? tagScrollRef.current.scrollLeft - scrollAmount
        : tagScrollRef.current.scrollLeft + scrollAmount
      
      tagScrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      })
      
      setTimeout(checkScrollButtons, 300)
    }
  }

  useEffect(() => {
    checkScrollButtons()
    const handleResize = () => checkScrollButtons()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [checkScrollButtons, selectedTags])

  // デバッグ用
  useEffect(() => {
    console.log('showPublishModal state:', showPublishModal)
  }, [showPublishModal])

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-50 px-4 py-3 h-16 flex items-center justify-between">
        <button
          onClick={() => router.push('/home')}
          className="text-gray-700"
          aria-label="戻る"
        >
          ←
        </button>
        <h1 className="font-semibold">プラン作成</h1>
        <button
          onClick={handleSaveDraft}
          className="text-sm"
          style={{ color: '#2db5a5' }}
          aria-label="下書き保存"
        >
          下書き保存
        </button>
      </header>
      
      {/* Dayタブを削除 - スポットセクションに統合 */}
      
      {/* 検索バー */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-white px-2 py-1">
        <div className="bg-white rounded-lg shadow-sm flex items-center px-3 py-2">
          {isLodgingSearchMode ? (
            <AccommodationIcon className="w-5 h-5 text-orange-500 mr-3" />
          ) : (
            <svg 
              className="w-5 h-5 text-gray-400 mr-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          )}
          <input
            type="text"
            value={searchQuery}
            placeholder={isLodgingSearchMode ? "宿泊先を検索" : "スポットを検索してプランに追加"}
            className="flex-1 text-base outline-none placeholder-gray-400"
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.parentElement!.style.boxShadow = '0 0 0 2px #2db5a5'
            }}
            onBlur={(e) => {
              e.currentTarget.parentElement!.style.boxShadow = ''
            }}
          />
          {searchLoading && (
            <div className="animate-spin w-4 h-4 border-2 border-gray-300 rounded-full ml-3" style={{ borderTopColor: '#2db5a5' }} />
          )}
          {isLodgingSearchMode && (
            <button
              onClick={() => {
                setIsLodgingSearchMode(false)
                setLodgingSearchForDay(null)
                setSearchQuery('')
                setSearchResults([])
                setShowSearchResults(false)
              }}
              className="ml-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>

      {/* タグバー */}
      <div 
        className="fixed left-0 right-0 z-30 bg-white shadow-sm border-b border-gray-100"
        style={{ 
          top: '96px' // 検索バーの直下から開始
        }}
      >
        {/* モバイル用：コンパクト横スクロール */}
        <div className="block md:hidden relative px-2 py-2 pt-5">
          {/* スクロール左ボタン */}
          {canScrollLeft && (
            <button
              onClick={() => scrollTags('left')}
              className="absolute left-0 z-10 w-6 h-6 bg-white/90 border border-gray-300 rounded-full shadow-sm flex items-center justify-center backdrop-blur-sm hover:bg-white transition-all duration-150"
              style={{ top: '60%', transform: 'translateY(-50%)' }}
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
              className="absolute right-0 z-10 w-6 h-6 bg-white/90 border border-gray-300 rounded-full shadow-sm flex items-center justify-center backdrop-blur-sm hover:bg-white transition-all duration-150"
              style={{ top: '60%', transform: 'translateY(-50%)' }}
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
            onScroll={checkScrollButtons}
          >
            {/* 左端のスペーサー */}
            <div className="flex-shrink-0 w-1"></div>
            
            {POPULAR_TAGS.slice(0, 12).map(tag => {
              const isActive = selectedTags.includes(tag)
              const canSelect = !isActive && selectedTags.length < 3
              
              return (
                <button
                  key={tag}
                  onClick={() => handleTagSelect(tag)}
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
            
            {/* 右端のスペーサー */}
            <div className="flex-shrink-0 w-1"></div>
          </div>
        </div>
      </div>

      {/* 検索結果オーバーレイ */}
      {showSearchResults && (
        <div 
          className="fixed left-0 right-0 z-50 bg-white shadow-lg border border-gray-200 mx-2 rounded-lg max-h-80 overflow-y-auto"
          style={{ 
            top: '153px' // タグバー(115px + 38px)の下
          }}
        >
          {searchResults.length > 0 ? (
            <>
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleAddSpotFromSearch(result)}
                  className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 flex items-center"
                >
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{result.name}</div>
                    <div className="text-xs text-gray-500">
                      {result.source === 'nominatim' ? '住所検索' : 'エリア内'}
                      {result.tags?.display_name && (
                        <span className="ml-2">{result.tags.display_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 ml-2">
                    追加
                  </div>
                </button>
              ))}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              {searchLoading ? '検索中...' : (searchQuery.trim() ? 'スポットが見つかりませんでした' : '')}
            </div>
          )}
        </div>
      )}
      
      {/* 検索結果以外の場所をタップしたときに閉じるためのオーバーレイ */}
      {showSearchResults && (
        <div 
          className="fixed inset-0 z-20" 
          onClick={() => setShowSearchResults(false)}
        />
      )}
      
      {/* 下書き復元バナー */}
      {showDraftBanner && (
        <div 
          className={`fixed left-0 right-0 bg-blue-50 border-b border-blue-200 px-4 py-3 z-50`}
          style={{ 
            top: '191px' // タグバー(115px + 38px + 38px)の下
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span className="text-sm text-gray-700">下書きがあります</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRestoreDraft}
                className="px-3 py-1 text-sm text-white rounded"
                style={{ backgroundColor: '#2db5a5' }}
              >
                復元する
              </button>
              <button
                onClick={handleDeleteDraft}
                className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 地図（全画面） */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 bg-gray-100"
        style={{ 
          width: '100%', 
          height: '100vh',
          minHeight: '100vh'
        }}
      />
      
      {/* 地図ローディング表示 */}
      {mapLoading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: '#2db5a5' }}></div>
            <p className="text-gray-600">地図を読み込み中...</p>
          </div>
        </div>
      )}
      
      {/* 地図エラー表示 */}
      {mapError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center p-4">
            <div className="flex justify-center mb-4">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z" fill="#EF4444"/>
              </svg>
            </div>
            <p className="text-red-600 mb-4">{mapError}</p>
            <button 
              onClick={() => {
                setMapError(null)
                setMapLoading(true)
                window.location.reload()
              }}
              className="px-4 py-2 text-white rounded"
              style={{ backgroundColor: '#2db5a5' }}
            >
              再読み込み
            </button>
          </div>
        </div>
      )}
      
      {/* 現在地ボタン */}
      <button
        onClick={goToCurrentLocation}
        className="fixed bottom-32 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-30 border border-gray-200"
        aria-label="現在地に移動"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#2db5a5' }}>
          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
      </button>
      
      {/* ボトムシート */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 z-40 ${
          bottomSheetState === 'closed' ? 'h-24' :
          bottomSheetState === 'half' ? 'h-1/2' : 'h-4/5'
        }`}
      >
        {/* ドラッグハンドル */}
        <button
          onClick={() => {
            if (bottomSheetState === 'closed') setBottomSheetState('half')
            else if (bottomSheetState === 'half') setBottomSheetState('full')
            else setBottomSheetState('half')
          }}
          className="w-full py-3 flex justify-center"
          aria-label="ボトムシートを開閉"
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </button>
        
        <div 
          className="px-4 pb-20 overflow-y-auto"
          style={{ 
            maxHeight: 'calc(100% - 48px)',
            paddingTop: '0px',
            overflowY: draggedIndex !== null ? 'hidden' : 'auto'
          }}
        >
          {/* スポットリスト */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold">スポット</h3>
                {totalDays > 1 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">|</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setDayDropdownOpen(!dayDropdownOpen)
                          setHourDropdownOpen(false)
                          setMinuteDropdownOpen(false)
                          setDateDropdownOpen(false)
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white flex items-center hover:border-gray-400 transition-colors"
                        style={{ color: '#2db5a5' }}
                      >
                        <span>
                          {currentDay}日目{currentDay === 1 && totalDays === 1 ? '(日帰り)' : ''}
                        </span>
                        <svg 
                          className={`w-3 h-3 ml-1 transition-transform ${dayDropdownOpen ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {dayDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setDayDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 min-w-24">
                            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                              const isSelected = currentDay === day
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    setCurrentDay(day)
                                    setDayDropdownOpen(false)
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs transition-all duration-150 font-medium ${
                                    isSelected
                                      ? 'text-white'
                                      : 'text-gray-900 hover:bg-gray-50'
                                  }`}
                                  style={isSelected ? { backgroundColor: '#2db5a5' } : {}}
                                >
                                  {day}日目{day === 1 && totalDays === 1 ? '(日帰り)' : ''}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {totalDays === 1 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">日帰り</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">{formData.spots.length}件</span>
                {totalDays < 7 && (
                  <button
                    onClick={handleAddDay}
                    className="text-xs px-2 py-1 text-white rounded"
                    style={{ backgroundColor: '#2db5a5' }}
                    title="日を追加"
                  >
                    ＋日
                  </button>
                )}
              </div>
            </div>
            
            <div className="text-xs text-gray-500 mb-2">
              上の検索バーでスポットを検索・追加するか、地図を長押しして手動でスポットを追加できます
            </div>
            
            {/* スポット一覧（区切りカード含む） */}
            <div>
              {formData.spots.map((spot, index) => {
                // 宿泊スポットはスキップ（区切りカードでのみ表示）
                if (spot.isLodging) {
                  return null
                }
                
                const { startId, endId } = getStartEndIds(formData.spots)
                const isStart = spot.id === startId
                const isEnd = spot.id === endId
                const isDayBreak = formData.dayBreaks.includes(index)
                
                // ドロップゾーン表示条件
                const shouldShowDropZone = (draggedIndex === null || (draggedIndex !== index && draggedIndex !== index - 1)) && 
                                         !formData.dayBreaks.includes(index - 1)
                
                return (
                  <React.Fragment key={spot.id}>
                    {/* ドロップゾーン（スポットの前） - 掴んでいるスポットの前後、および日付区切り直後は除外 */}
                    {shouldShowDropZone ? (
                      <div
                        data-drop-zone={index}
                        className={`transition-all duration-200 ${
                          draggedIndex !== null && draggedIndex !== index
                            ? 'h-8 border-2 border-dashed border-transparent hover:border-blue-400 hover:bg-blue-50 rounded-lg flex items-center justify-center'
                            : 'h-1'
                        }`}
                        onDragOver={(e) => {
                          if (draggedIndex !== null && draggedIndex !== index) {
                            e.preventDefault()
                            e.stopPropagation()
                            e.dataTransfer.dropEffect = 'move'
                            e.currentTarget.style.borderColor = '#3B82F6'
                            e.currentTarget.style.backgroundColor = '#DBEAFE'
                          }
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'))
                          
                          console.log('🟣 Normal drop before index:', {
                            index,
                            draggedIdx,
                            spotNames: formData.spots.map(s => s.name),
                            dayBreaks: formData.dayBreaks
                          })
                          
                          if (!isNaN(draggedIdx) && draggedIdx !== index) {
                            console.log('🟣 Normal drop before index:', { index, draggedIdx })
                            performSpotMove(draggedIdx, index)
                          }
                          setDraggedIndex(null)
                          
                          // スタイルをリセット
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        {draggedIndex !== null && draggedIndex !== index && (
                          <div className="text-xs text-blue-600 font-medium">ここにドロップ</div>
                        )}
                      </div>
                    ) : (
                      <div className="h-1" />
                    )}
                    
                    <div
                      data-spot-index={index}
                      className={`flex items-center space-x-2 p-2 rounded-lg transition-all duration-200 select-none mb-2 ${
                        draggedIndex === index 
                          ? 'shadow-xl border border-blue-300 bg-blue-50 transform scale-105 z-50' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      style={draggedIndex === index ? {
                        position: 'relative',
                        zIndex: 1000,
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      } : {}}
                    >
                      <span 
                        className="text-sm font-semibold"
                        aria-label={`${formData.spots.slice(0, index).filter(s => !s.isLodging).length + 1}番${isStart ? '（集合）' : isEnd ? '（解散）' : ''}`}
                      >
                        {formData.spots.slice(0, index).filter(s => !s.isLodging).length + 1}
                      </span>
                      <div className="flex items-center space-x-2 flex-1">
                        <div className="flex items-center space-x-1">
                          <span>{spot.name}</span>
                          {spot.isLodging && (
                            <AccommodationIcon className="w-4 h-4 text-orange-500" />
                          )}
                        </div>
                      </div>
                      
                      {isStart && (
                        <span className="ml-2 px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          集合
                        </span>
                      )}
                      {isEnd && (
                        <span className="ml-2 px-2 py-0.5 text-[11px] rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          解散
                        </span>
                      )}
                      
                      {!spot.isAccommodation && (
                        <>
                          <input
                            type="number"
                            value={spot.stayTime}
                            onChange={(e) => updateSpotStayTime(spot.id, parseInt(e.target.value) || 0)}
                            className="w-16 p-1 border rounded text-center"
                            min="0"
                          />
                          <span className="text-sm text-gray-500">分</span>
                        </>
                      )}
                      
                      {/* 3本線ドラッグハンドル */}
                      <div 
                        className="text-gray-500 hover:text-gray-700 cursor-grab active:cursor-grabbing px-2 py-1 hover:bg-gray-200 rounded transition-colors flex items-center justify-center select-none"
                        style={{ 
                          minWidth: '32px', 
                          minHeight: '32px', 
                          touchAction: 'none',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitTouchCallout: 'none'
                        }}
                        aria-label="ドラッグして順番を変更"
                        draggable
                        onDragStart={(e) => {
                          console.log('Drag start:', index)
                          setDraggedIndex(index)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', index.toString())
                          
                          // 透明なドラッグ画像を設定（実際のカードを見えるようにするため）
                          const canvas = document.createElement('canvas')
                          canvas.width = 1
                          canvas.height = 1
                          const ctx = canvas.getContext('2d')
                          if (ctx) {
                            ctx.globalAlpha = 0
                            ctx.fillRect(0, 0, 1, 1)
                          }
                          e.dataTransfer.setDragImage(canvas, 0, 0)
                        }}
                        onDragEnd={() => {
                          console.log('Drag end')
                          setDraggedIndex(null)
                        }}
                        onTouchStart={(e) => {
                          // passive event listenerの問題を回避
                          console.log('Touch start on drag handle:', index)
                          setDraggedIndex(index)
                          
                          const startIndex = index
                          let currentDropTarget = startIndex
                          
                          const handleTouchMove = (moveEvent: TouchEvent) => {
                            try {
                              moveEvent.preventDefault()
                            } catch (e) {
                              // passive listenerの場合は無視
                            }
                            
                            const touch = moveEvent.touches[0]
                            const dropZones = document.querySelectorAll('[data-drop-zone]')
                            
                            let newTargetIndex = startIndex
                            let foundTarget = false
                            
                            // 優先順位1: after-breakゾーンをチェック（最優先）
                            for (const zone of Array.from(dropZones)) {
                              const dropZoneId = zone.getAttribute('data-drop-zone') || '0'
                              if (dropZoneId.startsWith('after-break-')) {
                                const rect = zone.getBoundingClientRect()
                                if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                                  const breakIndex = parseInt(dropZoneId.replace('after-break-', ''))
                                  newTargetIndex = breakIndex + 1
                                  console.log('🎯 AFTER-BREAK TARGET:', newTargetIndex)
                                  foundTarget = true
                                  zone.classList.add('bg-blue-200')
                                  break // after-breakが見つかったら他は無視
                                } else {
                                  zone.classList.remove('bg-blue-200')
                                }
                              }
                            }
                            
                            // 優先順位2: 通常のドロップゾーン（after-breakが見つからない場合のみ）
                            if (!foundTarget) {
                              for (const zone of Array.from(dropZones)) {
                                const dropZoneId = zone.getAttribute('data-drop-zone') || '0'
                                if (!dropZoneId.startsWith('after-break-')) {
                                  const rect = zone.getBoundingClientRect()
                                  if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                                    const dropIndex = parseInt(dropZoneId)
                                    newTargetIndex = dropIndex
                                    foundTarget = true
                                    zone.classList.add('bg-blue-200')
                                    break // 最初に見つかったものを採用
                                  } else {
                                    zone.classList.remove('bg-blue-200')
                                  }
                                }
                              }
                            }
                            
                            // 優先順位3: スポット要素上でのドロップ（下半分で「後ろに挿入」を優先）
                            if (!foundTarget) {
                              const spotElements = document.querySelectorAll('[data-spot-index]')
                              let bestMatch = null
                              let bestDistance = Infinity
                              
                              // 最も近いスポットを見つける
                              for (let i = 0; i < spotElements.length; i++) {
                                const element = spotElements[i]
                                const rect = element.getBoundingClientRect()
                                const centerY = rect.top + rect.height / 2
                                const distance = Math.abs(touch.clientY - centerY)
                                
                                if (touch.clientY >= rect.top && touch.clientY <= rect.bottom && distance < bestDistance) {
                                  bestMatch = { index: i, rect, centerY }
                                  bestDistance = distance
                                }
                              }
                              
                              if (bestMatch) {
                                const { index, rect, centerY } = bestMatch
                                const midY = rect.top + rect.height / 2
                                
                                if (touch.clientY >= midY) {
                                  // スポットの下半分 = そのスポットの後ろに挿入
                                  newTargetIndex = index + 1
                                  console.log('🟡 BEST Spot drop (after):', index, '→', newTargetIndex, 'touchY:', touch.clientY, 'midY:', midY)
                                } else {
                                  // スポットの上半分 = そのスポットの前に挿入
                                  newTargetIndex = index
                                  console.log('🟡 BEST Spot drop (before):', index, '→', newTargetIndex, 'touchY:', touch.clientY, 'midY:', midY)
                                }
                                foundTarget = true
                              }
                            }
                            
                            // ドロップゾーン以外のクリア
                            if (foundTarget) {
                              dropZones.forEach(zone => {
                                const rect = zone.getBoundingClientRect()
                                if (!(touch.clientY >= rect.top && touch.clientY <= rect.bottom)) {
                                  zone.classList.remove('bg-blue-200')
                                }
                              })
                            }
                            
                            // ターゲットが変わった場合のみログ出力（安定化のため頻繁な変更を抑制）
                            if (currentDropTarget !== newTargetIndex && foundTarget) {
                              console.log('🔄 Target change:', currentDropTarget, '→', newTargetIndex)
                              currentDropTarget = newTargetIndex
                            }
                          }
                          
                          const handleTouchEnd = () => {
                            console.log('Touch end, startIndex:', startIndex, 'currentDropTarget:', currentDropTarget)
                            console.log('Final move decision: moving from', startIndex, 'to', currentDropTarget)
                            
                            // ハイライトをクリア
                            document.querySelectorAll('[data-drop-zone]').forEach(zone => {
                              zone.classList.remove('bg-blue-200')
                            })
                            
                            if (currentDropTarget !== startIndex && currentDropTarget >= 0) {
                              console.log('🔵 Touch end move:', {
                                startIndex,
                                currentDropTarget,
                                spotsLength: formData.spots.length,
                                spotNames: formData.spots.map(s => s.name),
                                dayBreaks: formData.dayBreaks
                              })
                              
                              // 統一された挿入ロジック
                              performSpotMove(startIndex, currentDropTarget)
                            }
                            
                            setDraggedIndex(null)
                            document.removeEventListener('touchmove', handleTouchMove)
                            document.removeEventListener('touchend', handleTouchEnd)
                          }
                          
                          document.addEventListener('touchmove', handleTouchMove, { passive: false })
                          document.addEventListener('touchend', handleTouchEnd, { passive: true })
                        }}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
                        </svg>
                      </div>
                      
                      <button
                        onClick={() => removeSpot(spot.id)}
                        className="text-red-500"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* 区切りカード */}
                    {isDayBreak && (
                      <>
                        <div className="relative my-4 p-3 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm text-gray-600">
                              <span>─── {formData.dayBreaks.indexOf(index) + 1}日目おわり ───</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => removeDayBreak(index)}
                                className="text-red-500 text-sm"
                                aria-label="区切りを削除"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          
                          {/* 宿泊セクション */}
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            {(() => {
                              const dayNumber = formData.dayBreaks.indexOf(index) + 1
                              const lodging = getLodgingForDay(dayNumber)
                              
                              return lodging ? (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <AccommodationIcon className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm text-gray-700">宿泊：{lodging.name}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => startLodgingSearch(dayNumber)}
                                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                      変更
                                    </button>
                                    <button
                                      onClick={() => removeLodgingForDay(dayNumber)}
                                      className="px-2 py-1 text-xs text-red-600 hover:text-red-800 transition-colors"
                                    >
                                      削除
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startLodgingSearch(dayNumber)}
                                  className="flex items-center space-x-2 w-full text-left px-2 py-1 text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors"
                                >
                                  <AccommodationIcon className="w-4 h-4" />
                                  <span>宿泊を追加</span>
                                </button>
                              )
                            })()}
                          </div>
                        </div>
                        
                        {/* 区切りの後のドロップゾーン（次の日の開始） - ドラッグ中かつ次のスポットの直前でない場合のみ表示 */}
                        {draggedIndex !== null && draggedIndex !== index + 1 ? (
                          <div
                            data-drop-zone={`after-break-${index}`}
                            className="h-8 border-2 border-dashed border-transparent hover:border-blue-400 hover:bg-blue-50 rounded-lg flex items-center justify-center transition-all duration-200"
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            e.dataTransfer.dropEffect = 'move'
                            e.currentTarget.style.borderColor = '#3B82F6'
                            e.currentTarget.style.backgroundColor = '#DBEAFE'
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.style.borderColor = 'transparent'
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'))
                            
                            if (!isNaN(draggedIdx)) {
                              const targetIndex = index + 1
                              console.log('🔴 After-break drop:', {
                                draggedIdx,
                                breakAtIndex: index,
                                targetIndex,
                                spotsLength: formData.spots.length
                              })
                              
                              performSpotMove(draggedIdx, targetIndex)
                            }
                            setDraggedIndex(null)
                            
                            // スタイルをリセット
                            e.currentTarget.style.borderColor = 'transparent'
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          {draggedIndex !== null && (
                            <div className="text-xs text-blue-600 font-medium">ここにドロップ</div>
                          )}
                          </div>
                        ) : (
                          <div className="h-1" />
                        )}
                      </>
                    )}
                    
                    {/* 最後のスポットの後のドロップゾーン - 最後のスポットを掴んでいる場合は除外 */}
                    {index === formData.spots.length - 1 && draggedIndex !== formData.spots.length - 1 && (
                      <div
                        data-drop-zone={formData.spots.length}
                        className={`transition-all duration-200 ${
                          draggedIndex !== null
                            ? 'h-8 border-2 border-dashed border-transparent hover:border-blue-400 hover:bg-blue-50 rounded-lg flex items-center justify-center'
                            : 'h-1'
                        }`}
                        onDragOver={(e) => {
                          if (draggedIndex !== null) {
                            e.preventDefault()
                            e.stopPropagation()
                            e.dataTransfer.dropEffect = 'move'
                            e.currentTarget.style.borderColor = '#3B82F6'
                            e.currentTarget.style.backgroundColor = '#DBEAFE'
                          }
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'))
                          
                          console.log('⚫ Drop after last spot:', {
                            draggedIdx,
                            spotsLength: formData.spots.length,
                            spotNames: formData.spots.map(s => s.name)
                          })
                          
                          if (!isNaN(draggedIdx)) {
                            console.log('⚫ Drop after last spot:', { draggedIdx })
                            performSpotMove(draggedIdx, formData.spots.length)
                          }
                          setDraggedIndex(null)
                          
                          // スタイルをリセット
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        {draggedIndex !== null && (
                          <div className="text-xs text-blue-600 font-medium">ここにドロップ</div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
          
          {/* 所要時間（自動計算） */}
          {formData.spots.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                所要時間
              </label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">自動計算</span>
                  <span className="font-semibold">{getDurationText()}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  移動時間 + 滞在時間で計算されています
                </p>
              </div>
            </div>
          )}
          
          {/* 予定日時 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              予定日時（任意）
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">日にち</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg appearance-none pr-10 text-gray-900"
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield',
                      color: formData.scheduledDate ? '#111827' : '#9CA3AF'
                    }}
                  />
                  {!formData.scheduledDate && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">時</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setHourDropdownOpen(!hourDropdownOpen)
                      setMinuteDropdownOpen(false)
                      setDateDropdownOpen(false)
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors"
                  >
                    <span className={formData.scheduledHour ? 'text-black' : 'text-gray-500'}>
                      {formData.scheduledHour ? formData.scheduledHour.padStart(2, '0') : '--'}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform ${hourDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {hourDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setHourDropdownOpen(false)}
                      />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, scheduledHour: '' }))
                            setHourDropdownOpen(false)
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-500 border-b border-gray-100 transition-colors"
                        >
                          --
                        </button>
                        {Array.from({ length: 24 }, (_, hour) => {
                          const isSelected = formData.scheduledHour === hour.toString()
                          return (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, scheduledHour: hour.toString() }))
                                setHourDropdownOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left transition-all duration-150 font-medium ${
                                isSelected
                                  ? 'text-white'
                                  : 'text-gray-900 hover:bg-gray-50'
                              }`}
                              style={isSelected ? { backgroundColor: '#2db5a5' } : {}}
                            >
                              {hour.toString().padStart(2, '0')}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">分</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setMinuteDropdownOpen(!minuteDropdownOpen)
                      setHourDropdownOpen(false)
                      setDateDropdownOpen(false)
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors"
                  >
                    <span className={formData.scheduledMinute ? 'text-black' : 'text-gray-500'}>
                      {formData.scheduledMinute || '--'}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform ${minuteDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {minuteDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setMinuteDropdownOpen(false)}
                      />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, scheduledMinute: '' }))
                            setMinuteDropdownOpen(false)
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-500 border-b border-gray-100 transition-colors"
                        >
                          --
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, scheduledMinute: '00' }))
                            setMinuteDropdownOpen(false)
                          }}
                          className={`w-full px-4 py-3 text-left transition-all duration-150 font-medium ${
                            formData.scheduledMinute === '00' 
                              ? 'text-white' 
                              : 'text-gray-900 hover:bg-gray-50'
                          }`}
                          style={formData.scheduledMinute === '00' ? { backgroundColor: '#2db5a5' } : {}}
                        >
                          00
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, scheduledMinute: '30' }))
                            setMinuteDropdownOpen(false)
                          }}
                          className={`w-full px-4 py-3 text-left transition-all duration-150 font-medium ${
                            formData.scheduledMinute === '30' 
                              ? 'text-white' 
                              : 'text-gray-900 hover:bg-gray-50'
                          }`}
                          style={formData.scheduledMinute === '30' ? { backgroundColor: '#2db5a5' } : {}}
                        >
                          30
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              友達と共有する際の参考日時です
            </p>
          </div>
          
          {/* 予算 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              予算（任意）
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.budget || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value ? parseInt(e.target.value) : undefined }))}
                className="w-full p-3 border border-gray-300 rounded-lg pr-12"
                placeholder="1人あたりの予算"
                min="0"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">円</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              交通費・食事代・入場料などの目安
            </p>
          </div>
          
          {/* ルート名 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ルート名（任意）
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="お気に入りの散歩コースなど"
            />
          </div>
          
          {/* メモ */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              メモ（任意）
            </label>
            <textarea
              value={formData.memo}
              onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg"
              rows={3}
              maxLength={140}
              placeholder="このルートについてのメモ"
            />
            <div className="text-right text-sm text-gray-500">
              {formData.memo.length}/140
            </div>
          </div>
        </div>
      </div>
      
      {/* フッターCTA */}
      <footer className="fixed bottom-0 w-full bg-white border-t p-4 z-50">
        <button
          onClick={handleCreateShareLink}
          disabled={formData.spots.length < 1}
          className={`w-full p-3 font-semibold rounded-lg transition-all ${
            formData.spots.length < 1 
              ? 'bg-gray-400 text-white cursor-not-allowed' 
              : 'text-white'
          }`}
          style={formData.spots.length >= 1 ? { backgroundColor: '#2db5a5' } : {}}
        >
          プランを確認
        </button>
      </footer>
      
      {/* スポット追加モーダル */}
      {isAddingSpot && newSpotCoords && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 max-w-sm w-full">
            <h3 className="font-semibold mb-4">スポットを追加</h3>
            <input
              type="text"
              value={newSpotName}
              onChange={(e) => setNewSpotName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
              placeholder="スポット名"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setIsAddingSpot(false)
                  setNewSpotName('')
                  setNewSpotCoords(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  if (newSpotName.trim()) {
                    addSpot(newSpotName, newSpotCoords[0], newSpotCoords[1])
                  }
                }}
                className="flex-1 px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: '#2db5a5' }}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 投稿モーダル */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">マップに投稿</h3>
            
            {/* プラン名表示・編集 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                投稿するプラン名
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="プラン名を入力"
                autoFocus
              />
              <p className="text-sm text-gray-500 mt-1">{formData.spots.length}スポット・{getDurationText()}</p>
            </div>
            
            {/* タグ選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                タグを選択（3つまで）
              </label>
              <div className="flex flex-wrap gap-2">
                {['グルメ', 'カフェ', '観光', '散歩', 'デート', 'ショッピング', 'アート', '歴史', '自然', '夜景', '写真', 'ファミリー'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    disabled={!publishForm.tags.includes(tag) && publishForm.tags.length >= 3}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      publishForm.tags.includes(tag)
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 disabled:opacity-50'
                    }`}
                    style={publishForm.tags.includes(tag) ? { backgroundColor: '#2db5a5' } : {}}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            {/* コメント入力 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                コメント（任意）
              </label>
              <textarea
                value={publishForm.comment}
                onChange={(e) => setPublishForm(prev => ({ ...prev, comment: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
                rows={3}
                maxLength={100}
                placeholder="このプランのおすすめポイントなど"
              />
              <p className="text-xs text-gray-500 mt-1">{publishForm.comment.length}/100文字</p>
            </div>
            
            {/* 注意事項 */}
            <div className="mb-6 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">投稿時の注意</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>投稿したプランは他のユーザーに公開されます</li>
                    <li>個人情報を含む内容は記載しないでください</li>
                    <li>不適切な内容は削除される場合があります</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* アクションボタン */}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowPublishModal(false)
                  setPublishForm({ tags: [], comment: '' })
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
                disabled={publishing}
              >
                キャンセル
              </button>
              <button
                onClick={handlePublishConfirm}
                disabled={publishing || publishForm.tags.length === 0}
                className="flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#2db5a5' }}
              >
                {publishing ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    投稿中...
                  </div>
                ) : '投稿する'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* トースト */}
      {toast && (
        <div
          className={`fixed top-20 left-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-gray-700' : 'bg-red-500'
          } text-white`}
        >
          <p>{toast.message}</p>
        </div>
      )}
    </div>
  )
}