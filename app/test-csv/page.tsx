'use client'

import { useState, useEffect } from 'react'
import { listRecommendedRoutes } from '../lib/mock-api'

export default function TestCSVPage() {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testCSV = async () => {
      try {
        console.log('🧪 CSVテスト開始')
        const result = await listRecommendedRoutes()
        console.log('✅ CSVテスト成功:', result.length, '件')
        setRoutes(result)
      } catch (err) {
        console.error('❌ CSVテスト失敗:', err)
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    testCSV()
  }, [])

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">エラー: {error}</div>
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">CSV テストページ</h1>
      <p className="mb-4">取得したルート数: {routes.length}</p>
      
      <div className="space-y-4">
        {routes.slice(0, 10).map((route, index) => (
          <div key={route.id} className="border p-4 rounded">
            <h3 className="font-bold">{route.title}</h3>
            <p>ID: {route.id}</p>
            <p>作成者: {route.author}</p>
            <p>所要時間: {route.duration}</p>
            <p>スポット数: {route.spots.length}</p>
            <p>タグ: {route.tags.join(', ')}</p>
          </div>
        ))}
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer font-bold">全データ（デバッグ用）</summary>
        <pre className="bg-gray-100 p-4 mt-2 text-xs overflow-auto">
          {JSON.stringify(routes, null, 2)}
        </pre>
      </details>
    </div>
  )
}