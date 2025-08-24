'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Segment, SegmentMode, generateSegments, updateSegmentMode } from '../../lib/mock-api'

// 型定義
type Spot = {
  id: string
  name: string
  lat: number
  lng: number
  photo?: string
  comment?: string
  stayTime: number // 滞在時間（分）
  isLodging?: boolean // 宿泊施設フラグ
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

export default function PlanPreviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [planData, setPlanData] = useState<FormData | null>(null)
  const [creating, setCreating] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [defaultMode, setDefaultMode] = useState<SegmentMode>('walking')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishForm, setPublishForm] = useState({
    tags: [] as string[],
    comment: ''
  })
  const [publishing, setPublishing] = useState(false)
  
  // 集合・解散スポットを判定するヘルパー関数
  const getStartEndIds = (spots: Spot[]) => {
    if (spots.length === 0) return { startId: null, endId: null }
    if (spots.length === 1) return { startId: spots[0].id, endId: null }
    return { startId: spots[0].id, endId: spots[spots.length - 1].id }
  }

  // URLパラメータからプランデータを取得
  useEffect(() => {
    try {
      // sessionStorageからプランデータを取得
      const savedPlan = sessionStorage.getItem('previewPlan')
      if (savedPlan) {
        const data = JSON.parse(savedPlan)
        setPlanData(data)
      } else {
        // データがない場合はプラン作成画面に戻る
        router.push('/plan/create')
        return
      }
    } catch (error) {
      console.error('Plan data parse error:', error)
      router.push('/plan/create')
      return
    } finally {
      setLoading(false)
    }
  }, [router])

  // プランデータが変更されたらセグメントを生成
  useEffect(() => {
    if (planData && planData.spots.length >= 2) {
      // Spotを共通のSpot型に変換
      const commonSpots = planData.spots.map(spot => ({
        id: spot.id,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        photo: spot.photo,
        comment: spot.comment
      }))
      generateSegments(commonSpots, defaultMode).then(setSegments)
    } else {
      setSegments([])
    }
  }, [planData, defaultMode])

  const getDurationText = (spots: Spot[]) => {
    const minutes = calculateTotalDuration(spots)
    if (minutes < 90) return `${minutes}分`
    if (minutes < 300) return '半日'
    return '1日'
  }

  const handleCreateShareLink = async () => {
    if (!planData || planData.spots.length < 1) return
    
    setCreating(true)
    try {
      // プランIDを生成
      const planId = Date.now().toString()
      const shareLink = `https://tomotabi.app/plan/${planId}`
      
      // プランを保存（実際はAPIを呼ぶ）
      const finalPlanData = {
        ...planData,
        title: planData.title || `プラン${planId}`,
        shareLink
      }
      console.log('Saving plan:', finalPlanData)
      
      // 一時保存データを削除
      sessionStorage.removeItem('previewPlan')
      localStorage.removeItem('planDraft')
      localStorage.removeItem('planDraftDate')
      
      // 完了画面へ遷移
      router.push(`/plan/complete?id=${planId}&link=${encodeURIComponent(shareLink)}&title=${encodeURIComponent(finalPlanData.title)}`)
    } catch (error) {
      console.error('Share error:', error)
      setCreating(false)
    }
  }

  const handleBack = () => {
    // プラン作成画面にデータを戻してから遷移
    if (planData) {
      sessionStorage.setItem('restorePlan', JSON.stringify(planData))
    }
    router.push('/plan/create')
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
    if (segmentIndex === -1 || !planData) return

    const segment = segments[segmentIndex]
    const fromSpot = planData.spots.find(s => s.id === segment.fromSpotId)
    const toSpot = planData.spots.find(s => s.id === segment.toSpotId)
    
    if (!fromSpot || !toSpot) return

    const commonFromSpot = { ...fromSpot, comment: fromSpot.comment }
    const commonToSpot = { ...toSpot, comment: toSpot.comment }

    const updatedSegment = await updateSegmentMode(segment, commonFromSpot, commonToSpot, newMode)
    
    const newSegments = [...segments]
    newSegments[segmentIndex] = updatedSegment
    setSegments(newSegments)
  }

  const openGoogleMapsTransit = (fromSpot: Spot, toSpot: Spot) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${fromSpot.lat},${fromSpot.lng}&destination=${toSpot.lat},${toSpot.lng}&travelmode=transit`
    window.open(url, '_blank')
  }

  const handlePublish = () => {
    if (!planData || planData.spots.length < 1) return
    setShowPublishModal(true)
  }

  const toggleTag = (tag: string) => {
    setPublishForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }

  const handlePublishConfirm = async () => {
    if (!planData || planData.spots.length < 1) return
    
    setPublishing(true)
    try {
      // プランIDを生成
      const planId = Date.now().toString()
      
      // プランデータを作成（日時は除外してマップに投稿）
      const planData_publish = {
        ...planData,
        title: planData.title || `プラン${planId}`,
        tags: publishForm.tags,
        comment: publishForm.comment,
        isPublic: true,
        publishedAt: new Date().toISOString(),
        // マップ投稿時は日時を除外
        scheduledDate: undefined
      }
      
      console.log('Publishing plan (without scheduledDate):', planData_publish)
      
      // APIコール（モック）
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setShowPublishModal(false)
      setPublishForm({ tags: [], comment: '' })
      
      // 投稿完了後、ホーム画面へ遷移
      setTimeout(() => {
        router.push('/home')
      }, 1000)
    } catch (error) {
      console.error('Publish error:', error)
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">プランを確認中...</p>
        </div>
      </div>
    )
  }

  if (!planData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-50 px-4 py-3 h-16 flex items-center">
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center"
          aria-label="戻る"
        >
          ←
        </button>
        <h1 className="flex-1 text-center font-semibold pr-8">プラン確認</h1>
      </header>

      {/* メインコンテンツ */}
      <main className="pt-16 pb-40">
        {/* プランタイトル */}
        <div className="relative bg-white">
          <div className="w-full h-32 bg-gray-300 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-500 text-sm">プランサムネイル</p>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <h2 className="text-white text-2xl font-bold p-6">
              {planData.title || `新しいプラン（${planData.spots.length}スポット）`}
            </h2>
          </div>
        </div>

        {/* プラン情報カード */}
        <div className="bg-white mx-4 -mt-8 relative rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">所要時間</span>
            <span className="font-semibold">{getDurationText(planData.spots)}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">スポット数</span>
            <span className="font-semibold">{planData.spots.length}ヶ所</span>
          </div>
          {(planData.scheduledDate || (planData.scheduledHour && planData.scheduledMinute)) && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">予定日時</span>
              <span className="font-semibold">
                {(() => {
                  if (planData.scheduledDate && planData.scheduledHour && planData.scheduledMinute) {
                    const timeString = `${planData.scheduledHour.padStart(2, '0')}:${planData.scheduledMinute}`
                    const dateTime = new Date(`${planData.scheduledDate}T${timeString}`)
                    return dateTime.toLocaleString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  } else if (planData.scheduledDate) {
                    const date = new Date(planData.scheduledDate)
                    return date.toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short'
                    })
                  } else if (planData.scheduledHour && planData.scheduledMinute) {
                    return `${planData.scheduledHour.padStart(2, '0')}:${planData.scheduledMinute}`
                  }
                  return ''
                })()}
              </span>
            </div>
          )}
          {planData.budget && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">予算</span>
              <span className="font-semibold">{planData.budget.toLocaleString()}円</span>
            </div>
          )}
          {planData.memo && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600 block mb-1">メモ</span>
              <p className="text-sm">{planData.memo}</p>
            </div>
          )}
        </div>

        {/* スポット一覧 */}
        <div className="px-4 mt-6">
          <h3 className="text-lg font-semibold mb-4">スポット一覧</h3>
          <div className="space-y-4">
            {planData.spots.map((spot, index) => {
              const { startId, endId } = getStartEndIds(planData.spots)
              const isStart = spot.id === startId
              const isEnd = spot.id === endId
              const isDayBreak = planData.dayBreaks?.includes(index)
              
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
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
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
                          {!spot.isLodging && (
                            <p className="text-sm text-gray-500 mt-1">滞在時間: {spot.stayTime}分</p>
                          )}
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
                          <span className="text-white font-bold text-xs">{planData.dayBreaks.indexOf(index) + 2}</span>
                        </div>
                        <span className="font-medium">
                          ─── {planData.dayBreaks.indexOf(index) + 1}日目おわり / {planData.dayBreaks.indexOf(index) + 2}日目 ───
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 移動カード */}
                {index < planData.spots.length - 1 && segments[index] && (
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
                            const fromSpot = planData.spots[index]
                            const toSpot = planData.spots[index + 1]
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
        <div className="space-y-2">
          <button
            onClick={handleCreateShareLink}
            disabled={creating || planData.spots.length < 1}
            className="w-full p-4 text-white font-semibold rounded-lg disabled:bg-gray-400"
            style={{ backgroundColor: '#2db5a5' }}
            aria-label="共有リンクを作成"
          >
            {creating ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                作成中...
              </div>
            ) : (
              '共有リンクを作成'
            )}
          </button>
          <button
            onClick={handlePublish}
            disabled={creating || planData.spots.length < 1}
            className={`w-full p-4 font-semibold rounded-lg transition-all ${
              planData.spots.length < 1 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-white border-2 hover:bg-gray-50 cursor-pointer'
            }`}
            style={{ 
              borderColor: planData.spots.length < 1 ? 'transparent' : '#2db5a5',
              color: planData.spots.length < 1 ? '#9ca3af' : '#2db5a5'
            }}
            type="button"
            aria-label="マップに投稿"
          >
            マップに投稿
          </button>
        </div>
      </footer>

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
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-semibold">{planData?.title || '新しいプラン'}</p>
                <p className="text-sm text-gray-500 mt-1">{planData?.spots.length}スポット・{planData ? getDurationText(planData.spots) : ''}</p>
              </div>
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
    </div>
  )
}