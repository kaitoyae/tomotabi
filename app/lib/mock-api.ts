// 型定義
export type Spot = {
  id: string
  name: string
  lat: number
  lng: number
  photo?: string
  comment?: string
  isAccommodation?: boolean // 宿泊施設フラグ
}

export type SegmentMode = 'walking' | 'driving' | 'transit'

export type Segment = {
  id: string
  fromSpotId: string
  toSpotId: string
  mode: SegmentMode
  distanceM?: number
  durationS?: number
  osrm?: {
    routes: Array<{
      geometry: any
      distance: number
      duration: number
    }>
    selectedIndex: number
  }
}

export type Route = {
  id: string
  title: string
  duration: '90m' | 'half' | 'day' | '2days' | '3days' | '4days' | '5days' | '7days'
  tags: string[]
  author: string
  cover: string
  spots: Spot[]
  segments?: Segment[]
  dayBreaks?: number[] // 日付区切りの位置（スポットインデックス）
}

// ダミーデータ
const DUMMY_SPOTS: Record<string, Spot[]> = {
  '1': [
    { id: 's1-1', name: '浅草寺', lat: 35.7148, lng: 139.7967, photo: '/spot1.jpg', comment: '東京最古のお寺。雷門が有名' },
    { id: 's1-2', name: '仲見世通り', lat: 35.7112, lng: 139.7963, comment: '浅草寺に続く商店街' },
    { id: 's1-3', name: 'かっぱ橋道具街', lat: 35.7143, lng: 139.7888, photo: '/spot3.jpg' },
    { id: 's1-4', name: '浅草花やしき', lat: 35.7156, lng: 139.7944, comment: '日本最古の遊園地' },
    { id: 's1-5', name: '浅草文化観光センター', lat: 35.7107, lng: 139.7953, photo: '/spot5.jpg', comment: '展望テラスからの眺めが最高' }
  ],
  '2': [
    { id: 's2-1', name: 'ブルーボトルコーヒー', lat: 35.7000, lng: 139.7710, photo: '/coffee1.jpg', comment: 'サードウェーブコーヒーの代表格' },
    { id: 's2-2', name: 'スターバックス リザーブ', lat: 35.6762, lng: 139.7642, comment: '特別なコーヒー体験' },
    { id: 's2-3', name: 'カフェ・ド・ロペ', lat: 35.6891, lng: 139.7033, photo: '/coffee3.jpg' },
    { id: 's2-4', name: '猿田彦珈琲', lat: 35.6654, lng: 139.7301, comment: '日本発のスペシャルティコーヒー' }
  ],
  '3': [
    { id: 's3-1', name: '東京タワー', lat: 35.6586, lng: 139.7454, photo: '/night1.jpg', comment: '東京のシンボル' },
    { id: 's3-2', name: 'レインボーブリッジ', lat: 35.6367, lng: 139.7635, comment: '夜のライトアップが美しい' },
    { id: 's3-3', name: '六本木ヒルズ展望台', lat: 35.6605, lng: 139.7292, photo: '/night3.jpg' },
    { id: 's3-4', name: '東京スカイツリー', lat: 35.7101, lng: 139.8107, comment: '634mの高さから東京を一望' },
    { id: 's3-5', name: 'お台場海浜公園', lat: 35.6280, lng: 139.7767, photo: '/night5.jpg' },
    { id: 's3-6', name: '晴海埠頭', lat: 35.6513, lng: 139.7821, comment: '穴場の夜景スポット' }
  ]
}

const DUMMY_ROUTES: Route[] = [
  {
    id: '1',
    title: '下町レトロ散歩',
    duration: '90m',
    tags: ['歴史', 'グルメ', '商店街'],
    author: '田中太郎',
    cover: '/route1-cover.jpg',
    spots: DUMMY_SPOTS['1']
  },
  {
    id: '2',
    title: 'カフェ巡りコース',
    duration: 'half',
    tags: ['カフェ', 'スイーツ', 'おしゃれ'],
    author: '佐藤花子',
    cover: '/route2-cover.jpg',
    spots: DUMMY_SPOTS['2']
  },
  {
    id: '3',
    title: '夜景スポット巡り',
    duration: 'day',
    tags: ['夜景', '写真', 'デート'],
    author: '鈴木一郎',
    cover: '/route3-cover.jpg',
    spots: DUMMY_SPOTS['3']
  }
]

