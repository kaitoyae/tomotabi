// app/home/utils.ts
// ユーティリティ関数・ヘルパー関数ファイル（100行以下）
// ⚠️ 分割作業中 - 段階的に移行中

// 所要時間を適切な単位で表示するヘルパー関数
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}分`
  } else if (minutes < 1440) { // 24時間未満
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
      return `${hours}時間`
    } else {
      return `${hours}時間${mins}分`
    }
  } else { // 24時間以上
    const days = Math.floor(minutes / 1440)
    const remainingMinutes = minutes % 1440
    if (remainingMinutes === 0) {
      return `${days}日`
    } else {
      const hours = Math.floor(remainingMinutes / 60)
      const mins = remainingMinutes % 60
      if (hours === 0) {
        return `${days}日${mins}分`
      } else if (mins === 0) {
        return `${days}日${hours}時間`
      } else {
        return `${days}日${hours}時間${mins}分`
      }
    }
  }
}

// TODO: 残りのユーティリティ関数を順次移動予定
// - getMarkerIcon
// - parseNaturalText  
// - distributeSpotsByGrid
// - その他ヘルパー関数

// プレースホルダー関数（削除予定）
export const placeholderUtilFunction = () => {
  // 段階2で実際のユーティリティ関数に置き換えられます
  return {}
}