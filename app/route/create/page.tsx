'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { saveRoute, Spot, Segment, SegmentMode, generateSegments, updateSegmentMode } from '../../lib/mock-api'

type FormData = {
  title: string
  duration: '90m' | 'half' | 'day'
  tags: string[]
  isPublic: boolean
  spots: Spot[]
}

type SpotFormData = {
  name: string
  comment: string
  photo: File | null
  lat: number | null
  lng: number | null
}

export default function CreateRoutePage() {
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<FormData>({
    title: '',
    duration: '90m',
    tags: [],
    isPublic: true,
    spots: []
  })

  const [spotForm, setSpotForm] = useState<SpotFormData>({
    name: '',
    comment: '',
    photo: null,
    lat: null,
    lng: null
  })

  const [newTag, setNewTag] = useState('')
  const [showSpotForm, setShowSpotForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [segments, setSegments] = useState<Segment[]>([])
  const [defaultMode, setDefaultMode] = useState<SegmentMode>('walking')

  // スポットが変更されたらセグメントを再計算
  useEffect(() => {
    if (formData.spots.length >= 2) {
      generateSegments(formData.spots, defaultMode).then(setSegments)
    } else {
      setSegments([])
    }
  }, [formData.spots, defaultMode])

  // 地図初期化
  const initializeMap = () => {
    if (mapContainer.current && !map.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [139.7745, 35.6820],
        zoom: 14
      })

      map.current.on('click', (e) => {
        const { lng, lat } = e.lngLat
        setSpotForm(prev => ({ ...prev, lat, lng }))
        
        // 既存のマーカーを削除
        const existingMarkers = document.querySelectorAll('.maplibregl-marker')
        existingMarkers.forEach(marker => marker.remove())
        
        // 新しいマーカーを追加
        new maplibregl.Marker({ color: '#EF4444' })
          .setLngLat([lng, lat])
          .addTo(map.current!)
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.title.trim()) {
      newErrors.title = 'ルート名は必須です'
    }
    
    if (formData.spots.length < 3) {
      newErrors.spots = '最低3つのスポットが必要です'
    } else if (formData.spots.length > 7) {
      newErrors.spots = 'スポットは最大7つまでです'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateSpotForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!spotForm.name.trim()) {
      newErrors.spotName = 'スポット名は必須です'
    }
    
    if (spotForm.comment && spotForm.comment.length > 140) {
      newErrors.spotComment = 'コメントは140文字以内で入力してください'
    }
    
    if (!spotForm.lat || !spotForm.lng) {
      newErrors.spotLocation = '地図上でスポットの位置を選択してください'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const addTag = () => {
    if (newTag.trim() && formData.tags.length < 3 && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSpotForm(prev => ({ ...prev, photo: file }))
    }
  }

  const addSpot = () => {
    if (!validateSpotForm()) return

    const newSpot: Spot = {
      id: `spot-${Date.now()}`,
      name: spotForm.name,
      lat: spotForm.lat!,
      lng: spotForm.lng!,
      comment: spotForm.comment || undefined,
      photo: spotForm.photo ? URL.createObjectURL(spotForm.photo) : undefined
    }

    setFormData(prev => ({
      ...prev,
      spots: [...prev.spots, newSpot]
    }))

    // フォームリセット
    setSpotForm({
      name: '',
      comment: '',
      photo: null,
      lat: null,
      lng: null
    })
    setShowSpotForm(false)
    
    // 地図のマーカーをクリア
    const existingMarkers = document.querySelectorAll('.maplibregl-marker')
    existingMarkers.forEach(marker => marker.remove())
  }

  const removeSpot = (spotId: string) => {
    setFormData(prev => ({
      ...prev,
      spots: prev.spots.filter(spot => spot.id !== spotId)
    }))
  }

  const moveSpot = (index: number, direction: 'up' | 'down') => {
    const newSpots = [...formData.spots]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex >= 0 && targetIndex < newSpots.length) {
      [newSpots[index], newSpots[targetIndex]] = [newSpots[targetIndex], newSpots[index]]
      setFormData(prev => ({ ...prev, spots: newSpots }))
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const payload = {
        title: formData.title,
        duration: formData.duration,
        tags: formData.tags,
        author: '現在のユーザー', // 実際はログインユーザー情報
        cover: formData.spots[0]?.photo || '/default-cover.jpg',
        spots: formData.spots
      }

      const result = await saveRoute(payload)
      console.log('Route saved:', result)
      
      setToast({ message: 'ルートを公開しました！', type: 'success' })
      
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error) {
      console.error('Failed to save route:', error)
      setToast({ message: '保存に失敗しました', type: 'error' })
    } finally {
      setLoading(false)
    }
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
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'driving':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        )
      case 'transit':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )
    }
  }

  const handleSegmentModeChange = async (segmentId: string, newMode: SegmentMode) => {
    const segmentIndex = segments.findIndex(s => s.id === segmentId)
    if (segmentIndex === -1) return

    const segment = segments[segmentIndex]
    const fromSpot = formData.spots.find(s => s.id === segment.fromSpotId)
    const toSpot = formData.spots.find(s => s.id === segment.toSpotId)
    
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
        <h1 className="flex-1 text-center font-semibold pr-8">ルート作成</h1>
      </header>

      <main className="pt-16 px-4">
        {/* ルート基本情報 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">基本情報</h2>
          
          {/* ルート名 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ルート名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例：下町レトロ散歩"
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          {/* 所要時間 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">所要時間</label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value as '90m' | 'half' | 'day' }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="90m">90分</option>
              <option value="half">半日</option>
              <option value="day">1日</option>
            </select>
          </div>

          {/* タグ */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タグ（最大3つ）
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded-lg"
                placeholder="タグを入力"
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
              />
              <button
                onClick={addTag}
                disabled={formData.tags.length >= 3}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-400"
              >
                追加
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 公開設定 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
              className="mr-2"
            />
            <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
              公開する
            </label>
          </div>
        </div>

        {/* スポット一覧 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              スポット ({formData.spots.length}/7)
            </h2>
            <button
              onClick={() => {
                setShowSpotForm(true)
                setTimeout(initializeMap, 100)
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              ＋追加
            </button>
          </div>
          
          {errors.spots && <p className="text-red-500 text-sm mb-4">{errors.spots}</p>}
          
          <div className="space-y-3">
            {formData.spots.map((spot, index) => (
              <React.Fragment key={spot.id}>
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                          {index + 1}
                        </span>
                        <h3 className="font-semibold">{spot.name}</h3>
                      </div>
                      {spot.comment && (
                        <p className="text-sm text-gray-600 mb-2">{spot.comment}</p>
                      )}
                      {spot.photo && (
                        <img
                          src={spot.photo}
                          alt={spot.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                    </div>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => moveSpot(index, 'up')}
                        disabled={index === 0}
                        className="px-2 py-1 text-xs bg-gray-200 rounded disabled:opacity-50"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSpot(index, 'down')}
                        disabled={index === formData.spots.length - 1}
                        className="px-2 py-1 text-xs bg-gray-200 rounded disabled:opacity-50"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeSpot(spot.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* 移動カード */}
                {index < formData.spots.length - 1 && segments[index] && (
                  <div className="bg-gray-50 rounded-lg p-3 ml-3 mr-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getModeIcon(segments[index].mode)}
                        <span className="text-sm font-medium">移動</span>
                      </div>
                      <select
                        value={segments[index].mode}
                        onChange={(e) => handleSegmentModeChange(segments[index].id, e.target.value as SegmentMode)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="walking">徒歩</option>
                        <option value="driving">車</option>
                        <option value="transit">公共交通</option>
                      </select>
                    </div>
                    
                    {segments[index].mode === 'transit' ? (
                      <div className="text-center">
                        <button
                          onClick={() => {
                            const fromSpot = formData.spots[index]
                            const toSpot = formData.spots[index + 1]
                            openGoogleMapsTransit(fromSpot, toSpot)
                          }}
                          className="text-blue-500 underline text-sm"
                        >
                          Googleマップで経路を確認
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{formatDistance(segments[index].distanceM)}</span>
                        <span>{formatDuration(segments[index].durationS)}</span>
                      </div>
                    )}
                    
                    {segments[index].osrm && segments[index].osrm!.routes.length > 1 && (
                      <div className="mt-2 text-xs text-gray-500">
                        <span>代替ルート: </span>
                        <select
                          value={segments[index].osrm!.selectedIndex}
                          onChange={(e) => {
                            const newSegments = [...segments]
                            newSegments[index] = {
                              ...segments[index],
                              osrm: {
                                ...segments[index].osrm!,
                                selectedIndex: parseInt(e.target.value)
                              },
                              distanceM: segments[index].osrm!.routes[parseInt(e.target.value)].distance,
                              durationS: segments[index].osrm!.routes[parseInt(e.target.value)].duration
                            }
                            setSegments(newSegments)
                          }}
                          className="text-xs px-1 py-0.5 border border-gray-300 rounded ml-1"
                        >
                          {segments[index].osrm!.routes.map((route, idx) => (
                            <option key={idx} value={idx}>
                              ルート{idx + 1} ({formatDuration(route.duration)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* スポット追加フォーム */}
        {showSpotForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">スポット追加</h3>
              </div>
              <div className="p-4">
                {/* 地図 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    位置を選択 <span className="text-red-500">*</span>
                  </label>
                  <div ref={mapContainer} className="w-full h-48 rounded-lg border" />
                  {errors.spotLocation && (
                    <p className="text-red-500 text-sm mt-1">{errors.spotLocation}</p>
                  )}
                </div>

                {/* 写真 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">写真</label>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                  {spotForm.photo && (
                    <img
                      src={URL.createObjectURL(spotForm.photo)}
                      alt="Preview"
                      className="mt-2 w-20 h-20 object-cover rounded"
                    />
                  )}
                </div>

                {/* 名称 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    スポット名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={spotForm.name}
                    onChange={(e) => setSpotForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    placeholder="例：浅草寺"
                  />
                  {errors.spotName && (
                    <p className="text-red-500 text-sm mt-1">{errors.spotName}</p>
                  )}
                </div>

                {/* コメント */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    コメント（140文字以内）
                  </label>
                  <textarea
                    value={spotForm.comment}
                    onChange={(e) => setSpotForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="例：東京最古のお寺。雷門が有名"
                  />
                  <div className="text-right text-sm text-gray-500">
                    {spotForm.comment.length}/140
                  </div>
                  {errors.spotComment && (
                    <p className="text-red-500 text-sm mt-1">{errors.spotComment}</p>
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex space-x-2">
                <button
                  onClick={() => setShowSpotForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={addSpot}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 固定フッター */}
      <footer className="fixed bottom-0 w-full bg-white border-t p-4 z-40">
        <button
          onClick={handleSubmit}
          disabled={loading || formData.spots.length < 3}
          className="w-full p-4 bg-blue-500 text-white font-semibold rounded-lg disabled:bg-gray-400 transition-colors"
        >
          {loading ? '保存中...' : '公開'}
        </button>
      </footer>

      {/* トースト */}
      {toast && (
        <div
          className={`fixed top-20 left-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}
        >
          <p>{toast.message}</p>
        </div>
      )}
    </div>
  )
}