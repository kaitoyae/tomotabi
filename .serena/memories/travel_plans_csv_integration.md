# Travel Plans CSV統合仕様

## データ構造
- **CSVファイル**: `public/travel_plans.csv`（5,219行）
- **総プラン数**: 1,001件
- **列構成**: 14列（plan_id列が追加）

## CSVフォーマット
```
plan_title,plan_id,plan_duration,plan_tags,plan_author,plan_cover,plan_day_breaks,spot_name,spot_lat,spot_lng,spot_photo,spot_comment,spot_stay_time,spot_is_accommodation
```

## 技術実装

### CSVパーサー (`app/lib/mock-api.ts`)
- **グループ化**: `plan_id`ベース（名前重複解決）
- **Route ID**: `plan-{plan_id}`
- **Spot ID**: `plan-{plan_id}-spot-{index}`
- **表示件数**: 100プラン

### 型定義
```typescript
type CSVRow = {
  plan_title: string
  plan_id: string        // 新規追加
  plan_duration: string  // '90m'|'half'|'day'|'2days'|'3days'|'4days'|'5days'|'7days'
  // ... 他フィールド
}
```

### API統合
- `listRecommendedRoutes()`: ダミー3件 + CSV100件
- `getRoute(id)`: plan_id対応検索
- キャッシュ機能: 初回読み込み後メモリ保持

## UI表示
- **ホーム画面**: ボトムシート「おすすめルート」に表示
- **表示制限**: 100件（パフォーマンス考慮）
- **範囲フィルタリング**: 無効化（全国対応）

## テストツール
- `/test-new-csv`: 統合状況確認
- `/debug-csv`: CSVファイル診断

## データ例
```
東京郊外文化体験3泊4日,1,4days,文化|寺社|テーマパーク|宿泊,草愛好家,...
```

1000プランの旅行データが正常にアプリに統合済み。