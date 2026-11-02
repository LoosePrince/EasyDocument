/**
 * 旧版 hash 链接回退
 *
 * v1 的文档地址形如：
 *   /main/#/使用指南/目录结构
 *   /main/#使用指南/README
 *   /main/#1.3.4/#/路径          （hash 内再带版本）
 *   /#/main/使用指南             （首页兜底）
 *
 * v2 使用真实路径 `/docs/{版本}/{路径}`。GitHub Pages 会把上面这些 URL 落到
 * `404.html`（= index.html 的副本），因此由 `scripts/postbuild.mjs` 在副本里注入
 * 一段**同步执行**的重定向脚本（见 `buildLegacyHashScript`），在 React 水合前完成跳转，
 * 避免「首页标记 + 旧地址」造成水合不一致。
 *
 * `resolveLegacyHash` 是同一套规则的纯函数实现，供单元测试与运行时兜底使用。
 */

export interface LegacyRedirect {
  /** 需要跳转到的站内路径（含 hash 锚点） */
  target: string;
  /** 是否使用 replace（避免污染历史记录） */
  replace: boolean;
}

/** 去掉扩展名与首尾斜杠 */
function cleanPath(value: string): string {
  return value.replace(/^\/+|\/+$/g, "").replace(/\.(md|markdown|html?)$/i, "");
}

/**
 * 解析 hash 部分：
 *   `/路径`  |  `版本/#/路径`  |  `版本/#路径`  |  `路径#锚点`
 */
export function parseLegacyHash(rawHash: string): {
  version?: string;
  path: string;
  anchor?: string;
} | null {
  let value = safeDecode(rawHash).replace(/^#/, "").replace(/^\/+/, "");
  if (!value) return null;

  let version: string | undefined;
  const branchMatch = value.match(/^([^/]+)\/#\/?(.*)$/);
  const altMatch = branchMatch ? null : value.match(/^([^/]+)\/#(.*)$/);
  if (branchMatch) {
    version = branchMatch[1];
    value = branchMatch[2] ?? "";
  } else if (altMatch) {
    version = altMatch[1];
    value = altMatch[2] ?? "";
  }

  let anchor: string | undefined;
  const anchorIndex = value.indexOf("#");
  if (anchorIndex !== -1) {
    anchor = value.slice(anchorIndex + 1);
    value = value.slice(0, anchorIndex);
  }

  return { version, path: cleanPath(value), anchor };
}

/**
 * 解析旧版 URL → 新路径。
 *
 * @param pathname 浏览器 pathname（如 "/main/"）
 * @param hash     浏览器 hash（含 "#"）
 * @param versions 已知版本名
 */
export function resolveLegacyHash(
  pathname: string,
  hash: string,
  versions: string[],
): LegacyRedirect | null {
  const known = new Set(versions.filter(Boolean));
  if (known.size === 0) return null;

  // 已经是新格式，交给路由
  if (/^\/docs(\/|$)/.test(pathname)) return null;

  const rawHash = hash.replace(/^#/, "");
  if (!rawHash) return null;

  const segments = pathname.split("/").filter(Boolean).map(safeDecode);
  const pathnameVersion =
    segments.length > 0 && known.has(segments[0]) ? segments[0] : null;
  const trailingPath = pathnameVersion ? cleanPath(segments.slice(1).join("/")) : "";

  const parsed = parseLegacyHash(rawHash);

  if (pathnameVersion) {
    // `/main/#/使用指南/` → 版本取 pathname，路径取 hash
    const hashVersion = parsed?.version && known.has(parsed.version) ? parsed.version : null;
    const version = hashVersion ?? pathnameVersion;
    const path = hashVersion ? parsed?.path ?? "" : parsed?.path || trailingPath;
    return buildTarget(version, path, parsed?.anchor ?? "");
  }

  if (parsed?.version && known.has(parsed.version)) {
    return buildTarget(parsed.version, parsed.path, parsed.anchor ?? "");
  }

  // `/#/main/使用指南` —— pathname 没有版本，hash 首段是版本
  if (!parsed) return null;
  const first = (parsed.path.split("/")[0] ?? "").trim();
  if (first && known.has(first)) {
    const rest = parsed.path.slice(first.length).replace(/^\/+/, "");
    return buildTarget(first, rest, parsed.anchor ?? "");
  }

  return null;
}

function buildTarget(version: string, path: string, anchor: string): LegacyRedirect {
  const clean = cleanPath(path);
  const target = `/${["docs", version, clean].filter(Boolean).join("/")}${
    anchor ? `#${anchor}` : ""
  }`;
  return { target, replace: true };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 生成注入到 SPA 回退页 `<head>` 的重定向脚本。
 *
 * 与 `resolveLegacyHash` 规则一致；只处理「pathname 首段是版本」与
 * 「hash 内含版本」两类旧地址。
 */
export function buildLegacyHashScript(versions: string[], baseUrl = "/"): string {
  const base = baseUrl === "/" ? "" : baseUrl.replace(/\/+$/, "");
  return `(function(){try{
var V=${JSON.stringify(versions.filter(Boolean))};if(!V.length)return;
var B=${JSON.stringify(base)};
var dec=function(v){try{return decodeURIComponent(v)}catch(e){return v}};
var clean=function(v){return v.replace(/^\\/+|\\/+$/g,"").replace(/\\.(md|markdown|html?)$/i,"")};
var p=dec(location.pathname);
if(B&&p.indexOf(B)===0)p=p.slice(B.length)||"/";
if(/^\\/docs(\\/|$)/.test(p))return;
var h=dec(location.hash.replace(/^#/,""));
if(!h)return;
var segs=p.split("/").filter(Boolean);
var version=null,path="";
if(segs.length&&V.indexOf(segs[0])>=0){version=segs[0];path=segs.slice(1).join("/")}
// hash 形如 /使用指南/ 或 版本/#/路径
var hm=h.replace(/^\\/+/,"");
var m=hm.match(/^([^/#]+)\\/#\\/?(.*)$/)||hm.match(/^([^/#]+)\\/#(.*)$/);
if(m&&V.indexOf(m[1])>=0){version=m[1];path=m[2]||""}
else if(version){path=hm}
if(!version){
  var i=hm.indexOf("/");var first=i<0?hm:hm.slice(0,i);
  if(V.indexOf(first)>=0){version=first;path=i<0?"":hm.slice(i+1)}
}
if(!version)return;
var anchor="";var ai=path.indexOf("#");
if(ai>=0){anchor=path.slice(ai+1);path=path.slice(0,ai)}
path=clean(path.replace(/[?#].*$/,""));
var target=B+"/docs/"+version+(path?"/"+path:"")+(anchor?"#"+anchor:"");
if(target!==location.pathname+location.hash)location.replace(target);
}catch(e){}})();`;
}
