var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var BASE_URL = "https://www.release.tdnet.info";
var MAIN_URL = `${BASE_URL}/inbs/I_main_00.html`;
var FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en;q=0.5"
};
var MAX_PAGES = 30;
var TTL_TODAY_MS = 60 * 1e3;
var TTL_PAST_MS = 60 * 60 * 1e3;
var cache = /* @__PURE__ */ new Map();
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/disclosures") return env.ASSETS.fetch(request);
    if (request.method !== "GET") return json({ error: "method not allowed", items: [], pages: 0 }, 405);
    const date = /^\d{8}$/.test(url.searchParams.get("date") || "") ? url.searchParams.get("date") : "";
    const allPages = url.searchParams.get("all") !== "0";
    const isToday = !date || date === todayJST();
    const key = `${isToday ? "today" : date}:${allPages ? "all" : "p1"}`;
    const ttl = isToday ? TTL_TODAY_MS : TTL_PAST_MS;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return json(hit.body, 200, "HIT", Math.ceil((ttl - (Date.now() - hit.at)) / 1e3));
    try {
      const body = await scrape(date, allPages);
      cache.set(key, { at: Date.now(), body });
      return json(body, 200, "MISS", Math.ceil(ttl / 1e3));
    } catch (e) {
      console.error("scrape error:", e);
      if (hit) return json(hit.body, 200, "STALE", 10);
      return json({ error: e.message, items: [], pages: 0 }, 502);
    }
  }
};
function json(body, status = 200, cacheState, maxAge = 0) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (cacheState) headers["X-Cache"] = cacheState;
  headers["Cache-Control"] = status === 200 ? `public, max-age=${Math.min(maxAge, 30)}` : "no-store";
  return new Response(JSON.stringify(body), { status, headers });
}
__name(json, "json");
function todayJST() {
  const jst = new Date(Date.now() + 9 * 3600 * 1e3);
  const p = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "p");
  return `${jst.getUTCFullYear()}${p(jst.getUTCMonth() + 1)}${p(jst.getUTCDate())}`;
}
__name(todayJST, "todayJST");
async function scrape(dateParam, allPages) {
  const todayStr = todayJST();
  const isToday = !dateParam || dateParam === todayStr;
  let baseUrl;
  if (isToday) {
    const resp = await fetch(MAIN_URL, { headers: FETCH_HEADERS });
    if (!resp.ok) throw new Error(`main page ${resp.status}`);
    const m = (await resp.text()).match(/src="([^"]*I_list_\d+_\d+\.html[^"]*)"/);
    if (!m) throw new Error("iframe not found");
    const src = m[1].replace(/^\.\//, "");
    baseUrl = src.startsWith("http") ? src : `${BASE_URL}/inbs/${src}`;
  } else {
    baseUrl = `${BASE_URL}/inbs/I_list_001_${dateParam}.html`;
  }
  const items = [];
  const maxPages = allPages ? MAX_PAGES : 2;
  let fetchedPages = 0;
  for (let page = 1; page < maxPages; page++) {
    const pageUrl = baseUrl.replace(/I_list_\d+_/, `I_list_${String(page).padStart(3, "0")}_`);
    let resp;
    try {
      resp = await fetch(pageUrl, { headers: FETCH_HEADERS });
    } catch (e) {
      break;
    }
    if (!resp.ok) break;
    const rows = parseRows(await resp.text(), pageUrl);
    fetchedPages++;
    if (rows.length === 0) break;
    items.push(...rows);
  }
  return { items, pages: fetchedPages, date: dateParam || todayStr };
}
__name(scrape, "scrape");
function parseRows(html, pageUrl) {
  const rows = [];
  const trRe = /<tr[\s>]([\s\S]*?)<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdM;
    while ((tdM = tdRe.exec(trM[1])) !== null) cells.push(tdM[1]);
    if (cells.length < 4) continue;
    const time = strip(cells[0]);
    if (!time || !/^\d{2}:\d{2}$/.test(time)) continue;
    const code = strip(cells[1]);
    const company = decode(strip(cells[2]));
    const titleCell = cells[3];
    const title = decode(strip(titleCell));
    if (!code || !title) continue;
    const lm = titleCell.match(/href="([^"]+)"/);
    let link = pageUrl;
    if (lm) {
      const h = lm[1];
      link = h.startsWith("http") ? h : h.startsWith("/") ? BASE_URL + h : `${BASE_URL}/inbs/${h}`;
    }
    let id = link.split("/").pop().replace(".html", "");
    if (!id || id.includes("I_list")) id = `${time}_${code}_${title.slice(0, 20)}`;
    rows.push({ id, time, code, company, title, url: link });
  }
  return rows;
}
__name(parseRows, "parseRows");
function strip(html) {
  return html.replace(/<[^>]+>/g, "").trim();
}
__name(strip, "strip");
function decode(str) {
  return str.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).trim();
}
__name(decode, "decode");

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-ALGAgT/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ALGAgT/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
