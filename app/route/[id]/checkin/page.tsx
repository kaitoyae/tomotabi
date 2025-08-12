'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
}

type Route = {
  id: string
  title: string
  duration: '90m' | 'half' | 'day'
  spots: Spot[]
}

type VisitedSpot = {
  spotId: string
  photo?: string
  timestamp: Date
}

// OSRM関連の型定義
type OSRMRoute = {
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  distance: number
  duration: number
  legs: {
    steps: any[]
    summary: string
    weight: number
    duration: number
    distance: number
  }[]
}

type OSRMResponse = {
  routes: OSRMRoute[]
  waypoints: any[]
  code: string
}

type RouteAlternative = {
  id: string
  geometry: [number, number][]
  distance: number
  duration: number
  profile: 'foot' | 'driving'
  isSelected: boolean
}

type TransportMode = 'foot' | 'driving' | 'transit'

// DeviceOrientationEventの型拡張
interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number
}

// ダミールートデータ
const DUMMY_ROUTE: Route = {
  id: '1',
  title: '下町レトロ散歩',
  duration: '90m',
  spots: [
    { id: 's1', name: '浅草寺', lat: 35.7148, lng: 139.7967, comment: '東京最古のお寺' },
    { id: 's2', name: '仲見世通り', lat: 35.7112, lng: 139.7963, comment: '浅草寺に続く商店街' },
    { id: 's3', name: 'かっぱ橋道具街', lat: 35.7143, lng: 139.7888, comment: '調理器具の問屋街' },
    { id: 's4', name: '浅草花やしき', lat: 35.7156, lng: 139.7944, comment: '日本最古の遊園地' },
    { id: 's5', name: '浅草文化観光センター', lat: 35.7107, lng: 139.7953, comment: '展望テラスからの眺めが最高' }
  ]
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

// OSRM APIで複数ルートを取得（Google Maps風）
const fetchMultipleOSRMRoutes = async (
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  profile: 'foot' | 'driving'
): Promise<RouteAlternative[]> => {
  try {
    console.log(`🛣️ OSRM ${profile} リクエスト 開始:`, {
      from: { lng: fromLng, lat: fromLat },
      to: { lng: toLng, lat: toLat },
      profile
    })
    
    // 座標とプロファイルの妥当性チェック
    if (!isValidCoordinate(fromLng, fromLat) || !isValidCoordinate(toLng, toLat)) {
      console.error('❌ 無効な座標:', { fromLng, fromLat, toLng, toLat })
      return []
    }
    
    // OSRMは'foot'を'driving'として処理（公開サーバーの制限）
    let osrmProfile = profile
    if (profile === 'foot') {
      osrmProfile = 'driving'
      console.log('⚠️ OSRMのfootをdrivingで代用')
    }
    
    // サポートされたプロファイルの確認
    const supportedProfiles = ['driving', 'cycling']
    if (!supportedProfiles.includes(osrmProfile)) {
      console.error('❌ サポートされていないプロファイル:', osrmProfile)
      return []
    }
    
    // 複数ルートを取得（パブリックOSRM対応）
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full&alternatives=true`
    console.log('🔗 OSRM URL:', url)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒タイムアウト
    
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ OSRM ${profile} API エラー ${response.status}:`, {
        url,
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      return []
    }
    
    const data: OSRMResponse = await response.json()
    console.log(`✅ OSRM ${profile} レスポンス:`, data.routes?.length, 'routes')
    
    if (!data.routes || data.routes.length === 0) {
      console.warn('⚠️ ルートが見つかりませんでした')
      return []
    }
    
    // 複数ルートをRouteAlternative形式に変換
    return data.routes.map((route, index) => {
      console.log(`🛣️ ルート${index}変換:`, {
        points: route.geometry.coordinates.length,
        firstPoint: route.geometry.coordinates[0],
        lastPoint: route.geometry.coordinates[route.geometry.coordinates.length - 1],
        distance: route.distance,
        duration: route.duration
      })
      
      return {
        id: `${profile}-${index}`,
        geometry: route.geometry.coordinates,
        distance: route.distance,
        duration: route.duration,
        profile,
        isSelected: index === 0
      }
    })
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('⏱️ OSRM APIタイムアウト:', profile)
    } else {
      console.error('❌ OSRM fetch error:', error)
    }
    return []
  }
}

