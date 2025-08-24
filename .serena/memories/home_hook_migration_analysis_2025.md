# Home Hook移行分析レポート（2025-08-24）

## 移行状況サマリー
- **現在のファイルサイズ**: page.tsx 2,492行 → 目標 500行以下
- **移行完了**: 9つのhook（基本状態管理・ビジネスロジック）
- **未移行**: 約2,000行（主に地図関連の複雑な処理）

## 移行完了済みHook（9つ）
1. useResponsiveTagScroll - レスポンシブタグスクロール
2. useLocationState - 位置情報基本状態管理
3. useSheetVisibility - シート表示状態管理
4. useSearchInput - 検索入力状態管理
5. useSpotState - スポット管理基本状態
6. useSpotBusinessLogic - スポットビジネスロジック
7. useCategoryAreaState - カテゴリー・エリア選択状態
8. useCategoryAreaBusinessLogic - カテゴリー・エリア選択ビジネスロジック
9. useSpotFetching - スポット取得API

## 残存処理の詳細分析

### 1. 地図インスタンス管理（最も複雑・高リスク）
- **規模**: 11個のuseEffect + 複数のuseRef
- **複雑度**: ★★★★★
- **処理内容**: MapLibre GL JS初期化・マーカー管理・イベント処理・デバイス対応

### 2. 検索チップ・フィルター機能（中程度）
- **規模**: searchChips, filterState + 関連ロジック
- **複雑度**: ★★★☆☆  
- **処理内容**: 検索チップ管理・自然文パース・県境ハイライト

### 3. API呼び出し制御システム（技術的に複雑）
- **規模**: レート制限・キューイング・非同期制御
- **複雑度**: ★★★★☆
- **処理内容**: safeApiCall・レート制限回避・デバウンス制御

### 4. UI統合ラッパー関数群（比較的単純）
- **規模**: 各種ハンドラー関数
- **複雑度**: ★★☆☆☆
- **処理内容**: UI統合処理・イベントハンドラー

## 推奨移行計画（4Phase）

### Phase 1: 低リスク機能（300-400行削減）
1. **useUIWrapperFunctions** (100行) - UI統合ラッパー関数群
2. **useSearchChipsFilter** (200行) - 検索チップ・フィルター機能

### Phase 2: API制御システム（400-500行削減）
3. **useApiController** (400行) - safeApiCall・レート制限制御

### Phase 3: 地図システム分割（800-1,000行削減）
4. **useMapReferences** (150行) - useRef群管理
5. **useMapInitialization** (300行) - 地図初期化ロジック  
6. **useMapMarkers** (200行) - マーカー管理
7. **useMapEvents** (300行) - 地図イベント処理

## 重要な注意点
- **一度に1つのhookのみ移行**
- **各移行後は必ず動作確認**
- **地図機能は特に入念なテスト**
- **依存関係管理の徹底**

## 期待成果
- **最終目標**: 2,492行 → 500行以下（約80%削減）
- **保守性大幅向上**
- **関心の分離完了**