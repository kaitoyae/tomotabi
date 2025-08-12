'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleGetStarted = () => {
    router.push('/home')
  }

  const handleLearnMore = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white shadow-sm z-50 px-4 py-3 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="/images/logo_tomotabi.png" 
            alt="トモタビ" 
            className="w-12 h-12 mr-2"
          />
          <h1 className="text-xl font-black">トモタビ</h1>
        </div>
        <button
          onClick={handleGetStarted}
          className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
          style={{ backgroundColor: '#2db5a5' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
        >
          はじめる
        </button>
      </header>

      {/* ヒーローセクション */}
      <section className="pt-20 pb-12 px-4">
        <div className="max-w-sm sm:max-w-md lg:max-w-2xl xl:max-w-4xl mx-auto text-left">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* ロゴ大 */}
            <div className="mb-6">
              <img 
                src="/images/logo_tomotabi.png" 
                alt="トモタビ" 
                className="w-24 h-24 mx-auto mb-4"
              />
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight">
              もう、<br />
              <span style={{ color: '#2db5a5' }}>「どこ行く？どう回る？」</span><br />
              で、立ち話が終わらない。
            </h1>
            
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-6 leading-relaxed">
              友達や恋人とのお出かけや旅行で、行きたい場所は出てくるのに、順番や移動時間の話で計画が止まってしまったことはありませんか？
            </p>
            
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed">
              トモタビは、スポットを地図上に並べるだけで、<span className="font-semibold text-gray-900">1分でお出かけ・旅行プランを作って友達と共有</span>できる完全無料サービスです。
            </p>

            <div className="mb-12">
              <button
                onClick={handleGetStarted}
                className="w-full py-4 text-white text-lg font-semibold rounded-lg transition-colors"
                style={{ backgroundColor: '#2db5a5' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
              >
                無料で始める
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 問題提起セクション */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-sm sm:max-w-md lg:max-w-4xl xl:max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-8">
            こんな経験、ありませんか？
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="bg-white rounded-lg p-5 shadow-sm">
              <div className="w-10 h-10 mx-auto mb-3 text-gray-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg lg:text-xl">プラン作成で消耗</h3>
              <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                GoogleマップとWebサイトを往復して、1時間も時間を無駄に
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-5 shadow-sm">
              <div className="w-10 h-10 mx-auto mb-3 text-gray-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7.5 8.25h9M7.5 12H12m-9.75 7.5h15.75a2.25 2.25 0 0 0 2.25-2.25V6.375a2.25 2.25 0 0 0-2.25-2.25H5.25a2.25 2.25 0 0 0-2.25 2.25v10.125a2.25 2.25 0 0 0 2.25 2.25Z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg lg:text-xl">共有が面倒</h3>
              <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                スクショを何枚も送ったり、長文メッセージで場所の説明
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-5 shadow-sm">
              <div className="w-10 h-10 mx-auto mb-3 text-gray-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg lg:text-xl">情報が散在</h3>
              <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                口コミサイトの情報は古いし、本当におすすめか分からない
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ソリューションセクション */}
      <section id="how-it-works" className="py-12 px-4">
        <div className="max-w-sm sm:max-w-md lg:max-w-4xl xl:max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-4">
              トモタビで、すべて解決
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600">
              お出かけ・旅行プランを1分で作って、友達と共有。現地ではナビ機能で迷わず歩ける。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* ステップ1 */}
            <div className="text-center">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#2db5a540' }}
              >
                <span className="text-xl font-black" style={{ color: '#2db5a5' }}>1</span>
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-3">1分でプラン作成</h3>
              <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                地図上でスポットをタップして順番を並べるだけ。所要時間も自動計算。
              </p>
            </div>

            {/* ステップ2 */}
            <div className="text-center">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#e8a83560' }}
              >
                <span className="text-xl font-black" style={{ color: '#e8a835' }}>2</span>
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-3">友達と簡単共有</h3>
              <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                LINEでリンクを送るだけ。友達はログイン不要ですぐ見れる。
              </p>
            </div>

            {/* ステップ3 */}
            <div className="text-center">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#2db5a540' }}
              >
                <span className="text-xl font-black" style={{ color: '#2db5a5' }}>3</span>
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-3">現地でナビ機能</h3>
              <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                次のスポットまで案内。到着したら写真を撮って思い出も記録。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-sm sm:max-w-md lg:max-w-4xl xl:max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center text-gray-900 mb-8">
            さらに、こんな使い方も
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="flex items-start space-x-4">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{ backgroundColor: '#2db5a540' }}
              >
                <svg className="w-4 h-4" style={{ color: '#2db5a5' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg lg:text-xl">ルートSNSとして公開</h3>
                <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                  作ったプランは一般公開も可能。他の人の「いいね」やフォローがつきます。
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{ backgroundColor: '#e8a83560' }}
              >
                <svg className="w-4 h-4" style={{ color: '#e8a835' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg lg:text-xl">リミックス機能</h3>
                <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                  他の人のルートをベースに、1〜2スポット変更して自分版を作成できます。
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{ backgroundColor: '#2db5a540' }}
              >
                <svg className="w-4 h-4" style={{ color: '#2db5a5' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg lg:text-xl">地域の案内人に</h3>
                <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                  人気作成者は、その地域やテーマの"案内人"としてフォロワーを獲得できます。
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm text-center mt-8 lg:col-span-2">
              <div className="space-y-4">
                <div className="w-12 h-12 mx-auto text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                    <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
                  </svg>
                </div>
                <h3 className="text-xl lg:text-2xl font-semibold text-gray-900">
                  個人の視点で切り取った<br />
                  まち・旅プランを交換
                </h3>
                <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                  身近な友達とのお出かけにも、知らない人との発見にも使える。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 最終CTAセクション */}
      <section className="py-12 px-4">
        <div className="max-w-sm sm:max-w-md lg:max-w-2xl xl:max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-4">
            さあ、新しい旅をはじめよう
          </h2>
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-8">
            トモタビは完全無料。今すぐプランを作って、友達と共有してみませんか？
          </p>
          
          <button
            onClick={handleGetStarted}
            className="w-full py-4 text-white text-lg font-semibold rounded-lg transition-colors mb-4"
            style={{ backgroundColor: '#2db5a5' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#239b8f'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2db5a5'}
          >
            無料ではじめる
          </button>

          <p className="text-sm text-gray-500">
            登録不要で今すぐ使えます
          </p>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-gray-900 text-white py-8 px-4">
        <div className="max-w-sm sm:max-w-md lg:max-w-2xl xl:max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img 
              src="/images/logo_tomotabi.png" 
              alt="トモタビ" 
              className="w-8 h-8"
            />
            <span className="text-lg font-black">トモタビ</span>
          </div>
          <p className="text-gray-400 text-sm mb-4 leading-relaxed">
            お出かけ・旅行プランを1分で作って友達と共有
          </p>
          <p className="text-gray-600 text-xs">
            © 2024 トモタビ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}