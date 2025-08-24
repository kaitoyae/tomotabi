# Phase 2: API制御システム移行の詳細分析

## 🔍 調査結果サマリー

### 移行対象コンポーネント（約64行）
1. **safeApiCall関数** (313-366行, 54行)
2. **グローバルAPI制御変数** (308-310行, 3行)
3. **デバウンス制御変数** (303, 305行, 2行)
4. **地図移動状態** (304行, 1行)
5. **関連ハンドラー関数** (約10行)

### 使用箇所と依存関係
1. **loadSpots関数** - safeApiCallを使用（372行）
2. **loadSpotsForMapBounds関数** - safeApiCallを使用（733行）
3. **handleMapMoveStart関数** - isMapMoving制御（806-820行）
4. **updateSpotsOnMapMove関数** - デバウンス・地図連携（822-853行）
5. **地図初期化useEffect** - クリーンアップ処理（1415-1426行）
6. **UIボタン** - API状態チェック（1966-1991行）

## ⚠️ 危険なポイント

### 1. 🔴 **useRefの参照保持問題**（高リスク）
- `isApiCallInProgress.current`が複数箇所で直接参照される
- hookに移行時、参照の一貫性を保つ必要がある
- 解決策: useRefはhook内で管理し、状態取得関数を提供

### 2. 🟡 **非同期処理の競合状態**（中リスク）
- safeApiCall内で自己再帰呼び出し（329, 339行）
- キューイング処理とタイミング制御が複雑
- 解決策: 内部実装を慎重に移行、テスト強化

### 3. 🟡 **地図イベントとの密結合**（中リスク）
- handleMapMoveStartがsetIsMapMovingを直接呼び出し
- updateSpotsOnMapMoveがloadSpotsForMapBoundsを呼び出し
- 解決策: 地図操作フラグのみhookで管理、地図イベント自体は残す

### 4. 🟢 **クリーンアップ処理**（低リスク）
- タイマーのクリアが複数箇所に分散（811-817, 1415-1421行）
- 解決策: hook内でクリーンアップ関数を提供

### 5. 🟢 **UI状態チェック**（低リスク）
- ボタンのdisabled状態がisApiCallInProgress.currentを参照
- 解決策: 状態取得関数を提供

## 📋 推奨移行計画

### Step 1: useApiController hookの作成
```typescript
export const useApiController = () => {
  // グローバルAPI制御
  const isApiCallInProgress = useRef<boolean>(false)
  const apiCallQueue = useRef<Array<() => Promise<void>>>([])
  const lastApiCallTime = useRef<number>(0)
  
  // デバウンス制御
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mapMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 地図移動状態
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false)
  
  // safeApiCall実装
  // その他の関数
  
  return {
    // 関数
    safeApiCall,
    handleMapMoveStart,
    updateSpotsOnMapMove,
    
    // 状態取得
    getIsApiCallInProgress: () => isApiCallInProgress.current,
    getIsMapMoving: () => isMapMoving,
    
    // クリーンアップ
    cleanup
  }
}
```

### Step 2: 段階的移行
1. **最初に**: safeApiCall関数のみ移行
2. **次に**: handleMapMoveStart/updateSpotsOnMapMove移行
3. **最後に**: クリーンアップ処理統合

### Step 3: 依存関係の更新
1. loadSpots/loadSpotsForMapBoundsの依存配列更新
2. useEffectの依存関係更新
3. UIボタンの状態チェック更新

## ✅ 安全性確保のための対策

1. **テスト重視**: 各ステップで動作確認
2. **ログ保持**: console.logはそのまま残す
3. **段階的移行**: 一度に全部移行しない
4. **バックアップ**: 元のコードを一時的に残す
5. **状態確認**: DevToolsでuseRef値を監視

## 📊 期待される効果
- **削減行数**: 約100-150行（重複コード削除含む）
- **保守性向上**: API制御ロジックの集約
- **テスト容易性**: hook単体でのテスト可能