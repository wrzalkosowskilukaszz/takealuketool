/**
 * "Save to Studio": a bookmarklet that runs on a job ad the owner is reading (Pracuj.pl, RocketJobs,
 * LinkedIn…) and opens the Studio's /save page with that ad. Nothing is scraped by the Studio: the
 * owner's own browser reads the page they opened and hands it over in the URL #fragment, which never
 * reaches a server log and works whatever the job site's CSP or COOP headers say.
 *
 * Reads, in order: the schema.org JobPosting most job sites publish for Google, the text the owner
 * selected, then the main content of the page.
 */

/** What the bookmarklet hands over. Short keys keep the URL small. */
export type SavedAd = {
  u: string; // page address
  t: string; // job title
  c: string; // company
  l: string; // place
  p: string; // page title
  x: string; // ad text
  r: boolean; // marked as remote in JobPosting
};

export const MAX_TEXT = 12_000;

/** Runs in the job site's page. Kept dependency free and ES2017 so it works in any browser. */
const SOURCE = `(function(){
var d=document,M=${MAX_TEXT};
function q(s){return d.querySelector(s)}
function txt(h){h=String(h||'').replace(/<li[^>]*>/gi,'\\n• ').replace(/<(br|\\/p|\\/div|\\/h[1-6]|\\/ul|\\/ol|\\/tr)[^>]*>/gi,'$&\\n');
 try{return new DOMParser().parseFromString(h,'text/html').body.textContent||''}catch(e){return ''}}
function clean(s){return String(s||'').replace(/[ \\t\\u00a0]+/g,' ').replace(/\\n\\s*\\n\\s*\\n+/g,'\\n\\n').trim()}
function name(v){return v&&typeof v==='object'?(v.name||''):(v||'')}
var j=null;
d.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){
 if(j)return;
 try{var x=JSON.parse(s.textContent);var a=[].concat(x&&x['@graph']?x['@graph']:x);
  for(var i=0;i<a.length;i++){var o=a[i];if(o&&[].concat(o['@type']).indexOf('JobPosting')>=0){j=o;break}}}catch(e){}
});
j=j||{};
var places=[].concat(j.jobLocation||[]).map(function(p){var a=(p&&p.address)||{};
 return [a.addressLocality,name(a.addressCountry)].filter(Boolean).join(', ')}).filter(Boolean);
var og=q('meta[property="og:title"]'),h1=q('h1');
var sel=String(window.getSelection?window.getSelection():'').trim();
var body=(q('main')||q('article')||q('[role=main]')||d.body).innerText;
var text=clean(sel.length>200?sel:(j.description?txt(j.description):body)).slice(0,M);
var data={u:location.href,t:clean(j.title||(h1&&h1.innerText)||(og&&og.content)||d.title).slice(0,300),
 c:clean(name(j.hiringOrganization)).slice(0,200),l:places.slice(0,3).join(' / ').slice(0,300),
 p:d.title.slice(0,300),x:text,r:j.jobLocationType==='TELECOMMUTE'};
var url='__ORIGIN__/save#d='+btoa(unescape(encodeURIComponent(JSON.stringify(data))));
var w=window.open(url,'tals_save','width=560,height=820');
if(!w)location.href=url;
})()`;

/** The javascript: link to drag to the bookmarks bar, pointing at this Studio's address. */
export function bookmarkletHref(origin: string): string {
  const code = SOURCE.replace("__ORIGIN__", origin.replace(/\/+$/, ""))
    .split("\n")
    .map((l) => l.trim())
    .join("");
  return `javascript:${encodeURIComponent(code)}`;
}

/** Reads what the bookmarklet put in the #fragment. Null when there is nothing (or it is mangled). */
export function decodeSavedAd(hash: string): SavedAd | null {
  const m = /(?:^#|&)d=([^&]+)/.exec(hash);
  if (!m) return null;
  try {
    const bin = atob(decodeURIComponent(m[1]!));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const o = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SavedAd>;
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const u = s(o.u, 2000);
    if (!/^https?:\/\//i.test(u)) return null;
    return {
      u,
      t: s(o.t, 300),
      c: s(o.c, 200),
      l: s(o.l, 300),
      p: s(o.p, 300),
      x: s(o.x, MAX_TEXT),
      r: o.r === true,
    };
  } catch {
    return null;
  }
}