// 座標の妥当性チェック
const isValidCoordinate = (lng: number, lat: number): boolean => {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
}

// 単一ルート取得（後方互換性用）
const fetchOSRMRoute = async (
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  profile: 'foot' | 'driving'
): Promise<OSRMResponse | null> => {
  const routes = await fetchMultipleOSRMRoutes(fromLng, fromLat, toLng, toLat, profile)
  if (routes.length === 0) return null
  
  return {
    routes: [{
      geometry: { type: 'LineString', coordinates: routes[0].geometry },
      distance: routes[0].distance,
      duration: routes[0].duration,
      legs: []
    }],
    waypoints: [],
    code: 'Ok'
  }
}

// Googleマップで公共交通機関を開く
const openGoogleMapsTransit = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const url = `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=transit`
  window.open(url, '_blank')
}

export default function CheckInPage() {
  const params = useParams()
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const mapInitialized = useRef(false)
  const currentLocationMarker = useRef<maplibregl.Marker | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [route] = useState<Route>(DUMMY_ROUTE)
  const [currentSpotIndex, setCurrentSpotIndex] = useState(0)
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [visitedSpots, setVisitedSpots] = useState<VisitedSpot[]>([])
  const [isArrived, setIsArrived] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [transportMode, setTransportMode] = useState<TransportMode>('foot')
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null)
  const [osrmDistance, setOsrmDistance] = useState<number | null>(null)
  const [osrmDuration, setOsrmDuration] = useState<number | null>(null)
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [deviceHeading, setDeviceHeading] = useState<number>(0)
  const [locationAccuracy, setLocationAccuracy] = useState<number>(20)

  const currentSpot = route.spots[currentSpotIndex]
  const isLastSpot = currentSpotIndex === route.spots.length - 1

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

  // 位置情報の監視開始
  useEffect(() => {
    const FALLBACK_LOCATION: [number, number] = [139.7745, 35.6820] // 東京駅
    
    console.log('🌍 チェックイン画面 位置情報取得開始')
    
    if (!navigator.geolocation) {
      console.log('🚫 Geolocation未対応、フォールバック使用')
      setCurrentLocation(FALLBACK_LOCATION)
      setLocationAccuracy(50)
      return
    }

    // 高速位置情報取得（チェックイン画面用）
    const requestLocationPermission = async () => {
      console.log('📍 チェックイン 位置情報取得開始 - 環境情報:', {
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        hostname: window.location.hostname
      })
      
      // 許可状態のクイックチェック
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'denied') {
            console.log('⚠️ チェックイン 位置情報許可が拒否、フォールバック使用')
            setCurrentLocation(FALLBACK_LOCATION)
            setLocationAccuracy(100)
            return
          }
        } catch (error) {
          // 許可状態確認失敗は無視して継続
        }
      }

      // シンプルな位置情報取得（素早くフォールバック）
      try {
        console.log('📍 チェックイン 位置情報を取得試行...')
        
        const position = await Promise.race([
          // メインの位置取得
          new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: false,
                timeout: 3000, // 3秒の短いタイムアウト
                maximumAge: 300000 // 5分間キャッシュ
              }
            )
          }),
          // 2秒後にフォールバック
          new Promise<GeolocationPosition>((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('フォールバックタイマー'))
            }, 2000)
          })
        ])

        const { latitude, longitude, accuracy } = position.coords
        console.log('✅ チェックイン 位置情報取得成功:', { lat: latitude, lng: longitude, accuracy })
        setCurrentLocation([longitude, latitude])
        setLocationAccuracy(accuracy || 50)
        
        // 成功したら継続監視開始
        startLocationWatch(false) // パフォーマンス優先で低頻度
        return
      } catch (error: any) {
        console.warn('⚠️ チェックイン 位置情報取得失敗:', error.message)
        // 即座フォールバックへ
      }

      // フォールバック位置を使用（パフォーマンス優先）
      console.log('🔄 チェックイン フォールバック位置を使用:', FALLBACK_LOCATION)
      setCurrentLocation(FALLBACK_LOCATION)
      setLocationAccuracy(100) // フォールバックは低精度
    }

    // 位置情報の継続監視（ナビ用）
    const startLocationWatch = (highAccuracy: boolean) => {
      console.log('📍 チェックイン 位置情報継続監視開始 (高精度:', highAccuracy + ')')
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          console.log('📍 チェックイン 位置情報更新:', { lat: latitude, lng: longitude, accuracy })
          setCurrentLocation([longitude, latitude])
          setLocationAccuracy(accuracy || (highAccuracy ? 20 : 50))
        },
        (error) => {
          console.warn('⚠️ チェックイン 位置監視エラー:', error.message)
          // 監視エラーでも初回取得した位置は維持
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 20000 : 15000,
          maximumAge: highAccuracy ? 60000 : 300000 // 高精度時1分、低精度時5分
        }
      )
      
      setWatchId(watchId)
    }

    requestLocationPermission()

    return () => {
      if (watchId) {
        console.log('📍 チェックイン 位置情報監視停止')
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  // 方位センサーの監視開始
  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const evt = event as DeviceOrientationEventWithWebkit
      
      console.log('🧭 チェックイン画面 方位センサー受信:', {
        alpha: evt.alpha,
        webkitCompassHeading: evt.webkitCompassHeading,
        absolute: evt.absolute
      })
      
      if (evt.alpha !== null || evt.webkitCompassHeading !== undefined) {
        // iOSの場合はwebkitCompassHeading、Androidの場合は360 - alphaを使用
        let heading: number
        if (evt.webkitCompassHeading !== undefined) {
          heading = evt.webkitCompassHeading
          console.log('🧭 チェックイン iOS方位:', heading)
        } else if (evt.alpha !== null) {
          heading = 360 - evt.alpha
          console.log('🧭 チェックイン Android方位:', heading)
        } else {
          return
        }
        
        setDeviceHeading(heading)
        console.log('🧭 チェックイン画面 方位更新:', heading.toFixed(1) + '°')
      }
    }

    // 方位センサーの許可とイベント登録
    const setupOrientation = async () => {
      console.log('🧭 チェックイン画面 方位センサー初期化開始')
      
      // ブラウザ環境でのみ実行
      if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
        console.log('🚫 DeviceOrientationEvent未対応環境')
        return
      }
      
      // iOS13以降での許可確認
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        console.log('🧭 チェックイン iOS方位センサー許可要求')
        try {
          const response = await (DeviceOrientationEvent as any).requestPermission()
          console.log('🧭 チェックイン 許可結果:', response)
          
          if (response === 'granted') {
            console.log('🧭 チェックイン 方位センサー許可OK - イベント登録')
            window.addEventListener('deviceorientation', handleDeviceOrientation, true)
          } else {
            console.warn('⚠️ チェックイン 方位センサーの許可が拒否されました')
          }
        } catch (error) {
          console.error('❌ チェックイン 方位センサー許可エラー:', error)
        }
      } else {
        // Chrome、Android等 - Chrome 83以降では許可が必要
        console.log('🧭 チェックイン Chrome/Android - Device Orientation API許可確認中')
        
        // Chrome向けの許可要求実装
        const requestChromePermission = async () => {
          // Chrome 88+では navigator.permissions でDevice Orientation許可確認
          if ('permissions' in navigator) {
            try {
              // @ts-ignore - Chrome実験的API
              const permission = await navigator.permissions.query({ name: 'accelerometer' })
              console.log('🧭 チェックイン Chrome加速度センサー許可状態:', permission.state)
              
              if (permission.state === 'denied') {
                console.log('⚠️ チェックイン Chrome Device Orientation許可が拒否されています')
                return false
              }
            } catch (error) {
              console.log('🧭 チェックイン Chrome許可状態確認不可、直接試行します')
            }
          }
          
          // 直接イベントリスナーを登録してテスト
          let orientationDataReceived = false
          
          const testHandler = (event: DeviceOrientationEvent) => {
            orientationDataReceived = true
            console.log('🧭 チェックイン Chrome方位データ受信テスト成功:', event.alpha)
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
            console.log('✅ チェックイン Chrome Device Orientation API 利用可能 - イベント登録')
            window.addEventListener('deviceorientation', handleDeviceOrientation, true)
            window.addEventListener('deviceorientationabsolute', handleDeviceOrientation, true)
          } else {
            console.log('⚠️ チェックイン Chrome Device Orientation API 利用不可')
            // ナビ画面では方位センサーが重要なので、フォールバック戦略を使用
            console.log('📍 チェックイン ナビでは方位センサーなしで続行')
          }
        } catch (error) {
          console.error('❌ チェックイン Chrome Device Orientation API 設定エラー:', error)
        }
      }
    }

    setupOrientation()

    return () => {
      console.log('🧭 チェックイン 方位センサークリーンアップ')
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true)
    }
  }, [])

  // 地図の初期化（初回のみ）
  useEffect(() => {
    if (!mapContainer.current || !currentLocation || !currentSpot) return

    // 地図の初期化は一度だけ
    if (map.current || mapInitialized.current) return
    
    mapInitialized.current = true

    map.current = new maplibregl.Map({
      container: mapContainer.current,
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
      center: currentLocation,
      zoom: 15
    })

    // 地図のロード完了を待つ
    map.current.on('load', () => {
      if (!map.current || !currentSpot) return
      
      console.log('🗺️ 地図ロード完了 - マーカーとルート設定開始')
      
      // 目的地マーカー
      new maplibregl.Marker({ color: '#EF4444' })
        .setLngLat([currentSpot.lng, currentSpot.lat])
        .addTo(map.current!)

      // 現在地マーカー（Google Map風）
      const markerElement = createCurrentLocationMarker()
      currentLocationMarker.current = new maplibregl.Marker({ 
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat(currentLocation)
        .addTo(map.current!)

      // 複数ルートの描画準備
      setupMultipleRouteLayers(map.current!, currentLocation, currentSpot)
    })

    // エラーハンドリング
    map.current.on('error', (e) => {
      console.error('MapLibre error:', e)
      showToast('地図の読み込みに失敗しました')
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
        mapInitialized.current = false
      }
    }
  }, [currentLocation, currentSpot]) // 現在地と目的地が設定されたら初期化

  // 現在地マーカーの更新（位置と方位）
  useEffect(() => {
    if (!map.current || !currentLocation || !currentLocationMarker.current) return

    currentLocationMarker.current.setLngLat(currentLocation)
    
    // マーカー要素を取得して方位を更新
    const markerElement = currentLocationMarker.current.getElement()
    if (markerElement) {
      const directionCone = markerElement.querySelector('#direction-cone') as HTMLElement
      if (directionCone) {
        directionCone.style.transform = `translateX(-50%) rotate(${deviceHeading}deg)`
        directionCone.style.transformOrigin = '50% 100%'
      }
      
      // 精度に応じて精度円のサイズを調整
      const accuracyCircle = markerElement.querySelector('#accuracy-circle') as HTMLElement
      if (accuracyCircle && map.current) {
        const zoom = map.current.getZoom()
        const metersPerPixel = 156543.03392 * Math.cos(currentLocation[1] * Math.PI / 180) / Math.pow(2, zoom)
        const pixelRadius = Math.min(locationAccuracy / metersPerPixel, 100)
        const size = Math.max(60, pixelRadius * 2)
        
        accuracyCircle.style.width = `${size}px`
        accuracyCircle.style.height = `${size}px`
      }
    }
  }, [currentLocation, deviceHeading, locationAccuracy])

  // ルートデータの更新
  useEffect(() => {
    if (!map.current || routeAlternatives.length === 0) return

    // 地図がロード済みか確認
    if (map.current.loaded()) {
      console.log('🗺️ ルートデータを地図に反映')
      updateMultipleRouteLayers(map.current, routeAlternatives, selectedRouteId)
    } else {
      // ロード完了を待って更新
      map.current.once('load', () => {
        if (map.current) {
          console.log('🗺️ 地図ロード後にルートデータを反映')
          updateMultipleRouteLayers(map.current, routeAlternatives, selectedRouteId)
        }
      })
    }
  }, [routeAlternatives, selectedRouteId])

  // OSRM複数ルート取得（Google Maps風）
  useEffect(() => {
    if (!currentLocation || !currentSpot) {
      console.log('🚫 ルート取得スキップ:', { currentLocation, currentSpot })
      return
    }

    const getMultipleRoutes = async () => {
      console.log('🛣️ 複数ルート取得開始')
      setRouteLoading(true)
      
      try {
        // 徒歩ルート取得（OSRMは内部でdrivingに変換される）
        console.log('🚶 徒歩ルート取得試行...')
        const footRoutes = await fetchMultipleOSRMRoutes(
          currentLocation[0],
          currentLocation[1],
          currentSpot.lng,
          currentSpot.lat,
          'foot'
        )
        
        console.log('🚗 車ルート取得試行...')
        const drivingRoutes = await fetchMultipleOSRMRoutes(
          currentLocation[0],
          currentLocation[1],
          currentSpot.lng,
          currentSpot.lat,
          'driving'
        )
        
        // 徒歩ルートの時間を調整（車の3倍と仮定）
        const adjustedFootRoutes = footRoutes.map(route => ({
          ...route,
          duration: route.duration * 3,
          profile: 'foot' as const
        }))
        
        // 取得結果をログ出力
        console.log('📊 ルート取得結果:', {
          foot: adjustedFootRoutes.length,
          driving: drivingRoutes.length
        })
        
        // 有効なルートのみを結合（最短3本まで）
        const allRoutes = [...adjustedFootRoutes, ...drivingRoutes]
          .filter(route => {
            const isValid = route.duration > 0 && route.distance > 0 && route.geometry.length > 0
            if (!isValid) {
              console.warn('⚠️ 無効なルートをフィルタリング:', route)
            }
            return isValid
          })
          .sort((a, b) => a.duration - b.duration)
          .slice(0, 3)
          .map((route, index) => ({ ...route, isSelected: index === 0 }))
        
        console.log('✅ 取得したルート数:', allRoutes.length)
        
        if (allRoutes.length > 0) {
          setRouteAlternatives(allRoutes)
          setSelectedRouteId(allRoutes[0].id)
          
          // 選択されたルートの情報を設定
          const selectedRoute = allRoutes[0]
          setRouteGeometry(selectedRoute.geometry)
          setOsrmDistance(Math.round(selectedRoute.distance))
          setOsrmDuration(Math.round(selectedRoute.duration / 60))
          
          console.log('📊 選択ルート:', {
            profile: selectedRoute.profile,
            distance: Math.round(selectedRoute.distance),
            duration: Math.round(selectedRoute.duration / 60)
          })
        } else {
          console.warn('⚠️ 利用可能なルートがありません')
          console.log('🔄 直線ルートにフォールバック')
          
          // フォールバック: 直線距離での表示
          const directDistance = haversineDistance(
            currentLocation[1], currentLocation[0],
            currentSpot.lat, currentSpot.lng
          )
          const estimatedWalkTime = Math.round(directDistance / 75) // 4.5km/h = 75m/分
          
          setRouteAlternatives([])
          setSelectedRouteId(null)
          setRouteGeometry([[currentLocation[0], currentLocation[1]], [currentSpot.lng, currentSpot.lat]])
          setOsrmDistance(Math.round(directDistance))
          setOsrmDuration(estimatedWalkTime)
          
          showToast('直線距離で表示しています')
        }
      } catch (error) {
        console.error('❌ ルート取得エラー:', error)
        showToast('ルート取得中にエラーが発生しました')
      }
      
      setRouteLoading(false)
    }

    getMultipleRoutes()
  }, [currentLocation, currentSpot]) // transportMode削除（自動で両方取得するため）

  // 距離計算と到着判定
  useEffect(() => {
    if (!currentLocation || !currentSpot) return

    const dist = haversineDistance(
      currentLocation[1],
      currentLocation[0],
      currentSpot.lat,
      currentSpot.lng
    )

    setDistance(Math.round(dist))

    // 30m以内で到着
    if (dist <= 30 && !isArrived) {
      setIsArrived(true)
      showToast(`${currentSpot.name}に到着！`)
      
      // 3秒後に自動で次へ（写真撮影しない場合）
      setTimeout(() => {
        if (!photoPreview) {
          handleNext()
        }
      }, 3000)
    }
  }, [currentLocation, currentSpot, isArrived, photoPreview])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleBack = () => {
    console.log('Back button clicked')
    router.back()
  }

  // 複数ルートのレイヤーセットアップ
  const setupMultipleRouteLayers = (map: maplibregl.Map, currentLocation: [number, number], targetSpot: Spot) => {
    // 初期直線ルート
    map.addSource('route-main', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [currentLocation, [targetSpot.lng, targetSpot.lat]]
        }
      }
    })
    
    map.addSource('route-alt-1', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      }
    })
    
    map.addSource('route-alt-2', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      }
    })
    
    // メインルート（太線、青）
    map.addLayer({
      id: 'route-main',
      type: 'line',
      source: 'route-main',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#1976D2',
        'line-width': 6,
        'line-opacity': 0.9
      }
    })
    
    // 代替ルート1（細線、グレー）
    map.addLayer({
      id: 'route-alt-1',
      type: 'line',
      source: 'route-alt-1',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#616161',
        'line-width': 4,
        'line-opacity': 0.7,
        'line-dasharray': [2, 2]
      }
    })
    
    // 代替ルート2（細線、グレー）
    map.addLayer({
      id: 'route-alt-2',
      type: 'line',
      source: 'route-alt-2',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#616161',
        'line-width': 4,
        'line-opacity': 0.7,
        'line-dasharray': [2, 2]
      }
    })
    
    // ルートクリックイベントを追加
    map.on('click', 'route-alt-1', (e) => {
      e.preventDefault()
      handleRouteSwitch('route-alt-1')
    })
    
    map.on('click', 'route-alt-2', (e) => {
      e.preventDefault()
      handleRouteSwitch('route-alt-2')
    })
    
    // ホバーエフェクト
    map.on('mouseenter', 'route-alt-1', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'route-alt-1', () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('mouseenter', 'route-alt-2', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'route-alt-2', () => {
      map.getCanvas().style.cursor = ''
    })
  }
  
  // 複数ルートの更新
  const updateMultipleRouteLayers = (map: maplibregl.Map, routes: RouteAlternative[], selectedId: string | null) => {
    if (!map || routes.length === 0) {
      console.log('⚠️ ルート更新スキップ:', { mapExists: !!map, routeCount: routes.length })
      return
    }
    
    console.log('🗺️ ルートレイヤー更新:', { routeCount: routes.length, selectedId })
    
    const sourceIds = ['route-main', 'route-alt-1', 'route-alt-2']
    let bounds: maplibregl.LngLatBounds | null = null
    
    // ソースとレイヤーの存在確認
    const sourcesExist = sourceIds.every(id => map.getSource(id))
    if (!sourcesExist) {
      console.log('⚠️ ルートソースが未作成、スキップ')
      return
    }
    
    routes.forEach((route, index) => {
      if (index >= sourceIds.length) return
      
      const sourceId = sourceIds[index]
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
      
      if (source && route.geometry.length > 0) {
        console.log(`📍 ルート${index}更新:`, {
          id: route.id,
          points: route.geometry.length,
          distance: Math.round(route.distance),
          profile: route.profile
        })
        
        try {
          source.setData({
            type: 'Feature',
            properties: {
              routeId: route.id,
              duration: route.duration,
              distance: route.distance,
              profile: route.profile
            },
            geometry: {
              type: 'LineString',
              coordinates: route.geometry
            }
          })
          
          // 選択されたルートの境界を計算
          if (route.id === selectedId) {
            bounds = new maplibregl.LngLatBounds()
            route.geometry.forEach(coord => {
              bounds!.extend(coord as [number, number])
            })
          }
          
          // 選択状態に応じてスタイル変更
          const isSelected = route.id === selectedId
          const layerId = sourceId
          
          // レイヤーの存在確認
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, 'line-color', isSelected ? '#1976D2' : '#616161')
            map.setPaintProperty(layerId, 'line-width', isSelected ? 6 : 4)
            map.setPaintProperty(layerId, 'line-opacity', isSelected ? 0.9 : 0.7)
            
            // 選択されていないルートは破線にする
            if (isSelected) {
              map.setPaintProperty(layerId, 'line-dasharray', [1, 0])
            } else {
              map.setPaintProperty(layerId, 'line-dasharray', [2, 2])
            }
          }
        } catch (error) {
          console.error(`❌ ルート${index}更新エラー:`, error)
        }
      }
    })
    
    // 余ったソースを空にする
    for (let i = routes.length; i < sourceIds.length; i++) {
      const source = map.getSource(sourceIds[i]) as maplibregl.GeoJSONSource
      if (source) {
        try {
          source.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          })
        } catch (error) {
          console.error(`❌ ソース${i}クリアエラー:`, error)
        }
      }
    }
    
    // 選択されたルートに合わせて地図の境界を調整（初回のみ）
    if (bounds !== null && currentLocation && currentSpot && routes.length > 0) {
      // 現在地と目的地も境界に含める
      const lngLatBounds = bounds as maplibregl.LngLatBounds
      lngLatBounds.extend(currentLocation as [number, number])
      lngLatBounds.extend([currentSpot.lng, currentSpot.lat] as [number, number])
      
      // パディングを追加して地図を調整
      setTimeout(() => {
        if (map && map.loaded()) {
          map.fitBounds(lngLatBounds, {
            padding: { top: 200, bottom: 150, left: 50, right: 50 },
            duration: 1000,
            maxZoom: 16
          })
        }
      }, 100)
    }
  }
  
  // ルート切替ハンドラー
  const handleRouteSwitch = (clickedLayerId: string) => {
    const routeIndex = {
      'route-main': 0,
      'route-alt-1': 1,
      'route-alt-2': 2
    }[clickedLayerId]
    
    if (routeIndex === undefined || routeIndex >= routeAlternatives.length) return
    
    const newSelectedRoute = routeAlternatives[routeIndex]
    
    // 選択状態更新
    setSelectedRouteId(newSelectedRoute.id)
    setRouteGeometry(newSelectedRoute.geometry)
    setOsrmDistance(Math.round(newSelectedRoute.distance))
    setOsrmDuration(Math.round(newSelectedRoute.duration / 60))
    
    // フィードバック削除（トーストは表示しない）
    // const profileText = newSelectedRoute.profile === 'foot' ? '徒歩' : '車'
    // const timeText = Math.round(newSelectedRoute.duration / 60)
    // showToast(`${profileText}ルートに切り替えました (${timeText}分)`)
  }

  const handleSkip = () => {
    console.log('Skip button clicked')
    handleNext()
  }

  // 移動手段切替ハンドラー
  const handleTransportModeChange = (mode: TransportMode) => {
    setTransportMode(mode)
    console.log('Transport mode changed to:', mode)
  }

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    }
  }

  const handleNext = () => {
    // 訪問記録を保存
    const visited: VisitedSpot = {
      spotId: currentSpot.id,
      photo: photoPreview || undefined,
      timestamp: new Date()
    }
    setVisitedSpots([...visitedSpots, visited])

    if (isLastSpot) {
      // 完了処理
      console.log('complete', [...visitedSpots, visited])
      router.push(`/route/complete?id=${route.id}`)
    } else {
      // 次のスポットへ
      setCurrentSpotIndex(currentSpotIndex + 1)
      setIsArrived(false)
      setPhotoPreview(null)
      
      // 次のスポットのマーカーを更新
      if (map.current && map.current.loaded()) {
        const nextSpot = route.spots[currentSpotIndex + 1]
        
        // 既存のマーカーを削除
        const markers = document.querySelectorAll('.maplibregl-marker')
        markers.forEach(marker => {
          if (marker.querySelector('svg')?.getAttribute('fill') === '#EF4444') {
            marker.remove()
          }
        })
        
        // 新しい目的地マーカー
        new maplibregl.Marker({ color: '#EF4444' })
          .setLngLat([nextSpot.lng, nextSpot.lat])
          .addTo(map.current)
      }
    }
  }

  const eta = osrmDuration || (distance ? Math.round(distance / 75) : 0) // OSRMまたは4.5km/h = 75m/分
  const displayDistance = osrmDistance || distance

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-50 p-4 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="text-gray-700"
          aria-label="戻る"
        >
          ←
        </button>
        <h1 className="font-semibold">
          {route.title} ({currentSpotIndex + 1}/{route.spots.length})
        </h1>
        <button
          onClick={handleSkip}
          className="text-sm"
          style={{ color: '#2db5a5' }}
          aria-label="スキップ"
        >
          スキップ
        </button>
      </header>

      {/* ETAバー - Google Maps風の複数ルート情報 */}
      <div className="fixed top-16 w-full text-white p-3 z-40" style={{ backgroundColor: '#1976D2' }}>
        <div className="text-center">
          {routeLoading ? (
            <p className="text-sm">ルートを計算中...</p>
          ) : (
            <div>
              <p className="text-sm">最短ルート - {selectedRouteId ? routeAlternatives.find(r => r.id === selectedRouteId)?.profile === 'foot' ? '徒歩' : '車' : ''}</p>
              <p className="font-semibold">
                {displayDistance !== null ? `${Math.round(displayDistance/1000 * 10)/10}km / ${eta}分` : '計算中...'}
              </p>
              {routeAlternatives.length > 1 && (
                <p className="text-xs opacity-90 mt-1">
                  他{routeAlternatives.length - 1}件のルート - タップで切り替え
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ルート選択パネル - Google Maps風 */}
      {routeAlternatives.length > 1 && (
        <div className="fixed top-32 w-full bg-white border-b border-gray-200 p-2 z-40 max-h-24 overflow-y-auto">
          <div className="space-y-1">
            {routeAlternatives.slice(0, 3).map((route, index) => {
              const isSelected = route.id === selectedRouteId
              const profileIcon = route.profile === 'foot' ? '🚶' : '🚗'
              const timeText = Math.round(route.duration / 60)
              const distanceText = Math.round(route.distance / 1000 * 10) / 10
              
              return (
                <button
                  key={route.id}
                  onClick={() => handleRouteSwitch(`route-${index === 0 ? 'main' : `alt-${index}`}`)}
                  className={`w-full text-left p-2 rounded transition-colors ${
                    isSelected 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{profileIcon}</span>
                      <div>
                        <div className={`text-sm font-medium ${
                          isSelected ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                          {route.profile === 'foot' ? '徒歩' : '車でのルート'} ・ {timeText}分
                        </div>
                        <div className={`text-xs ${
                          isSelected ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {distanceText}km
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 地図 */}
      <div className={`flex-1 ${routeAlternatives.length > 1 ? 'pt-56' : 'pt-40'}`}>
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* 現在のスポット情報 */}
      <div className="bg-white border-t p-4">
        <h2 className="text-lg font-semibold mb-2">{currentSpot.name}</h2>
        {currentSpot.comment && (
          <p className="text-sm text-gray-600 mb-3">{currentSpot.comment}</p>
        )}

        {/* 写真撮影エリア */}
        {isArrived && (
          <div className="mb-4">
            {!photoPreview ? (
              <div className="flex justify-center">
                <label className="px-4 py-2 bg-gray-200 rounded-lg cursor-pointer">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                  <span className="flex items-center text-gray-700">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mr-1">
                      <path d="M12 15.2l3.2-2.9c.3-.3.8-.3 1.1 0 .3.3.3.8 0 1.1L12.6 17c-.3.3-.8.3-1.1 0l-3.8-3.6c-.3-.3-.3-.8 0-1.1.3-.3.8-.3 1.1 0L12 15.2zM21 5H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H3V7h18v10z" fill="currentColor"/>
                      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M16 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    写真を撮る
                  </span>
                </label>
              </div>
            ) : (
              <div className="text-center">
                <img
                  src={photoPreview}
                  alt="撮影した写真"
                  className="w-32 h-32 object-cover rounded-lg mx-auto mb-2"
                />
                <button
                  onClick={() => setPhotoPreview(null)}
                  className="text-sm text-red-500"
                >
                  削除
                </button>
              </div>
            )}
          </div>
        )}

        {/* 次へボタン */}
        <button
          onClick={handleNext}
          disabled={!isArrived && distance !== null && distance > 30}
          className="w-full p-4 text-white font-semibold rounded-lg disabled:bg-gray-400 transition-colors"
          style={{ backgroundColor: '#2db5a5' }}
        >
          {isLastSpot ? '完了' : '次へ'}
        </button>
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed top-40 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}