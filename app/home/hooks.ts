// app/home/hooks.ts
// カスタムhooks・ビジネスロジックファイル（200行以下）

import { useState, useRef, useCallback, useEffect } from 'react'

// ブラウザ環境チェック関数
const isClientSide = () => {
  return typeof window !== 'undefined'
}

// レスポンシブタグスクロール機能のカスタムhook
export const useResponsiveTagScroll = () => {
  const [visibleTagCount, setVisibleTagCount] = useState<number>(8) // コンパクトモバイルデフォルト
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false)
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true)
  const tagScrollRef = useRef<HTMLDivElement>(null)

  const updateVisibleTagCount = useCallback(() => {
    if (!isClientSide()) return
    
    const width = window.innerWidth
    if (width >= 1024) { // PC - コンパクト版で全部表示
      setVisibleTagCount(16) 
    } else if (width >= 768) { // タブレット - コンパクトで多め表示
      setVisibleTagCount(14)
    } else if (width >= 640) { // 大きめモバイル - コンパクトで効率的
      setVisibleTagCount(10)
    } else { // 小さなモバイル - コンパクトでも見やすく
      setVisibleTagCount(8)
    }
  }, [])

  const updateScrollButtons = useCallback(() => {
    if (!tagScrollRef.current) return
    
    const { scrollLeft, scrollWidth, clientWidth } = tagScrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  const scrollTags = useCallback((direction: 'left' | 'right') => {
    if (!tagScrollRef.current) return
    
    const scrollAmount = isClientSide() && window.innerWidth >= 768 ? 200 : 120
    const targetScroll = direction === 'left' 
      ? tagScrollRef.current.scrollLeft - scrollAmount
      : tagScrollRef.current.scrollLeft + scrollAmount
    
    tagScrollRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    })
  }, [])

  // レスポンシブタグチップの初期化とリサイズ対応
  useEffect(() => {
    if (!isClientSide()) return

    // 初期設定
    updateVisibleTagCount()
    
    const handleResize = () => {
      updateVisibleTagCount()
      setTimeout(updateScrollButtons, 100) // DOM更新後にスクロール状態チェック
    }

    const handleScroll = () => {
      updateScrollButtons()
    }

    // リサイズイベント
    window.addEventListener('resize', handleResize)
    
    // スクロールイベント
    if (tagScrollRef.current) {
      tagScrollRef.current.addEventListener('scroll', handleScroll, { passive: true })
    }

    // 初期スクロール状態チェック
    setTimeout(updateScrollButtons, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (tagScrollRef.current) {
        tagScrollRef.current.removeEventListener('scroll', handleScroll)
      }
    }
  }, [updateVisibleTagCount, updateScrollButtons])

  return {
    visibleTagCount,
    canScrollLeft,
    canScrollRight,
    tagScrollRef,
    scrollTags
  }
}

// シート表示状態管理のカスタムhook
export const useSheetVisibility = () => {
  const [showCategorySheet, setShowCategorySheet] = useState<boolean>(false)
  const [areaSheetVisible, setAreaSheetVisible] = useState<boolean>(false)
  const [showRoutesSheet, setShowRoutesSheet] = useState<boolean>(false)

  // カテゴリーシート制御
  const openCategorySheet = useCallback(() => {
    setShowCategorySheet(true)
  }, [])

  const closeCategorySheet = useCallback(() => {
    setShowCategorySheet(false)
  }, [])

  // エリアシート制御
  const openAreaSheet = useCallback(() => {
    setAreaSheetVisible(true)
  }, [])

  const closeAreaSheet = useCallback(() => {
    setAreaSheetVisible(false)
  }, [])

  // ルート一覧シート制御
  const openRoutesSheet = useCallback(() => {
    setShowRoutesSheet(true)
  }, [])

  const closeRoutesSheet = useCallback(() => {
    setShowRoutesSheet(false)
  }, [])

  return {
    // 状態
    showCategorySheet,
    areaSheetVisible, 
    showRoutesSheet,
    // アクション
    openCategorySheet,
    closeCategorySheet,
    openAreaSheet,
    closeAreaSheet,
    openRoutesSheet,
    closeRoutesSheet
  }
}

// 検索入力状態管理のカスタムhook
export const useSearchInput = () => {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [areaSearchQuery, setAreaSearchQuery] = useState<string>('')

  // 検索クエリ更新
  const updateSearchQuery = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  // 検索クエリクリア
  const clearSearchQuery = useCallback(() => {
    setSearchQuery('')
  }, [])

  // カテゴリー選択更新
  const updateSelectedCategory = useCallback((category: string | null) => {
    setSelectedCategory(category)
  }, [])

  // エリア検索クエリ更新
  const updateAreaSearchQuery = useCallback((value: string) => {
    setAreaSearchQuery(value)
  }, [])

  // エリア検索クエリクリア
  const clearAreaSearchQuery = useCallback(() => {
    setAreaSearchQuery('')
  }, [])

  return {
    // 状態
    searchQuery,
    selectedCategory,
    areaSearchQuery,
    // アクション
    updateSearchQuery,
    clearSearchQuery,
    updateSelectedCategory,
    updateAreaSearchQuery,
    clearAreaSearchQuery
  }
}

// TODO: app/home/page.tsx からカスタムhooksを移動予定
// - 地図状態管理hooks
// - スポット検索hooks  
// - ルート作成hooks
// - フィルター管理hooks
// - その他ビジネスロジック

// プレースホルダーhook（削除予定）
export const usePlaceholder = () => {
  // 段階2で実際のhooksに置き換えられます
  return {}
}