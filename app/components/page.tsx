'use client'

import { useState, useRef, useEffect } from 'react'

// ==================== BottomSheet Component ====================
interface BottomSheetProps {
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onToggle, children }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartY(e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    setCurrentY(e.touches[0].clientY)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    const diff = currentY - startY
    if (Math.abs(diff) > 50) {
      onToggle()
    }
    setCurrentY(0)
    setStartY(0)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartY(e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setCurrentY(e.clientY)
  }

  const handleMouseUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    const diff = currentY - startY
    if (Math.abs(diff) > 50) {
      onToggle()
    }
    setCurrentY(0)
    setStartY(0)
  }

  const height = isOpen ? '60%' : '96px'

  return (
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 z-30"
      style={{ height }}
    >
      <div
        className="w-full py-3 flex justify-center cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="button"
        aria-label={isOpen ? 'シートを閉じる' : 'シートを開く'}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
      </div>
      <div className="px-4 pb-4 overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
        {children}
      </div>
    </div>
  )
}

// ==================== PrimaryButton Component ====================
interface PrimaryButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ 
  children, 
  onClick, 
  disabled = false,
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full p-4 text-white font-semibold rounded-lg transition-colors duration-200 
        ${disabled ? 'bg-gray-400 cursor-not-allowed' : ''}
        ${className || ''}
      `}
      style={disabled ? {} : { backgroundColor: '#2db5a5' }}
      onMouseEnter={!disabled ? (e) => e.currentTarget.style.backgroundColor = '#239b8f' : undefined}
      onMouseLeave={!disabled ? (e) => e.currentTarget.style.backgroundColor = '#2db5a5' : undefined}
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {children}
    </button>
  )
}

// ==================== Toast Component ====================
interface ToastProps {
  message: string
  type: 'success' | 'error'
  isVisible: boolean
  onClose?: () => void
}

const Toast: React.FC<ToastProps> = ({ message, type, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible && onClose) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500'

  return (
    <div
      className={`fixed top-20 left-4 right-4 ${bgColor} text-white p-4 rounded-lg shadow-lg z-50 transition-all duration-300 ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4'}`}
      role="alert"
    >
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 text-white hover:text-gray-200"
            aria-label="閉じる"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ==================== Sample Page for Testing ====================
export default function ComponentsPage() {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-40 p-4">
        <h1 className="text-xl font-bold text-center">共有コンポーネント</h1>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4">
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold mb-4">BottomSheet デモ</h2>
            <p className="text-gray-600 mb-4">
              下のボタンを押すか、BottomSheetをドラッグして開閉できます
            </p>
            <button
              onClick={() => setIsBottomSheetOpen(!isBottomSheetOpen)}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              BottomSheetを{isBottomSheetOpen ? '閉じる' : '開く'}
            </button>
          </div>

          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold mb-4">Toast デモ</h2>
            <div className="space-y-3">
              <button
                onClick={() => showToast('success', '処理が正常に完了しました！')}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                成功トーストを表示
              </button>
              <button
                onClick={() => showToast('error', 'エラーが発生しました。もう一度お試しください。')}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                エラートーストを表示
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold mb-4">PrimaryButton デモ</h2>
            <div className="space-y-3">
              <PrimaryButton onClick={() => showToast('success', 'ボタンがクリックされました！')}>
                通常のボタン
              </PrimaryButton>
              <PrimaryButton disabled>
                無効なボタン
              </PrimaryButton>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Footer with PrimaryButton */}
      <footer className="fixed bottom-0 w-full bg-white border-t p-4 z-20">
        <PrimaryButton onClick={() => showToast('success', 'フッターボタンがクリックされました！')}>
          フッター固定ボタン
        </PrimaryButton>
      </footer>

      {/* BottomSheet */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onToggle={() => setIsBottomSheetOpen(!isBottomSheetOpen)}
      >
        <h3 className="text-lg font-semibold mb-3">BottomSheetの内容</h3>
        <div className="space-y-3">
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">
              ここにBottomSheetの内容が入ります。スクロール可能です。
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">アイテム 1</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">アイテム 2</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">アイテム 3</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">アイテム 4</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">アイテム 5</p>
          </div>
        </div>
      </BottomSheet>

      {/* Toast */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </div>
  )
}