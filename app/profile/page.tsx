'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 型定義
type User = {
  id: string
  name: string
  email: string
  handle?: string
  avatar?: string
  bio?: string
  stats: {
    createdRoutes: number
    completedRoutes: number
    followers: number
    following: number
  }
  isFollowing: boolean
  isProfileComplete: boolean
}

type AuthState = {
  isSignedIn: boolean
  user: User | null
}

type ProfileFormData = {
  name: string
  handle: string
  bio: string
  avatar?: string
}

type RouteCard = {
  id: string
  title: string
  cover: string
  duration: '90m' | 'half' | 'day'
  tags: string[]
  completedAt?: string
  likedAt?: string
}

// Gmail情報から基本ユーザー情報を生成するヘルパー関数
const createUserFromEmail = (email: string): User => {
  const username = email.split('@')[0]
  const displayName = username.charAt(0).toUpperCase() + username.slice(1)
  
  return {
    id: `u_${Date.now()}`,
    name: displayName,
    email: email,
    stats: {
      createdRoutes: 0,
      completedRoutes: 0,
      followers: 0,
      following: 0
    },
    isFollowing: false,
    isProfileComplete: false
  }
}

const CREATED_ROUTES: RouteCard[] = [
  {
    id: 'r1',
    title: '下町レトロ散歩',
    cover: '/route1.jpg',
    duration: '90m',
    tags: ['歴史', 'グルメ', '商店街']
  },
  {
    id: 'r2',
    title: 'カフェ巡りコース',
    cover: '/route2.jpg',
    duration: 'half',
    tags: ['カフェ', 'スイーツ']
  },
  {
    id: 'r3',
    title: '夜景スポット巡り',
    cover: '/route3.jpg',
    duration: 'day',
    tags: ['夜景', '写真', 'デート']
  }
]

const COMPLETED_ROUTES: RouteCard[] = [
  {
    id: 'r4',
    title: '東京タワー周辺散策',
    cover: '/route4.jpg',
    duration: '90m',
    tags: ['観光', '東京タワー'],
    completedAt: '2024-03-15'
  },
  {
    id: 'r5',
    title: '浅草食べ歩きツアー',
    cover: '/route5.jpg',
    duration: 'half',
    tags: ['グルメ', '浅草'],
    completedAt: '2024-03-10'
  }
]

const LIKED_ROUTES: RouteCard[] = [
  {
    id: 'r6',
    title: '隅田川桜並木ウォーク',
    cover: '/route6.jpg',
    duration: 'half',
    tags: ['桜', '散歩'],
    likedAt: '2024-03-20'
  },
  {
    id: 'r7',
    title: '谷根千アート巡り',
    cover: '/route7.jpg',
    duration: 'day',
    tags: ['アート', '下町'],
    likedAt: '2024-03-18'
  }
]

// モックAPI: サインイン状態チェック
const mockCheckAuthState = async (): Promise<AuthState> => {
  await new Promise(resolve => setTimeout(resolve, 500))
  // ダミー: 30%の確率でサインイン状態をシミュレート（プロフィール未完成状態）
  const isSignedIn = Math.random() > 0.7
  if (isSignedIn) {
    const mockEmail = 'user@gmail.com'
    const user = createUserFromEmail(mockEmail)
    return { isSignedIn: true, user }
  }
  return { isSignedIn: false, user: null }
}

// モックAPI: サインインプロセス
const mockSignIn = async (provider: 'google' | 'microsoft' | 'email'): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 1500))
  console.log(`Sign in with ${provider}`)
  
  // プロバイダーに応じてダミーメールアドレスを生成
  let mockEmail: string
  switch (provider) {
    case 'google':
      mockEmail = 'user@gmail.com'
      break
    case 'microsoft':
      mockEmail = 'user@outlook.com'
      break
    case 'email':
      mockEmail = 'user@example.com'
      break
    default:
      mockEmail = 'user@gmail.com'
  }
  
  return createUserFromEmail(mockEmail)
}

// モックAPI: アバター画像アップロード
const mockUploadAvatar = async (file: File): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1500))
  console.log('Avatar uploaded:', file.name)
  
  // ダミーのアップロード後URL（実際はSupabase StorageなどのパブリックURLが返される）
  return `https://example.com/avatars/${Date.now()}_${file.name}`
}

// モックAPI: プロフィール更新
const mockUpdateProfile = async (profileData: ProfileFormData, currentUser: User): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  console.log('Profile updated:', profileData)
  
  // 現在のユーザー情報に更新データをマージ
  const updatedUser: User = {
    ...currentUser,
    name: profileData.name,
    handle: profileData.handle,
    bio: profileData.bio,
    avatar: profileData.avatar || currentUser.avatar,
    isProfileComplete: true
  }
  
  return updatedUser
}