// CSVデータ変換関数
type CSVRow = {
  plan_title: string
  plan_id: string
  plan_duration: string
  plan_tags: string
  plan_author: string
  plan_cover: string
  plan_day_breaks: string
  spot_name: string
  spot_lat: string
  spot_lng: string
  spot_photo: string
  spot_comment: string
  spot_stay_time: string
  spot_is_accommodation: string
}

// 正確なCSVパーサー
const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

const parseCSVRoutes = async (): Promise<Route[]> => {
  console.log('🔄 CSV解析開始...')
  try {
    const response = await fetch('/travel_plans_updated.csv')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    let csvText = await response.text()
    console.log('📄 CSV読み込み完了:', csvText.length, '文字')
    
    // BOMを除去
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1)
    }
    
    const lines = csvText.trim().split('\n')
    console.log('📊 CSV行数:', lines.length)
    
    if (lines.length < 2) {
      throw new Error('CSVデータが不十分です')
    }
    
    const headers = parseCSVLine(lines[0])
    console.log('📋 ヘッダー:', headers)
    
    // plan_idごとにグループ化
    const planGroups: Record<string, CSVRow[]> = {}
    let successfulParsedRows = 0
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i])
        if (values.length < 14) {
          console.warn(`⚠️ 行${i}: カラム数が不足 (${values.length}/14)`)
          continue
        }
        
        const row: CSVRow = {
          plan_title: values[0] || '',
          plan_id: values[1] || '',
          plan_duration: values[2] || '90m',
          plan_tags: values[3] || '',
          plan_author: values[4] || '',
          plan_cover: values[5] || '',
          plan_day_breaks: values[6] || '',
          spot_name: values[7] || '',
          spot_lat: values[8] || '0',
          spot_lng: values[9] || '0',
          spot_photo: values[10] || '',
          spot_comment: values[11] || '',
          spot_stay_time: values[12] || '60',
          spot_is_accommodation: values[13] || 'false'
        }
        
        // plan_idをキーとしてグループ化
        if (!planGroups[row.plan_id]) {
          planGroups[row.plan_id] = []
        }
        planGroups[row.plan_id].push(row)
        successfulParsedRows++
      } catch (error) {
        console.warn(`⚠️ 行${i}のパースに失敗:`, error)
      }
    }
    
    console.log('✅ パース成功行数:', successfulParsedRows)
    console.log('📁 プラン数:', Object.keys(planGroups).length)
    
    // Route型に変換
    const routes: Route[] = []
    
    for (const [planId, spotRows] of Object.entries(planGroups)) {
      if (spotRows.length === 0) continue
      
      const firstRow = spotRows[0]
      const spots: Spot[] = spotRows.map((row, index) => ({
        id: `plan-${planId}-spot-${index}`,
        name: row.spot_name,
        lat: parseFloat(row.spot_lat) || 35.6812, // デフォルト座標（東京）
        lng: parseFloat(row.spot_lng) || 139.7671,
        photo: row.spot_photo || undefined,
        comment: row.spot_comment || undefined,
        isAccommodation: row.spot_is_accommodation.toLowerCase() === 'true'
      }))
      
      // dayBreaksの処理
      const dayBreaks = firstRow.plan_day_breaks
        ? firstRow.plan_day_breaks.split('|').map(Number).filter(n => !isNaN(n))
        : undefined
      
      const route: Route = {
        id: `plan-${planId}`,
        title: firstRow.plan_title,
        duration: firstRow.plan_duration as Route['duration'],
        tags: firstRow.plan_tags.split('|').filter(tag => tag.trim() !== ''),
        author: firstRow.plan_author,
        cover: firstRow.plan_cover,
        spots: spots,
        dayBreaks: dayBreaks
      }
      
      routes.push(route)
    }
    
    console.log('🗺️ 生成されたルート数:', routes.length)
    console.log('📝 最初の3ルート:', routes.slice(0, 3).map(r => ({ id: r.id, title: r.title, spots: r.spots.length })))
    
    return routes
  } catch (error) {
    console.error('❌ CSV parsing error:', error)
    return []
  }
}

