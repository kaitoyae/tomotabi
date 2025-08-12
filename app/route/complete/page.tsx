'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Route, Spot, sendApplause, publishRemix } from '../../lib/mock-api'

// ダミーデータ（実際はルートIDから取得）
const DUMMY_COMPLETED_ROUTE: Route = {
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

export default function RouteCompletePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [route, setRoute] = useState<Route>(DUMMY_COMPLETED_ROUTE)
  const [applauseLoading, setApplauseLoading] = useState(false)
  const [remixLoading, setRemixLoading] = useState(false)

  useEffect(() => {
    // URLパラメータからルートIDを取得して該当ルートデータを設定
    const routeId = searchParams.get('id')
    if (routeId) {
      // 実際はgetRoute(routeId)を呼ぶ
      setRoute({ ...DUMMY_COMPLETED_ROUTE, id: routeId })
    }
  }, [searchParams])

  const handleApplause = async () => {
    setApplauseLoading(true)
    try {
      await sendApplause(route.id)
      console.log('Applause sent for route:', route.id)
      // 成功フィードバック
      alert('作者に拍手を送りました！')
    } catch (error) {
      console.error('Failed to send applause:', error)
    } finally {
      setApplauseLoading(false)
    }
  }

  const handleRemix = async () => {
    setRemixLoading(true)
    try {
      const result = await publishRemix(route)
      console.log('Remix created:', result.id)
      // リミックス作成画面へ遷移（今回は console.log のみ）
      router.push(`/route/remix?originalId=${route.id}`)
    } catch (error) {
      console.error('Failed to create remix:', error)
    } finally {
      setRemixLoading(false)
    }
  }

  const handleBackToHome = () => {
    router.push('/')
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* 達成バッジ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-yellow-100 rounded-full mb-6">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            ルート完了！
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            お疲れさまでした
          </p>
          <p className="text-gray-500">
            「{route.title}」を達成しました
          </p>
        </div>

        {/* ルート情報 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">{route.title}</h2>
            <span className="text-sm text-gray-500">{getDurationText(route.duration)}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">作成者</span>
            <span className="text-sm font-medium">{route.author}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {route.tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* 回ったスポット一覧 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
          <h3 className="font-semibold text-gray-800 mb-4">回ったスポット</h3>
          <div className="space-y-3">
            {route.spots.map((spot, index) => (
              <div
                key={spot.id}
                className="flex items-center space-x-3"
              >
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{spot.name}</p>
                  {spot.comment && (
                    <p className="text-sm text-gray-600">{spot.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="space-y-3">
          {/* 作者に拍手 */}
          <button
            onClick={handleApplause}
            disabled={applauseLoading}
            className="w-full p-4 text-white font-semibold rounded-lg disabled:bg-gray-400 transition-colors flex items-center justify-center space-x-2"
            style={{ backgroundColor: '#2db5a5' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
            aria-label="作者に拍手を送る"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M11 17.5c-.5 0-1-.2-1.4-.6L6.1 13.4c-.8-.8-.8-2.1 0-2.9.8-.8 2.1-.8 2.9 0l2 2 6-6c.8-.8 2.1-.8 2.9 0 .8.8.8 2.1 0 2.9l-7.5 7.5c-.4.4-.9.6-1.4.6z" fill="currentColor"/>
              <path d="M8.5 21.5c-.3 0-.6-.1-.8-.3-.4-.4-.4-1 0-1.4l2-2c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-2 2c-.2.2-.5.3-.8.3z" fill="currentColor"/>
            </svg>
            <span>{applauseLoading ? '送信中...' : '作者に拍手'}</span>
          </button>

          {/* リミックスする */}
          <button
            onClick={handleRemix}
            disabled={remixLoading}
            className="w-full p-4 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors flex items-center justify-center space-x-2"
            aria-label="このルートをリミックスする"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/>
            </svg>
            <span>{remixLoading ? '作成中...' : 'リミックスする'}</span>
          </button>

          {/* ホームへ戻る */}
          <button
            onClick={handleBackToHome}
            className="w-full p-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            aria-label="ホームに戻る"
          >
            ホームへ戻る
          </button>
        </div>

        {/* フッター */}
        <div className="text-center mt-8 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            また新しいルートに挑戦してみませんか？
          </p>
        </div>
      </div>
    </div>
  )
}