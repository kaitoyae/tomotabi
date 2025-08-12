'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// SNSアイコンコンポーネント
const LineIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.804.039 1.104l-.164 1.107c-.061.348-.283 1.369 1.204.343 1.487-1.025 8.018-4.717 10.94-8.077A9.335 9.335 0 0 0 24 10.314" fill="white"/>
  </svg>
)

const FacebookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="white"/>
  </svg>
)

const InstagramIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="white"/>
  </svg>
)

const XIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="white"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="22" fill="#10B981" stroke="#065F46" strokeWidth="2"/>
    <path d="M16 24L20 28L32 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function PlanCompletePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')
  const shareLink = searchParams.get('link') || ''
  const titleParam = searchParams.get('title') || ''
  const [copied, setCopied] = useState(false)
  const [planTitle, setPlanTitle] = useState('')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishForm, setPublishForm] = useState({
    tags: [] as string[],
    comment: ''
  })
  const [publishing, setPublishing] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  
  useEffect(() => {
    // URLパラメータからタイトルを取得
    if (titleParam) {
      setPlanTitle(decodeURIComponent(titleParam))
    } else {
      // タイトルがない場合はデフォルト
      setPlanTitle('新しい旅プラン')
    }
  }, [titleParam])
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(decodeURIComponent(shareLink))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Copy error:', error)
    }
  }
  
  const shareToSNS = (platform: string) => {
    const text = `${planTitle}を作成しました！`
    const url = decodeURIComponent(shareLink)
    
    let shareUrl = ''
    switch (platform) {
      case 'line':
        shareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text + '\n' + url)}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        break
      case 'instagram':
        // Instagramは直接シェアができないので、リンクをコピーして案内
        handleCopyLink()
        alert('リンクをコピーしました。Instagramアプリでストーリーズやプロフィールに貼り付けてください。')
        return
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }
  
  const handleBackToHome = () => {
    router.push('/home')
  }
  
  const handleCreateAnother = () => {
    router.push('/plan/create')
  }
  
  const handlePublish = () => {
    setShowPublishModal(true)
  }
  
  const handlePublishConfirm = async () => {
    setPublishing(true)
    try {
      // プランデータを作成
      const planData = {
        id: planId,
        title: planTitle,
        tags: publishForm.tags,
        comment: publishForm.comment,
        isPublic: true,
        publishedAt: new Date().toISOString()
      }
      
      console.log('Publishing plan:', planData)
      
      // APIコール（モック）
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setIsPublished(true)
      setShowPublishModal(false)
      setPublishForm({ tags: [], comment: '' })
      
      // トースト表示
      const toastElement = document.createElement('div')
      toastElement.className = 'fixed top-20 left-4 right-4 p-4 rounded-lg shadow-lg z-50 bg-gray-700 text-white text-center'
      toastElement.textContent = 'マップに投稿しました！'
      document.body.appendChild(toastElement)
      
      setTimeout(() => {
        toastElement.remove()
      }, 3000)
    } catch (error) {
      console.error('Publish error:', error)
      alert('投稿に失敗しました')
    } finally {
      setPublishing(false)
    }
  }
  
  const toggleTag = (tag: string) => {
    setPublishForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 成功アイコン */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-50 rounded-full mb-4">
            <CheckIcon />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            プランを作成しました！
          </h1>
          <p className="text-gray-600">
            友達や家族とプランを共有しましょう
          </p>
        </div>
        
        {/* 共有リンク */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            共有リンク
          </label>
          <div className="flex space-x-2 items-center">
            <input
              type="text"
              value={decodeURIComponent(shareLink)}
              readOnly
              className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-300 rounded-lg text-sm overflow-hidden text-ellipsis"
            />
            <button
              onClick={handleCopyLink}
              className="flex-shrink-0 px-3 py-3 text-white rounded-lg transition-colors flex items-center justify-center min-w-[64px]"
              style={{ backgroundColor: '#2db5a5' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span className="text-sm">コピー</span>
              )}
            </button>
          </div>
        </div>
        
        {/* SNS共有ボタン */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            SNSで共有
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => shareToSNS('line')}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-1">
                <LineIcon />
              </div>
              <span className="text-xs text-gray-600">LINE</span>
            </button>
            
            <button
              onClick={() => shareToSNS('twitter')}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-1">
                <XIcon />
              </div>
              <span className="text-xs text-gray-600">X</span>
            </button>
            
            <button
              onClick={() => shareToSNS('facebook')}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-1" style={{ backgroundColor: '#239b8f' }}>
                <FacebookIcon />
              </div>
              <span className="text-xs text-gray-600">Facebook</span>
            </button>
            
            <button
              onClick={() => shareToSNS('instagram')}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-1">
                <InstagramIcon />
              </div>
              <span className="text-xs text-gray-600">Instagram</span>
            </button>
          </div>
        </div>
        
        {/* アクションボタン */}
        <div className="space-y-3">
          {!isPublished && (
            <button
              onClick={handlePublish}
              className="w-full p-4 text-white font-semibold rounded-lg transition-colors"
              style={{ backgroundColor: '#f2b938' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0a82e'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f2b938'}
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                マップに投稿
              </div>
            </button>
          )}
          
          <button
            onClick={handleBackToHome}
            className="w-full p-4 text-white font-semibold rounded-lg transition-colors"
            style={{ backgroundColor: '#2db5a5' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
          >
            ホームへ戻る
          </button>
          
          <button
            onClick={handleCreateAnother}
            className="w-full p-4 bg-white font-semibold rounded-lg border transition-colors"
            style={{ color: '#2db5a5', borderColor: '#2db5a5' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fffe'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            別のプランを作成
          </button>
        </div>
        
        {/* ヒント */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="m8 12l0-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="m8 5l.01 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            作成したプランは「マイページ」からいつでも確認できます
          </div>
        </div>
      </div>
      
      {/* 投稿モーダル */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">マップに投稿</h3>
            
            {/* プラン名表示 */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">投稿するプラン</p>
              <p className="font-medium">{planTitle}</p>
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