// キャッシュされたCSVルート（強制リセット）
let csvRoutesCache: Route[] | null = null
let forceReloadDone = false

// キャッシュを強制クリアする関数
export const clearCache = () => {
  csvRoutesCache = null
  forceReloadDone = false
  console.log('🗑️ CSVキャッシュをクリアしました')
}

// モックAPI関数
export const listRecommendedRoutes = async (): Promise<Route[]> => {
  console.log('🔄 listRecommendedRoutes 開始')
  await new Promise(r => setTimeout(r, 400))
  
  // 強制的に新しいCSVデータを読み込み（デバッグ用）
  console.log('🔄 CSV強制再読み込み...')
  csvRoutesCache = await parseCSVRoutes()
  console.log('✅ CSVキャッシュ作成完了:', csvRoutesCache.length, '件')
  
  // 最初の5件の詳細情報をログ出力
  if (csvRoutesCache.length > 0) {
    console.log('📋 最初の5件のルート詳細:')
    csvRoutesCache.slice(0, 5).forEach((route, index) => {
      console.log(`  ${index + 1}. ${route.title} (ID: ${route.id})`)
      console.log(`     スポット数: ${route.spots.length}`)
      console.log(`     最初のスポット座標: ${route.spots[0]?.lat}, ${route.spots[0]?.lng}`)
      console.log(`     作者: ${route.author}`)
    })
  }
  
  // CSVルート100件を既存データと結合（1000プランから厳選）
  const csvRoutes = csvRoutesCache.slice(0, 100)
  const result = [...DUMMY_ROUTES, ...csvRoutes]
  
  console.log('📊 返却データ:', {
    ダミー: DUMMY_ROUTES.length,
    CSV: csvRoutes.length,
    合計: result.length,
    CSVタイトル: csvRoutes.map(r => r.title).slice(0, 3)
  })
  
  return result
}

export const getRoute = async (id: string): Promise<Route> => {
  await new Promise(r => setTimeout(r, 400))
  
  // 既存のダミーデータから検索
  let route = DUMMY_ROUTES.find(r => r.id === id)
  
  // CSVデータからも検索
  if (!route) {
    if (!csvRoutesCache) {
      csvRoutesCache = await parseCSVRoutes()
    }
    route = csvRoutesCache.find(r => r.id === id)
  }
  
  if (!route) {
    throw new Error('ルートが見つかりません')
  }
  return route
}

export const saveRoute = async (route: Omit<Route, 'id'>): Promise<{ id: string }> => {
  await new Promise(r => setTimeout(r, 400))
  const newId = `r${Date.now()}`
  return { id: newId }
}

export const sendApplause = async (id: string): Promise<void> => {
  await new Promise(r => setTimeout(r, 400))
  console.log(`Applause sent for route: ${id}`)
}

export const publishRemix = async (route: Omit<Route, 'id'>): Promise<{ id: string }> => {
  await new Promise(r => setTimeout(r, 400))
  const remixId = `remix-${Date.now()}`
  return { id: remixId }
}

// OSRM API経路計算
export const calculateRoute = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: 'walking' | 'driving'
): Promise<{
  routes: Array<{
    geometry: any
    distance: number
    duration: number
  }>
}> => {
  const profile = mode === 'walking' ? 'foot' : 'car'
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.code === 'Ok' && data.routes) {
      return {
        routes: data.routes.map((route: any) => ({
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration
        }))
      }
    }
  } catch (error) {
    console.error('OSRM API error:', error)
  }
  
  // フォールバック: ダミーデータ
  const distance = Math.sqrt(
    Math.pow((to.lat - from.lat) * 111000, 2) + 
    Math.pow((to.lng - from.lng) * 111000, 2)
  )
  const speed = mode === 'walking' ? 5 : 30 // km/h
  const duration = (distance / 1000) / speed * 3600 // seconds
  
  return {
    routes: [{
      geometry: {
        type: 'LineString',
        coordinates: [[from.lng, from.lat], [to.lng, to.lat]]
      },
      distance,
      duration
    }]
  }
}

