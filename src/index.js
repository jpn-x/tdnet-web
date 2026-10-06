/**
 * TDnet 開示情報リアルタイム — 1 Worker 構成
 *  - 画面(docs/)は Workers Static Assets が配信
 *  - /api/disclosures だけこの Worker が処理(TDnet の公開ページを取得して JSON にする)
 *  - 結果をメモリにキャッシュして TDnet への取得回数を抑える(今日分 60 秒 / 過去日付 1 時間)
 *  - TDnet が落ちている時は、直前に取れた結果を返す
 * 出典: 東京証券取引所 TDnet(適時開示情報閲覧サービス)
 */

const BASE_URL = 'https://www.release.tdnet.info'
const MAIN_URL = `${BASE_URL}/inbs/I_main_00.html`
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en;q=0.5',
}
const MAX_PAGES = 30 // Workers 無料枠の subrequest 上限(50)に収める
const TTL_TODAY_MS = 60 * 1000
const TTL_PAST_MS = 60 * 60 * 1000

// isolate ごとのメモリキャッシュ。key -> { at, body }
const cache = new Map()

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/api/disclosures') return env.ASSETS.fetch(request)
    if (request.method !== 'GET') return json({ error: 'method not allowed', items: [], pages: 0 }, 405)

    const date = /^\d{8}$/.test(url.searchParams.get('date') || '') ? url.searchParams.get('date') : ''
    const allPages = url.searchParams.get('all') !== '0'
    const isToday = !date || date === todayJST()
    const key = `${isToday ? 'today' : date}:${allPages ? 'all' : 'p1'}`
    const ttl = isToday ? TTL_TODAY_MS : TTL_PAST_MS

    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < ttl) return json(hit.body, 200, 'HIT', Math.ceil((ttl - (Date.now() - hit.at)) / 1000))

    try {
      const body = await scrape(date, allPages)
      cache.set(key, { at: Date.now(), body })
      return json(body, 200, 'MISS', Math.ceil(ttl / 1000))
    } catch (e) {
      console.error('scrape error:', e)
      if (hit) return json(hit.body, 200, 'STALE', 10) // 取得に失敗したら古い結果で凌ぐ
      return json({ error: e.message, items: [], pages: 0 }, 502)
    }
  },
}

function json(body, status = 200, cacheState, maxAge = 0) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' }
  if (cacheState) headers['X-Cache'] = cacheState
  headers['Cache-Control'] = status === 200 ? `public, max-age=${Math.min(maxAge, 30)}` : 'no-store'
  return new Response(JSON.stringify(body), { status, headers })
}

function todayJST() {
  const jst = new Date(Date.now() + 9 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${jst.getUTCFullYear()}${p(jst.getUTCMonth() + 1)}${p(jst.getUTCDate())}`
}

async function scrape(dateParam, allPages) {
  const todayStr = todayJST()
  const isToday = !dateParam || dateParam === todayStr
  let baseUrl

  if (isToday) {
    // メインページから当日一覧の URL を取得(日付ズレ対策)
    const resp = await fetch(MAIN_URL, { headers: FETCH_HEADERS })
    if (!resp.ok) throw new Error(`main page ${resp.status}`)
    const m = (await resp.text()).match(/src="([^"]*I_list_\d+_\d+\.html[^"]*)"/)
    if (!m) throw new Error('iframe not found')
    const src = m[1].replace(/^\.\//, '')
    baseUrl = src.startsWith('http') ? src : `${BASE_URL}/inbs/${src}`
  } else {
    baseUrl = `${BASE_URL}/inbs/I_list_001_${dateParam}.html`
  }

  const items = []
  const maxPages = allPages ? MAX_PAGES : 2
  let fetchedPages = 0

  for (let page = 1; page < maxPages; page++) {
    const pageUrl = baseUrl.replace(/I_list_\d+_/, `I_list_${String(page).padStart(3, '0')}_`)
    let resp
    try { resp = await fetch(pageUrl, { headers: FETCH_HEADERS }) } catch (e) { break }
    if (!resp.ok) break
    const rows = parseRows(await resp.text(), pageUrl)
    fetchedPages++
    if (rows.length === 0) break
    items.push(...rows)
  }

  // 1 ページも取れなかった(今日以外で未公開の日など)場合も、メイン取得に成功していれば空配列で返す
  return { items, pages: fetchedPages, date: dateParam || todayStr }
}

function parseRows(html, pageUrl) {
  const rows = []
  const trRe = /<tr[\s>]([\s\S]*?)<\/tr>/gi
  let trM
  while ((trM = trRe.exec(html)) !== null) {
    const cells = []
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdM
    while ((tdM = tdRe.exec(trM[1])) !== null) cells.push(tdM[1])
    if (cells.length < 4) continue

    const time = strip(cells[0])
    if (!time || !/^\d{2}:\d{2}$/.test(time)) continue

    const code = strip(cells[1])
    const company = decode(strip(cells[2]))
    const titleCell = cells[3]
    const title = decode(strip(titleCell))
    if (!code || !title) continue

    const lm = titleCell.match(/href="([^"]+)"/)
    let link = pageUrl
    if (lm) {
      const h = lm[1]
      link = h.startsWith('http') ? h : h.startsWith('/') ? BASE_URL + h : `${BASE_URL}/inbs/${h}`
    }

    let id = link.split('/').pop().replace('.html', '')
    if (!id || id.includes('I_list')) id = `${time}_${code}_${title.slice(0, 20)}`

    rows.push({ id, time, code, company, title, url: link })
  }
  return rows
}

function strip(html) { return html.replace(/<[^>]+>/g, '').trim() }
function decode(str) {
  return str
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .trim()
}
