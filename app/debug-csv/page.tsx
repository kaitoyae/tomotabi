'use client'

import { useState } from 'react'

export default function DebugCSVPage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testCSVFetch = async () => {
    setLoading(true)
    setResult('')
    
    try {
      console.log('🔍 CSV直接テスト開始')
      
      // 1. CSVファイルの読み込みテスト
      const response = await fetch('/travel_plans.csv')
      console.log('📄 レスポンス:', response.status, response.statusText)
      
      const csvText = await response.text()
      console.log('📊 CSV文字数:', csvText.length)
      
      // BOM確認
      const hasBOM = csvText.charCodeAt(0) === 0xFEFF
      console.log('🔍 BOM検出:', hasBOM)
      
      // 行数確認
      const lines = csvText.trim().split('\n')
      console.log('📝 行数:', lines.length)
      
      // ヘッダー確認
      const headers = lines[0].split(',')
      console.log('📋 ヘッダー数:', headers.length, headers)
      
      // 最初の数行を解析
      let successCount = 0
      let errorCount = 0
      
      for (let i = 1; i <= Math.min(10, lines.length - 1); i++) {
        try {
          const values = lines[i].split(',')
          if (values.length >= 14) {
            successCount++
          } else {
            errorCount++
            console.warn(`行${i}: 列数不足 ${values.length}/14`)
          }
        } catch (err) {
          errorCount++
          console.warn(`行${i}: パースエラー`, err)
        }
      }
      
      // plan_id統計
      const planIds = new Set()
      for (let i = 1; i < Math.min(100, lines.length); i++) {
        try {
          const values = lines[i].split(',')
          if (values[1]) planIds.add(values[1])
        } catch (err) {
          // ignore
        }
      }
      
      const resultText = `
CSV読み込みテスト結果（更新版）:
- ファイルサイズ: ${csvText.length} 文字
- BOM検出: ${hasBOM ? 'あり' : 'なし'}
- 総行数: ${lines.length}
- ヘッダー列数: ${headers.length} (期待値: 14)
- 最初の10行の成功率: ${successCount}/${successCount + errorCount}
- 最初の100行のユニークplan_id数: ${planIds.size}

ヘッダー: ${headers.join(', ')}

最初の3データ行:
${lines[1]}
${lines[2]}
${lines[3]}
      `.trim()
      
      setResult(resultText)
      console.log('✅ CSV直接テスト完了')
      
    } catch (error) {
      const errorText = `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
      setResult(errorText)
      console.error('❌ CSV直接テスト失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">CSV Debug Page</h1>
      
      <button
        onClick={testCSVFetch}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        {loading ? 'テスト中...' : 'CSV読み込みテスト実行'}
      </button>
      
      {result && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">結果:</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}