// セグメント生成（最適化版）
export const generateSegments = async (
  spots: Spot[],
  mode: SegmentMode = 'walking'
): Promise<Segment[]> => {
  const segments: Segment[] = []
  
  if (spots.length < 2) return segments

  // まず即座にプレースホルダーを生成
  for (let i = 0; i < spots.length - 1; i++) {
    const from = spots[i]
    const to = spots[i + 1]
    
    if (mode === 'transit') {
      segments.push({
        id: `seg-${i}`,
        fromSpotId: from.id,
        toSpotId: to.id,
        mode: 'transit'
      })
    } else {
      // フォールバック距離・時間を即座に計算
      const distance = Math.sqrt(
        Math.pow((to.lat - from.lat) * 111000, 2) + 
        Math.pow((to.lng - from.lng) * 111000, 2)
      )
      const speed = mode === 'walking' ? 5 : 30 // km/h
      const duration = (distance / 1000) / speed * 3600 // seconds
      
      segments.push({
        id: `seg-${i}`,
        fromSpotId: from.id,
        toSpotId: to.id,
        mode,
        distanceM: distance,
        durationS: duration,
        osrm: {
          routes: [{
            geometry: {
              type: 'LineString',
              coordinates: [[from.lng, from.lat], [to.lng, to.lat]]
            },
            distance,
            duration
          }],
          selectedIndex: 0
        }
      })
    }
  }

  // バックグラウンドでOSRM APIを呼び出して更新（UIブロッキングしない）
  if (mode !== 'transit') {
    Promise.all(
      segments.map(async (segment, index) => {
        try {
          const from = spots[index]
          const to = spots[index + 1]
          const routeData = await calculateRoute(
            { lat: from.lat, lng: from.lng },
            { lat: to.lat, lng: to.lng },
            mode
          )
          return {
            ...segment,
            distanceM: routeData.routes[0]?.distance,
            durationS: routeData.routes[0]?.duration,
            osrm: {
              routes: routeData.routes,
              selectedIndex: 0
            }
          }
        } catch {
          return segment // エラー時は既存のフォールバックを使用
        }
      })
    ).then(updatedSegments => {
      // 更新されたセグメントをリアルタイムで反映する仕組みは親コンポーネント側で実装
      console.log('OSRM data updated:', updatedSegments)
    })
  }
  
  return segments
}

// 個別セグメント更新（リアルタイム更新用）
export const updateSegmentMode = async (
  segment: Segment,
  fromSpot: Spot,
  toSpot: Spot,
  newMode: SegmentMode
): Promise<Segment> => {
  if (newMode === 'transit') {
    return {
      ...segment,
      mode: 'transit',
      distanceM: undefined,
      durationS: undefined,
      osrm: undefined
    }
  }

  // フォールバック値を即座に計算
  const distance = Math.sqrt(
    Math.pow((toSpot.lat - fromSpot.lat) * 111000, 2) + 
    Math.pow((toSpot.lng - fromSpot.lng) * 111000, 2)
  )
  const speed = newMode === 'walking' ? 5 : 30
  const duration = (distance / 1000) / speed * 3600

  const updatedSegment: Segment = {
    ...segment,
    mode: newMode,
    distanceM: distance,
    durationS: duration,
    osrm: {
      routes: [{
        geometry: {
          type: 'LineString',
          coordinates: [[fromSpot.lng, fromSpot.lat], [toSpot.lng, toSpot.lat]]
        },
        distance,
        duration
      }],
      selectedIndex: 0
    }
  }

  // バックグラウンドでOSRM APIを呼び出し
  try {
    const routeData = await calculateRoute(
      { lat: fromSpot.lat, lng: fromSpot.lng },
      { lat: toSpot.lat, lng: toSpot.lng },
      newMode
    )
    updatedSegment.distanceM = routeData.routes[0]?.distance
    updatedSegment.durationS = routeData.routes[0]?.duration
    updatedSegment.osrm = {
      routes: routeData.routes,
      selectedIndex: 0
    }
  } catch (error) {
    console.error('OSRM update error:', error)
  }

  return updatedSegment
}