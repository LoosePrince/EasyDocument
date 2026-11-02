/**
 * 生成注入到 SPA 回退页 `<head>` 的旧版 hash 重定向脚本（构建后处理使用）。
 *
 * 与 `app/lib/content/legacy-hash.ts` 的 `resolveLegacyHash` 规则一致：
 *   /main/#/使用指南/   → /docs/main/使用指南
 *   /main/#1.3.4/#/x    → /docs/1.3.4/x
 *   /#/main/使用指南    → /docs/main/使用指南
 *
 * 脚本必须同步执行且在 React 水合之前完成跳转，因此内联进 404.html。
 */
export function buildLegacyHashScript(versions, baseUrl = "/") {
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
