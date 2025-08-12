'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          ページが見つかりません
        </h2>
        <p className="text-gray-600 mb-6">
          お探しのページは存在しないか、移動された可能性があります。
        </p>
        <Link 
          href="/"
          className="inline-block px-6 py-3 text-white rounded-lg transition-colors"
          style={{ backgroundColor: '#2db5a5' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}