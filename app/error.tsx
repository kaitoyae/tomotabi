'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          エラーが発生しました
        </h2>
        <p className="text-gray-600 mb-6">
          申し訳ございません。予期しないエラーが発生しました。
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 text-white rounded-lg transition-colors"
          style={{ backgroundColor: '#2db5a5' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
        >
          再試行
        </button>
      </div>
    </div>
  )
}