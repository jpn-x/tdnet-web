/**
 * TDnet 適時開示情報 スクレイパー
 * Cloudflare Worker — CORS プロキシ兼HTMLパーサー
 */

const BASE_URL     = 'https://www.release.tdnet.info'
const MAIN_URL     = `${BASE_URL}/inbs/I_main_00.html`
const FETCH_HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en;q=0.5',
}
const CORS_HEADERS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type'                : 'application/json; charset=utf-8',
}

// ─── エントリーポイント ────────────────────────────────────
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url      = new URL(request.url)
    const dateParam = url.searchParams.get('date') || ''   // YYYYMMDD
    const allPages  = url.searchParams.get('all') !== '0'  // デフォルト: 全ページ

    try {
      const result = await scrape(dateParam, allPages)
      return new Response(JSON.stringify(result), { headers: CORS_HEADERS })
    } catch (e) {
      console.error('scrape error:', e)
      return new Response(
        JSON.stringify({ error: e.message, items: [], pages: 0 }),
        { status: 500, headers: CORS_HEADERS }
      )
    }
  }
}

// ─── JST 日付ユーティリティ ────────────────────────────────
function todayJST() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 3600 * 1000)
  const y   = jst.getUTCFullYear()
  const m   = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const d   = String(jst.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

// ─── スクレイピング ────────────────────────────────────────
async function scrape(dateParam, allPages) {
  const todayStr = todayJST()
  const isToday  = !dateParam || dateParam === todayStr
  let baseUrl

  if (isToday) {
    // メインページからiframe URLを取得（日付ズレ対策）
    const resp = await fetch(MAIN_URL, { headers: FETCH_HEADERS })
    if (!resp.ok) throw new Error(`main page ${resp.status}`)
    const html = await resp.text()
    const m    = html.match(/src="([^"]*I_list_\d+_\d+\.html[^"]*)"/)
    if (!m) throw new Error('iframe not found')
    const src = m[1].replace(/^\.\//, '')
    baseUrl = src.startsWith('http') ? src : `${BASE_URL}/inbs/${src}`
  } else {
    baseUrl = `${BASE_URL}/inbs/I_list_001_${dateParam}.html`
  }

  const items     = []
  const maxPages  = allPages ? 30 : 2
  let fetchedPages = 0

  for (let page = 1; page < maxPages; page++) {
    const pageUrl = baseUrl.replace(
      /I_list_\d+_/,
      `I_list_${String(page).padStart(3, '0')}_`
    )

    let resp
    try { resp = await fetch(pageUrl, { headers: FETCH_HEADERS }) }
    catch (e) { break }
    if (!resp.ok) break

    const html = await resp.text()
    const rows = parseRows(html, pageUrl)
    fetchedPages++
    if (rows.length === 0) break
    items.push(...rows)
  }

  return { items, pages: fetchedPages, date: dateParam || todayStr }
}

// ─── HTML パース ───────────────────────────────────────────
function parseRows(html, pageUrl) {
  const rows = []

  // テーブルIDを探さず全<tr>を走査（テーブル構造の差異を吸収）
  const trRe = /<tr[\s>]([\s\S]*?)<\/tr>/gi
  let trM

  while ((trM = trRe.exec(html)) !== null) {
    const rowHtml = trM[1]
    const cells   = []
    const tdRe    = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdM
    while ((tdM = tdRe.exec(rowHtml)) !== null) cells.push(tdM[1])
    if (cells.length < 4) continue

    const time = strip(cells[0])
    // HH:MM 形式のみ（ヘッダ行などを除外）
    if (!time || !/^\d{2}:\d{2}$/.test(time)) continue

    const code      = strip(cells[1])
    const company   = decode(strip(cells[2]))
    const titleCell = cells[3]
    const title     = decode(strip(titleCell))
    if (!code || !title) continue

    const lm = titleCell.match(/href="([^"]+)"/)
    let link  = pageUrl
    if (lm) {
      const h = lm[1]
      link = h.startsWith('http') ? h
           : h.startsWith('/')   ? BASE_URL + h
           : `${BASE_URL}/inbs/${h}`
    }

    let id = link.split('/').pop().replace('.html', '')
    if (!id || id.includes('I_list')) id = `${time}_${code}_${title.slice(0, 20)}`

    rows.push({ id, time, code, company, title, url: link })
  }
  return rows
}

function strip(html)  { return html.replace(/<[^>]+>/g, '').trim() }
function decode(str)  {
  return str
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .trim()
}
