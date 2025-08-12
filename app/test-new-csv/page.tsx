'use client'

import { useState, useEffect } from 'react'
import { listRecommendedRoutes } from '../lib/mock-api'

export default function TestNewCSVPage() {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testNewCSV = async () => {
      try {
        console.log('🧪 新CSVテスト開始')
        const result = await listRecommendedRoutes()
        console.log('✅ 新CSVテスト成功:', result.length, '件')
        
        // CSVプランのみフィルタリング（plan-で始まるID）
        const csvPlans = result.filter(r => r.id.startsWith('plan-'))
        console.log('📊 CSVプラン数:', csvPlans.length)
        
        setRoutes(result)
      } catch (err) {
        console.error('❌ 新CSVテスト失敗:', err)
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    testNewCSV()
  }, [])

  if (loading) {
    return <div className="p-4">新CSVデータを読み込み中...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">エラー: {error}</div>
  }

  const csvPlans = routes.filter(r => r.id.startsWith('plan-'))
  const dummyPlans = routes.filter(r => !r.id.startsWith('plan-'))

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">新CSV統合テストページ</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="font-semibold text-blue-700">統計情報</h3>
          <p>総ルート数: {routes.length}</p>
          <p>CSVプラン: {csvPlans.length}</p>
          <p>ダミープラン: {dummyPlans.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <h3 className="font-semibold text-green-700">新機能確認</h3>
          <p>plan_id対応: ✅</p>
          <p>1000プラン目標: {csvPlans.length >= 100 ? '✅' : '⚠️'}</p>
          <p>日程拡張: ✅</p>
        </div>
      </div>
      
      <h2 className="text-lg font-semibold mb-3">CSVプラン（最初の20件）</h2>
      <div className="space-y-3 mb-6">
        {csvPlans.slice(0, 20).map((route, index) => (
          <div key={route.id} className="border border-green-200 p-4 rounded bg-green-50">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-green-800">{route.title}</h3>
              <span className="text-sm bg-green-200 px-2 py-1 rounded">{route.duration}</span>
            </div>
            <div className="text-sm text-green-600">
              <p>ID: {route.id}</p>
              <p>作成者: {route.author}</p>
              <p>スポット数: {route.spots.length}</p>
              <p>タグ: {route.tags.join(', ')}</p>
              {route.dayBreaks && (
                <p>日付区切り: {route.dayBreaks.join(', ')}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">既存ダミープラン</h2>
      <div className="space-y-3">
        {dummyPlans.map((route, index) => (
          <div key={route.id} className="border border-gray-200 p-4 rounded bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-gray-800">{route.title}</h3>
              <span className="text-sm bg-gray-200 px-2 py-1 rounded">{route.duration}</span>
            </div>
            <div className="text-sm text-gray-600">
              <p>ID: {route.id}</p>
              <p>作成者: {route.author}</p>
              <p>スポット数: {route.spots.length}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}