export default function ProfilePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'created' | 'completed' | 'liked'>('created')
  const [authState, setAuthState] = useState<AuthState>({ isSignedIn: false, user: null })
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    handle: '',
    bio: '',
    avatar: undefined
  })
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // 初期化: サインイン状態をチェック
  useEffect(() => {
    const initAuth = async () => {
      try {
        const auth = await mockCheckAuthState()
        setAuthState(auth)
      } catch (error) {
        console.error('Auth check failed:', error)
        setAuthState({ isSignedIn: false, user: null })
      } finally {
        setLoading(false)
      }
    }
    initAuth()
  }, [])

  const handleBack = () => {
    router.back()
  }

  const handleShare = async () => {
    if (!authState.user) return
    
    try {
      // プロフィールURLを生成
      const profileUrl = `https://tomotabi.app/profile/${authState.user.handle || authState.user.id}`
      
      // クリップボードにコピー
      await navigator.clipboard.writeText(profileUrl)
      
      // トースト表示（簡易版）
      const toastElement = document.createElement('div')
      toastElement.className = 'fixed top-20 left-4 right-4 p-4 rounded-lg shadow-lg z-50 bg-gray-700 text-white text-center'
      toastElement.textContent = 'プロフィールURLをコピーしました'
      document.body.appendChild(toastElement)
      
      // 3秒後に削除
      setTimeout(() => {
        toastElement.remove()
      }, 3000)
      
      console.log('Profile shared:', profileUrl)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('URLのコピーに失敗しました')
    }
  }

  const handleEdit = () => {
    if (authState.user) {
      setFormData({
        name: authState.user.name,
        handle: authState.user.handle || '',
        bio: authState.user.bio || '',
        avatar: authState.user.avatar
      })
      setAvatarPreview(authState.user.avatar || null)
      setIsEditing(true)
    }
  }

  const handleSignIn = async (provider: 'google' | 'microsoft' | 'email') => {
    setSigningIn(true)
    try {
      const user = await mockSignIn(provider)
      setAuthState({ isSignedIn: true, user })
      // サインイン後、プロフィール未完成の場合は編集モードに
      if (!user.isProfileComplete) {
        setFormData({
          name: user.name,
          handle: user.email.split('@')[0], // メールアドレスのローカル部をハンドルに
          bio: '',
          avatar: undefined
        })
        setAvatarPreview(null)
        setIsEditing(true)
      }
    } catch (error) {
      console.error('Sign in failed:', error)
    } finally {
      setSigningIn(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ファイルタイプチェック
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }

    // ファイルサイズチェック (5MB以下)
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください')
      return
    }

    setAvatarFile(file)
    
    // プレビュー用のDataURLを生成
    const reader = new FileReader()
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async () => {
    if (!formData.name.trim() || !formData.handle.trim()) {
      alert('名前とハンドルは必須です')
      return
    }

    if (!authState.user) return

    setSaving(true)
    try {
      let updatedFormData = { ...formData }

      // アバター画像がアップロードされている場合はアップロード処理
      if (avatarFile) {
        const avatarUrl = await mockUploadAvatar(avatarFile)
        updatedFormData.avatar = avatarUrl
      }

      const updatedUser = await mockUpdateProfile(updatedFormData, authState.user)
      setAuthState({ isSignedIn: true, user: updatedUser })
      setIsEditing(false)
      setAvatarFile(null)
      setAvatarPreview(null)
    } catch (error) {
      console.error('Profile update failed:', error)
      alert('プロフィールの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (!authState.user?.isProfileComplete) {
      // プロフィール未完成の場合はサインアウト
      setAuthState({ isSignedIn: false, user: null })
    }
    setIsEditing(false)
    setFormData({ name: '', handle: '', bio: '', avatar: undefined })
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  const handleFollowToggle = () => {
    if (!authState.user) return
    
    const updatedUser = {
      ...authState.user,
      isFollowing: !authState.user.isFollowing,
      stats: {
        ...authState.user.stats,
        followers: authState.user.isFollowing 
          ? authState.user.stats.followers - 1 
          : authState.user.stats.followers + 1
      }
    }
    setAuthState({ ...authState, user: updatedUser })
    console.log(authState.user.isFollowing ? 'Unfollowed' : 'Followed')
  }

  const handleStatClick = (stat: string) => {
    console.log(`Clicked ${stat}`)
  }

  const handleRouteClick = (routeId: string) => {
    console.log(`Route clicked: ${routeId}`)
  }

  const getDurationText = (duration: string) => {
    switch (duration) {
      case '90m': return '90分'
      case 'half': return '半日'
      case 'day': return '1日'
      default: return duration
    }
  }

  const getTabContent = () => {
    switch (activeTab) {
      case 'created':
        return CREATED_ROUTES
      case 'completed':
        return COMPLETED_ROUTES
      case 'liked':
        return LIKED_ROUTES
      default:
        return []
    }
  }

  // ローディング状態
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: '#2db5a5', borderTopColor: 'transparent' }}></div>
          <p className="text-sm text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  // ゲスト表示（サインインしていない場合）
  if (!authState.isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="fixed top-0 w-full bg-white shadow-sm z-50 px-4 py-3 h-16 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center"
            aria-label="戻る"
          >
            ←
          </button>
          <h1 className="text-lg font-semibold">マイページ</h1>
          <div className="w-8"></div>
        </header>

        <main className="pt-16 pb-20 px-4">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            {/* アイコンプレースホルダー */}
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            
            <h2 className="text-xl font-bold mb-2">ゲストユーザー</h2>
            <p className="text-gray-600 mb-8 max-w-sm">
              サインインしてプロフィールを作成し、<br />
              ルートの作成や保存をしましょう
            </p>

            {/* サインインボタン */}
            <div className="w-full max-w-sm space-y-3">
              <button
                onClick={() => handleSignIn('google')}
                disabled={signingIn}
                className="w-full p-3 bg-white border border-gray-300 rounded-lg flex items-center justify-center font-medium disabled:opacity-50"
              >
                {signingIn ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Googleでサインイン
              </button>
              
              <button
                onClick={() => handleSignIn('microsoft')}
                disabled={signingIn}
                className="w-full p-3 bg-white border border-gray-300 rounded-lg flex items-center justify-center font-medium disabled:opacity-50"
              >
                {signingIn ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#00A4EF" d="M2 3h10v10H2z"/>
                    <path fill="#FFB900" d="M12 3h10v10H12z"/>
                    <path fill="#F25022" d="M2 13h10v10H2z"/>
                    <path fill="#7FBA00" d="M12 13h10v10H12z"/>
                  </svg>
                )}
                Microsoftでサインイン
              </button>
              
              <button
                onClick={() => handleSignIn('email')}
                disabled={signingIn}
                className="w-full p-3 text-white rounded-lg flex items-center justify-center font-medium disabled:opacity-50"
                style={{ backgroundColor: '#2db5a5' }}
              >
                {signingIn ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                )}
                メールアドレスでサインイン
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6 max-w-xs">
              サインインすることで、利用規約とプライバシーポリシーに同意したものとみなします
            </p>
          </div>
        </main>
      </div>
    )
  }

  // プロフィール編集画面
  if (isEditing && authState.user) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="fixed top-0 w-full bg-white shadow-sm z-50 px-4 py-3 h-16 flex items-center justify-between">
          <button
            onClick={handleCancelEdit}
            className="text-gray-600"
            aria-label="キャンセル"
          >
            {!authState.user.isProfileComplete ? '戻る' : 'キャンセル'}
          </button>
          <h1 className="text-lg font-semibold">
            {!authState.user.isProfileComplete ? 'プロフィール作成' : 'プロフィール編集'}
          </h1>
          <div className="w-16"></div>
        </header>

        <main className="pt-16 pb-20 px-4">
          <div className="bg-white rounded-lg p-6 mt-4">
            {/* アバター画像 */}
            <div className="mb-6 text-center">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                プロフィール画像
              </label>
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-gray-300 rounded-full overflow-hidden mx-auto mb-3">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="プロフィール画像プレビュー"
                      className="w-full h-full object-cover"
                    />
                  ) : authState.user.avatar ? (
                    <img
                      src={authState.user.avatar}
                      alt="現在のプロフィール画像"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  画像を選択
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                JPEGまたはPNG形式、5MB以下の画像をアップロードできます
              </p>
            </div>

            {/* メールアドレス表示 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <div className="p-3 bg-gray-100 rounded-lg text-gray-600">
                {authState.user.email}
              </div>
            </div>

            {/* 名前入力 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #2db5a5'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                placeholder="表示名を入力してください"
                maxLength={50}
              />
            </div>

            {/* ハンドル入力 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ユーザーハンドル <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 mr-1">@</span>
                <input
                  type="text"
                  value={formData.handle}
                  onChange={(e) => setFormData({ ...formData, handle: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #2db5a5'}
                  onBlur={(e) => e.target.style.boxShadow = 'none'}
                  placeholder="ユーザーハンドル"
                  maxLength={20}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                英数字とアンダースコアのみ使用可能です
              </p>
            </div>

            {/* 自己紹介入力 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                自己紹介
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #2db5a5'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                placeholder="自己紹介を入力してください"
                rows={4}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.bio.length}/200文字
              </p>
            </div>
          </div>
        </main>

        {/* フッターCTA */}
        <footer className="fixed bottom-0 w-full bg-white border-t p-4">
          <button
            onClick={handleSaveProfile}
            disabled={saving || !formData.name.trim() || !formData.handle.trim()}
            className="w-full p-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#2db5a5' }}
          >
            {saving ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                保存中...
              </div>
            ) : (
              '保存'
            )}
          </button>
        </footer>
      </div>
    )
  }

  // サインイン済み表示
  const user = authState.user!
  const isOwnProfile = true // 実際はログインユーザーと比較

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-50 px-4 py-3 h-16 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center"
          aria-label="戻る"
        >
          ←
        </button>
        <button
          onClick={handleShare}
          className=""
          style={{ color: '#2db5a5' }}
          aria-label="共有"
        >
          共有
        </button>
      </header>

      <main className="pt-16 pb-4">
        {/* プロフィール */}
        <div className="bg-white p-6">
          <div className="flex items-start space-x-4">
            <div className="w-20 h-20 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{user.name}</h1>
              <p className="text-gray-600">
                {user.handle ? `@${user.handle}` : user.email}
              </p>
            </div>
          </div>
          {user.bio && (
            <p className="mt-4 text-sm text-gray-700">{user.bio}</p>
          )}

          {/* アクションボタン */}
          <div className="mt-4">
            {isOwnProfile ? (
              <button
                onClick={handleEdit}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
              >
                プロフィールを編集
              </button>
            ) : (
              <button
                onClick={handleFollowToggle}
                className={`w-full p-3 rounded-lg font-medium transition-colors ${
                  user.isFollowing
                    ? 'bg-gray-200 text-gray-700'
                    : 'text-white'
                }`}
                style={!user.isFollowing ? { backgroundColor: '#2db5a5' } : {}}
              >
                {user.isFollowing ? 'フォロー中' : 'フォロー'}
              </button>
            )}
          </div>
        </div>

        {/* 統計 */}
        <div className="bg-white mt-2 p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <button
              onClick={() => handleStatClick('created')}
              className="focus:outline-none"
            >
              <div className="font-bold text-lg">{user.stats.createdRoutes}</div>
              <div className="text-xs text-gray-600">作成</div>
            </button>
            <button
              onClick={() => handleStatClick('completed')}
              className="focus:outline-none"
            >
              <div className="font-bold text-lg">{user.stats.completedRoutes}</div>
              <div className="text-xs text-gray-600">完了</div>
            </button>
            <button
              onClick={() => handleStatClick('followers')}
              className="focus:outline-none"
            >
              <div className="font-bold text-lg">{user.stats.followers}</div>
              <div className="text-xs text-gray-600">フォロワー</div>
            </button>
            <button
              onClick={() => handleStatClick('following')}
              className="focus:outline-none"
            >
              <div className="font-bold text-lg">{user.stats.following}</div>
              <div className="text-xs text-gray-600">フォロー中</div>
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="bg-white mt-2 border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('created')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'created'
                  ? 'text-gray-900 border-gray-900'
                  : 'text-gray-600 border-transparent'
              }`}
              style={activeTab === 'created' ? { color: '#2db5a5', borderColor: '#2db5a5' } : {}}
            >
              作成ルート
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'text-gray-900 border-gray-900'
                  : 'text-gray-600 border-transparent'
              }`}
              style={activeTab === 'completed' ? { color: '#2db5a5', borderColor: '#2db5a5' } : {}}
            >
              完了履歴
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'liked'
                  ? 'text-gray-900 border-gray-900'
                  : 'text-gray-600 border-transparent'
              }`}
              style={activeTab === 'liked' ? { color: '#2db5a5', borderColor: '#2db5a5' } : {}}
            >
              いいね
            </button>
          </div>
        </div>

        {/* タブコンテンツ */}
        <div className="px-4 pt-4">
          <div className="grid gap-4">
            {getTabContent().map((route) => (
              <button
                key={route.id}
                onClick={() => handleRouteClick(route.id)}
                className="bg-white rounded-lg shadow-sm overflow-hidden text-left"
              >
                <div className="h-32 bg-gray-300">
                  <img
                    src={route.cover}
                    alt={route.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-2">{route.title}</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      {getDurationText(route.duration)}
                    </span>
                    {route.completedAt && (
                      <span className="text-xs text-gray-500">
                        {route.completedAt}
                      </span>
                    )}
                    {route.likedAt && (
                      <span className="text-xs text-gray-500">
                        {route.likedAt}
                      </span>
                    )}
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
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}