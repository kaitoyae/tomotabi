'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Route, Spot, Segment, SegmentMode, getRoute, generateSegments, updateSegmentMode } from '../../lib/mock-api'

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

// ダミーデータ（実際はルートIDから取得）
const DUMMY_ROUTE: Route = {
  id: '1',
  title: '下町レトロ散歩',
  duration: '90m',
  tags: ['歴史', 'グルメ', '商店街'],
  author: '田中太郎',
  cover: '/route1-cover.jpg',
  spots: [
    { id: 's1', name: '浅草寺', lat: 35.7148, lng: 139.7967, photo: '/spot1.jpg', comment: '東京最古のお寺。雷門が有名' },
    { id: 's2', name: '仲見世通り', lat: 35.7112, lng: 139.7963, comment: '浅草寺に続く商店街' },
    { id: 's3', name: 'かっぱ橋道具街', lat: 35.7143, lng: 139.7888, photo: '/spot3.jpg' },
    { id: 's4', name: '浅草花やしき', lat: 35.7156, lng: 139.7944, comment: '日本最古の遊園地' },
    { id: 's5', name: '浅草文化観光センター', lat: 35.7107, lng: 139.7953, photo: '/spot5.jpg', comment: '展望テラスからの眺めが最高' }
  ]
}

export default function RouteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  
  // 集合・解散スポットを判定するヘルパー関数
  const getStartEndIds = (spots: Spot[]) => {
    if (spots.length === 0) return { startId: null, endId: null }
    if (spots.length === 1) return { startId: spots[0].id, endId: null }
    return { startId: spots[0].id, endId: spots[spots.length - 1].id }
  }

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const routeId = params.id as string
        const data = await getRoute(routeId)
        setRoute(data)
        setLoading(false)
      } catch (err) {
        // エラー時はfallbackとしてダミーデータを使用
        const fallbackRoute = { ...DUMMY_ROUTE, id: params.id as string }
        setRoute(fallbackRoute)
        setLoading(false)
      }
    }

    if (params.id) {
      fetchRoute()
    }
  }, [params.id])

  // ルートが変更されたらセグメントを生成
  useEffect(() => {
    if (route && route.spots.length >= 2) {
      if (route.segments) {
        setSegments(route.segments)
      } else {
        generateSegments(route.spots, 'walking').then(setSegments)
      }
    }
  }, [route])

  const startRoute = (routeId: string) => {
    router.push(`/route/${routeId}/checkin`)
  }

  // 所要時間を適切な単位で表示するヘルパー関数
  const formatDurationText = (minutes: number): string => {
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

  const getDurationText = (duration: string) => {
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
    
    const minutes = getDurationInMinutes(duration)
    return formatDurationText(minutes)
  }

  // セグメント用ヘルパー関数
  const formatDistance = (meters?: number) => {
    if (!meters) return '---'
    if (meters < 1000) return `${Math.round(meters)}m`
    return `${(meters / 1000).toFixed(1)}km`
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '---'
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}分`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
  }

  const getModeIcon = (mode: SegmentMode) => {
    switch (mode) {
      case 'walking':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case 'driving':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        )
      case 'transit':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="6" width="16" height="12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} rx="2" />
            <circle cx="8" cy="16" r="1" fill="currentColor" />
            <circle cx="16" cy="16" r="1" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h16M4 14h16" />
          </svg>
        )
    }
  }

  const handleSegmentModeChange = async (segmentId: string, newMode: SegmentMode) => {
    const segmentIndex = segments.findIndex(s => s.id === segmentId)
    if (segmentIndex === -1) return

    const segment = segments[segmentIndex]
    const fromSpot = route!.spots.find(s => s.id === segment.fromSpotId)
    const toSpot = route!.spots.find(s => s.id === segment.toSpotId)
    
    if (!fromSpot || !toSpot) return

    const updatedSegment = await updateSegmentMode(segment, fromSpot, toSpot, newMode)
    
    const newSegments = [...segments]
    newSegments[segmentIndex] = updatedSegment
    setSegments(newSegments)
  }

  const openGoogleMapsTransit = (fromSpot: Spot, toSpot: Spot) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${fromSpot.lat},${fromSpot.lng}&destination=${toSpot.lat},${toSpot.lng}&travelmode=transit`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">ルート情報を読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-100 text-red-600 rounded"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  if (!route) return null

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-50 p-4 flex items-center">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center"
          aria-label="戻る"
        >
          ←
        </button>
        <h1 className="flex-1 text-center font-semibold pr-8">ルート詳細</h1>
      </header>

      {/* メインコンテンツ */}
      <main className="pt-16">
        {/* カバー写真とタイトル */}
        <div className="relative">
          <div className="w-full h-64 bg-gray-300">
            <img
              src={route.cover}
              alt={route.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <h2 className="text-white text-2xl font-bold p-6">{route.title}</h2>
          </div>
        </div>

        {/* ルート情報カード */}
        <div className="bg-white mx-4 -mt-8 relative rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">所要時間</span>
            <span className="font-semibold">{getDurationText(route.duration)}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">作成者</span>
            <span className="font-semibold">{route.author}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {route.tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* スポット一覧 */}
        <div className="px-4 mt-6">
          <h3 className="text-lg font-semibold mb-4">スポット一覧</h3>
          <div className="space-y-4">
            {route.spots.map((spot, index) => {
              const { startId, endId } = getStartEndIds(route.spots)
              const isStart = spot.id === startId
              const isEnd = spot.id === endId
              const isDayBreak = route.dayBreaks?.includes(index)
              
              return (
                <React.Fragment key={`${spot.id}-${index}`}>
                  <div className="bg-white rounded-lg shadow flex overflow-hidden">
                    <div className="w-24 h-24 bg-gray-300 flex-shrink-0">
                      {spot.photo && (
                        <img
                          src={spot.photo}
                          alt={spot.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      {!spot.photo && (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          [写真]
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-4">
                      <div className="flex items-start">
                        <span 
                          className="font-semibold mr-2" 
                          style={{ color: '#2db5a5' }}
                          aria-label={`${index + 1}番${isStart ? '（集合）' : isEnd ? '（解散）' : ''}`}
                        >
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <h4 className="font-semibold">{spot.name}</h4>
                            {spot.isLodging && (
                              <div className="flex items-center px-2 py-0.5 bg-blue-50 rounded-full">
                                <AccommodationIcon className="w-3 h-3 mr-1 text-blue-600" />
                                <span className="text-[11px] text-blue-600">宿泊</span>
                              </div>
                            )}
                            {isStart && (
                              <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                集合
                              </span>
                            )}
                            {isEnd && (
                              <span className="px-2 py-0.5 text-[11px] rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                解散
                              </span>
                            )}
                          </div>
                          {spot.comment && (
                            <p className="text-sm text-gray-600 mt-1">{spot.comment}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                
                {/* 区切りカード */}
                {isDayBreak && (
                  <div className="my-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="flex items-center justify-center">
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3" style={{ backgroundColor: '#2db5a5' }}>
                          <span className="text-white font-bold text-xs">{route.dayBreaks!.indexOf(index) + 2}</span>
                        </div>
                        <span className="font-medium">
                          ─── {route.dayBreaks!.indexOf(index) + 1}日目おわり / {route.dayBreaks!.indexOf(index) + 2}日目 ───
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 移動カード */}
                {index < route.spots.length - 1 && segments[index] && (
                  <div className="bg-gray-50 rounded-lg p-4 mx-2 border border-gray-200">
                    <div className="mb-3">
                      <div className="flex items-center justify-center space-x-1 bg-white rounded-lg p-2 border">
                        {(['walking', 'driving', 'transit'] as SegmentMode[]).map((mode) => {
                          const isActive = segments[index].mode === mode
                          const getModeName = (m: SegmentMode) => {
                            switch (m) {
                              case 'walking': return '徒歩'
                              case 'driving': return '車'
                              case 'transit': return '電車'
                            }
                          }
                          
                          return (
                            <button
                              key={mode}
                              onClick={() => handleSegmentModeChange(segments[index].id, mode)}
                              className={`flex-1 flex flex-col items-center space-y-2 py-3 px-2 rounded-md transition-all ${
                                isActive 
                                  ? 'text-white shadow-md' 
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                              style={isActive ? { backgroundColor: '#2db5a5' } : {}}
                            >
                              <span>
                                {getModeIcon(mode)}
                              </span>
                              <span className="text-sm font-medium">
                                {getModeName(mode)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    
                    <div>
                      {segments[index].mode === 'transit' ? (
                        <button
                          onClick={() => {
                            const fromSpot = route.spots[index]
                            const toSpot = route.spots[index + 1]
                            openGoogleMapsTransit(fromSpot, toSpot)
                          }}
                          className="text-blue-500 underline text-sm"
                        >
                          Googleマップで経路を確認
                        </button>
                      ) : (
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>{formatDistance(segments[index].distanceM)}</span>
                          <span>{formatDuration(segments[index].durationS)}</span>
                        </div>
                      )}
                    </div>
                    
                    {segments[index].osrm && segments[index].osrm!.routes.length > 1 && (
                      <div className="mt-2 text-xs text-gray-500">
                        代替ルート{segments[index].osrm!.routes.length}件
                      </div>
                    )}
                  </div>
                )}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </main>

      {/* 固定フッター */}
      <footer className="fixed bottom-0 w-full bg-white border-t p-4 z-40">
        <button
          onClick={() => startRoute(route.id)}
          className="w-full p-4 text-white font-semibold rounded-lg transition-colors"
          style={{ backgroundColor: '#2db5a5' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
          aria-label="ルートを開始"
        >
          開始
        </button>
      </footer>
    </div>
  )
}