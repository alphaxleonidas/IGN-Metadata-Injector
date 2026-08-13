// ==UserScript==
// @name         IGN Metadata Injector
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  Displays IGN review scores, user ratings, clickable HLTB with dynamic category data, Developer, and prominent ESRB rating with content descriptors.
// @author       Leonidas
// @match        https://*.steampowered.com/*
// @match        https://*.epicgames.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @connect      www.ign.com
// @connect      ign.com
// @connect      mollusk.apis.ign.com
// @connect      howlongtobeat.com
// ==/UserScript==

// ---------------------------------------------------------------------------
// THIS FILE IS GENERATED (and compacted via Terser — see build.js) from the
// numbered module files in /src. Do not edit it directly: edit those and run
// "node build.js" to regenerate it. The full, readable, commented source for
// every module lives in /src and in extension-chrome/src, extension-firefox/src.
// ---------------------------------------------------------------------------

!function(NS){"use strict"
;if(NS.IS_STEAM=window.location.hostname.includes("steampowered.com"),
NS.IS_EPIC=window.location.hostname.includes("epicgames.com"),
NS.state={isFetching:!1,lastProcessedTitle:"",
debounceTimer:null
},NS.escapeHtml=str=>String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),
NS.findSafeBeforeTarget=function(el){let node=el
;for(;node.parentElement;){
const display=getComputedStyle(node.parentElement).display
;if("flex"!==display&&"inline-flex"!==display&&"grid"!==display&&"inline-grid"!==display)break
;node=node.parentElement}return node
},NS.findSafeAfterTarget=function(el){let node=el
;for(;node.parentElement;){
const cs=getComputedStyle(node.parentElement),isRowFlex=-1!==cs.display.indexOf("flex")&&0===cs.flexDirection.indexOf("row"),isMultiColGrid=-1!==cs.display.indexOf("grid")&&cs.gridTemplateColumns.split(" ").filter(Boolean).length>1
;if(!isRowFlex&&!isMultiColGrid)break
;node=node.parentElement}return node
},"undefined"!=typeof GM_getValue)NS.storage={
ready:Promise.resolve(),
getSync:(key,defaultValue)=>GM_getValue(key,defaultValue),
set:(key,value)=>GM_setValue(key,value)
};else if("undefined"!=typeof chrome&&chrome.storage&&chrome.storage.local){
const cache={};NS.storage={
ready:new Promise(resolve=>chrome.storage.local.get(null,all=>{
Object.assign(cache,all||{}),resolve()})),
getSync:(key,defaultValue)=>cache.hasOwnProperty(key)?cache[key]:defaultValue,
set:(key,value)=>{
cache[key]=value,chrome.storage.local.set({[key]:value})}}
}else{const cache={};NS.storage={ready:Promise.resolve(),
getSync:(key,defaultValue)=>cache.hasOwnProperty(key)?cache[key]:defaultValue,
set:(key,value)=>{cache[key]=value}}}
"undefined"!=typeof GM_xmlhttpRequest?NS.http={
get:(url,handlers)=>GM_xmlhttpRequest({method:"GET",url:url,
onload:handlers.onload,onerror:handlers.onerror})
}:"undefined"!=typeof chrome&&chrome.runtime&&chrome.runtime.sendMessage?NS.http={
get:(url,handlers)=>{chrome.runtime.sendMessage({
type:"ignFetch",url:url},response=>{
!chrome.runtime.lastError&&response&&response.ok?handlers.onload&&handlers.onload({
status:response.status,responseText:response.responseText
}):handlers.onerror&&handlers.onerror()})}}:NS.http={
get:function(url,handlers){fetch(url,{method:"GET",
credentials:"omit"}).then(res=>res.text().then(text=>({
status:res.status,responseText:text}))).then(response=>{
handlers.onload&&handlers.onload(response)}).catch(()=>{
handlers.onerror&&handlers.onerror()})}}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),
function(NS){"use strict";const CONFIG_KEYS={
showIgnScore:"Show IGN Score",
showUserRating:"Show User Rating",
showReviewGrading:"Show Review Grading",
showReview:"Show Review Summary",
showSteamReviews:"Show Steam Reviews",
showAward:"Show IGN Award / Leaderboard",
showEsrb:"Show ESRB Rating & Descriptors",
showDeveloper:"Show Developer",
showPublisher:"Show Publisher",showGenres:"Show Genres",
showPlatforms:"Show Platforms",showFeatures:"Show Features",
showDescription:"Show Game Description",
showHltb:"Show HowLongToBeat",
showLeisure:"Show HLTB Leisure Times"},CONFIG_DEFAULTS={
showIgnScore:!0,showUserRating:!0,showReviewGrading:!0,
showReview:!0,showSteamReviews:!0,showAward:!0,showEsrb:!0,
showDeveloper:!1,showPublisher:!1,showGenres:!0,
showPlatforms:!0,showFeatures:!1,showDescription:!0,
showHltb:!0,showLeisure:!0}
;NS.CONFIG_KEYS=CONFIG_KEYS,NS.CONFIG_DEFAULTS=CONFIG_DEFAULTS,
NS.getConfig=key=>NS.storage.getSync(key,CONFIG_DEFAULTS[key])
;const DEFAULT_SECTION_ORDER=["scores","reviewGrading","award","review","steamReviews","esrb","developer","publisher","genres","platforms","features","description","hltb","leisure"]
;function currentPlatform(){
return NS.IS_STEAM?"Steam":NS.IS_EPIC?"Epic":""}
NS.SECTION_LABELS={scores:"IGN Score / User Rating",
reviewGrading:"Review Grading",review:"Review Summary",
steamReviews:"Steam Reviews",award:"Leaderboard Rank",
esrb:"ESRB Rating",developer:"Developer",
publisher:"Publisher",genres:"Genres",platforms:"Platforms",
features:"Features",description:"Game Description",
hltb:"HowLongToBeat",leisure:"HLTB Leisure Time"
},NS.SECTION_CONFIG_KEYS={
scores:["showIgnScore","showUserRating"],
reviewGrading:["showReviewGrading"],review:["showReview"],
steamReviews:["showSteamReviews"],award:["showAward"],
esrb:["showEsrb"],developer:["showDeveloper"],
publisher:["showPublisher"],genres:["showGenres"],
platforms:["showPlatforms"],features:["showFeatures"],
description:["showDescription"],hltb:["showHltb"],
leisure:["showLeisure"]
},NS.DEFAULT_SECTION_ORDER=DEFAULT_SECTION_ORDER,NS.getSectionOrder=function(){
const stored=NS.storage.getSync("sectionOrder",null)
;if(!Array.isArray(stored)||0===stored.length)return[...DEFAULT_SECTION_ORDER]
;const known=stored.filter(key=>DEFAULT_SECTION_ORDER.includes(key))
;return[...known,...DEFAULT_SECTION_ORDER.filter(key=>!known.includes(key))]
},NS.setSectionOrder=order=>NS.storage.set("sectionOrder",order),
NS.BADGE_POSITION_OPTIONS=[{value:"default",label:"Default"
},{value:"aboveTitle",label:"Above Game Title"},{
value:"belowGameMedia",label:"Below Game Media"},{
value:"abovePrice",
label:"Steam: Above Game Price | Epic: Above Game Description"
},{value:"belowLeftSidebar",label:"Bottom of Left Sidebar"
},{value:"aboveRightSidebarMetadata",
label:"Above Right Side Metadata"},{
value:"belowRightSidebarMetadata",
label:"Below Right Side Metadata"},{value:"sidebarBottom",
label:"Bottom of Right Sidebar"
}],NS.PLATFORMS=["Steam","Epic"],NS.getBadgePositionFor=platform=>NS.storage.getSync("badgePosition"+platform,"default"),
NS.setBadgePositionFor=(platform,value)=>NS.storage.set("badgePosition"+platform,value),
NS.getBadgePosition=()=>NS.getBadgePositionFor(currentPlatform()),
NS.setBadgePosition=value=>NS.setBadgePositionFor(currentPlatform(),value),
NS.getSiteEnabled=platform=>NS.storage.getSync("enabled"+platform,!0),
NS.setSiteEnabled=(platform,value)=>NS.storage.set("enabled"+platform,value),
NS.isEnabledForCurrentSite=()=>NS.getSiteEnabled(currentPlatform()),
NS.getPlacementShared=()=>NS.storage.getSync("placementShared",!1),
NS.setPlacementShared=value=>NS.storage.set("placementShared",value),
NS.getEnabledPlatforms=()=>NS.PLATFORMS.filter(p=>NS.getSiteEnabled(p)),
NS.getVisiblePlatforms=()=>{
const enabled=NS.getEnabledPlatforms()
;return NS.getPlacementShared()?enabled.slice(0,1):enabled
},NS.LOCATION_OPTIONS=[{value:"inline",
label:"Inline (Default)"},...NS.BADGE_POSITION_OPTIONS]
;const DEFAULT_SECTION_LOCATIONS={hltb:"belowGameMedia",
leisure:"belowGameMedia"}
;NS.getSectionLocationFor=(key,platform)=>NS.storage.getSync(key+"Location"+platform,DEFAULT_SECTION_LOCATIONS[key]||"inline"),
NS.setSectionLocationFor=(key,platform,value)=>NS.storage.set(key+"Location"+platform,value),
NS.getCombineAllFor=platform=>NS.storage.getSync("combineAll"+platform,!1),
NS.setCombineAllFor=(platform,value)=>NS.storage.set("combineAll"+platform,value),
NS.getCombineAll=()=>NS.getCombineAllFor(currentPlatform()),
NS.getCombineLocationFor=platform=>NS.storage.getSync("combineLocation"+platform,"belowGameMedia"),
NS.setCombineLocationFor=(platform,value)=>NS.storage.set("combineLocation"+platform,value),
NS.getCombineLocation=()=>NS.getCombineLocationFor(currentPlatform()),
NS.getSectionLocation=key=>{const platform=currentPlatform()
;return NS.getCombineAllFor(platform)?NS.getCombineLocationFor(platform):NS.getSectionLocationFor(key,platform)
},
NS.setSectionLocation=(key,value)=>NS.setSectionLocationFor(key,currentPlatform(),value),
NS.getUserOverrides=()=>NS.storage.getSync("userTitleOverrides",{}),
NS.setUserOverrides=overridesObj=>NS.storage.set("userTitleOverrides",overridesObj),
NS.setUserOverride=function(title,ignUrl,hltbUrl){
const key=title.trim().toLowerCase();if(!key)return
;const all=NS.getUserOverrides();all[key]={
displayTitle:title.trim(),ignUrl:ignUrl?ignUrl.trim():"",
hltbUrl:hltbUrl?hltbUrl.trim():""},NS.setUserOverrides(all)
},NS.removeUserOverride=function(key){
const all=NS.getUserOverrides()
;delete all[key],NS.setUserOverrides(all)
},NS.getUserOverrideForTitle=title=>NS.getUserOverrides()[title.trim().toLowerCase()]||null
;const menuCommandIds={},menuLabel=key=>`${NS.getConfig(key)?"✅":"⬜"} ${CONFIG_KEYS[key]}`
;NS.registerMenuCommands=function(){
if("undefined"==typeof GM_registerMenuCommand)return
;const canUnregister="undefined"!=typeof GM_unregisterMenuCommand
;for(const key of Object.keys(CONFIG_KEYS))canUnregister&&void 0!==menuCommandIds[key]&&GM_unregisterMenuCommand(menuCommandIds[key]),
menuCommandIds[key]=GM_registerMenuCommand(menuLabel(key),()=>NS.toggleConfig(key))
},NS.toggleConfig=function(key){
NS.storage.set(key,!NS.getConfig(key)),NS.registerMenuCommands()
}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),function(NS){
"use strict";const ESRB_FULL_NAMES={e:"Everyone",
everyone:"Everyone","e10+":"Everyone 10+",
"e 10+":"Everyone 10+","everyone 10+":"Everyone 10+",
t:"Teen",teen:"Teen",m:"Mature 17+",mature:"Mature 17+",
"mature 17+":"Mature 17+",ao:"Adults Only",
"adults only":"Adults Only",rp:"Rating Pending",
"rating pending":"Rating Pending"}
;NS.normalizeEsrbLabel=function(rawLabel){
if(!rawLabel)return rawLabel
;const key=rawLabel.trim().toLowerCase().replace(/^esrb:?\s*/i,"")
;return ESRB_FULL_NAMES[key]||rawLabel.trim()}
;const HLTB_LABEL_OVERRIDES={"main story":"Main",
"story + sides":"Main + Sides"}
;NS.relabelHltb=label=>HLTB_LABEL_OVERRIDES[label.toLowerCase().trim()]||label
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),
function(NS){"use strict";NS.BUNDLE_TITLE_OVERRIDES={
"metal gear & metal gear 2: solid snake":[{
name:"Metal Gear",slug:"metal-gear"},{
name:"Metal Gear 2: Solid Snake",
slug:"metal-gear-2-solid-snake"}]};const TITLE_ALIASES={
"counter-strike 2":["counter-strike: global offensive","counter-strike"],
cs2:["counter-strike: global offensive"],
"overwatch 2":["overwatch"],
"ea sports fc 24":["fifa 24","fifa 23"],
"eafc 24":["fifa 24"],
"final fantasy vii remake intergrade":["final fantasy vii remake"],
"jurassic world evolution 3: rebirth expansion":["jurassic world evolution 3"],
"conan exiles enhanced: isle of siptah":["conan exiles"],
"ratchet & clank: rift apart":["ratchet and clank rift apart"],
"brütal legend":["brutal legend","brtal-legend"],
"brutal legend":["brtal-legend"],
"guilty gear xrd rev 2":["guilty gear xrd revelator 2"],
"guilty gear":["guilty-gear-1998"],
"grand theft auto v":["grand theft auto 5","gta v","gta 5"],
"nioh 2":["nioh 2"],
"nioh 2 the complete edition":["nioh 2"],
"ninja gaiden 3":["ninja gaiden iii"],
"ninja gaiden 3: razor's edge":["ninja gaiden iii razors edge"],
"ninja gaiden 3: razor's edge [ninja gaiden: master collection]":["ninja gaiden iii razors edge"]
};NS.TITLE_ALIASES=TITLE_ALIASES
;const slugify=str=>str.replace(/'/g,"").replace(/[^a-z0-9]/gi,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase()
;function createIgnSlugs(title){
const noPeriods=title.replace(/\./g,"")
;let cleaned=noPeriods.replace(/[™®©]/g,"").replace(/[’‘]/g,"'").replace(/[–—]/g,"-").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ü/g,"u").replace(/Ü/g,"u").replace(/ä/g,"a").replace(/Ä/g,"a").replace(/ö/g,"o").replace(/Ö/g,"o").replace(/ß/g,"ss").replace(/[Σσς](\d)/g,"Sigma $1").replace(/[Σσς]/g,"Sigma").replace(/Δ/g,"delta").replace(/Ω/g,"omega")
;cleaned=cleaned.replace(/\b(the\s+)?(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|definitive|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi,"").replace(/\s*[:|]\s*(rebirth|expansion|dlc|season pass|enhanced|isle of .*)\s*\w*/gi,"").replace(/[–—-]\s*$/g,"").trim()
;const slug=slugify(cleaned),primarySlug=slug.replace(/&/g,"and"),secondarySlug=slug.replace(/&/g,""),noPrefix=cleaned.replace(/^[a-z0-9]{2,4}\s+/i,""),tertiarySlug=noPrefix!==cleaned&&noPrefix.length>0?slugify(noPrefix).replace(/&/g,"and"):null,aggressiveDropSlug=slugify(noPeriods.replace(/[^\x00-\x7F]/g,""))
;return{primarySlug:primarySlug,secondarySlug:secondarySlug,
tertiarySlug:tertiarySlug,
aggressiveDropSlug:aggressiveDropSlug!==primarySlug?aggressiveDropSlug:null
}}
const slugsToList=s=>[s.primarySlug,s.secondarySlug,s.tertiarySlug,s.aggressiveDropSlug].filter(Boolean)
;function toRoman(num){
const table=[[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]
;let n=num,result=""
;for(const[value,numeral]of table)for(;n>=value;)result+=numeral,
n-=value;return result}const ROMAN_LOOKUP={}
;for(let n=1;n<=50;n++)ROMAN_LOOKUP[toRoman(n).toLowerCase()]=n
;const arabicToRomanVariant=title=>title.replace(/\b(\d{1,2})\.5\b|\b(\d{1,2})\b/g,(match,decimalPart,intPart)=>{
if(void 0!==decimalPart)return`${toRoman(parseInt(decimalPart,10))}.5`
;const num=parseInt(intPart,10)
;return num>=1&&num<=50?toRoman(num):match
}),romanToArabicVariant=title=>title.replace(/\b[a-zA-Z]+\b/g,word=>{
const key=word.toLowerCase()
;return ROMAN_LOOKUP.hasOwnProperty(key)?String(ROMAN_LOOKUP[key]):word
});function generateTitleVariants(title){
const variants=new Set([title]),dashUnwrapped=title.replace(/\s-([^-]+)-\s*$/i," $1").trim()
;dashUnwrapped!==title&&variants.add(dashUnwrapped)
;for(const base of[...variants]){
const noDlc=base.replace(/\(\s*dlc\s*\)/gi,"").replace(/\s+/g," ").trim()
;noDlc!==base&&variants.add(noDlc)}
for(const base of[...variants])base.includes("+")&&(variants.add(base.replace(/\s*\+\s*/g," and ").replace(/\s+/g," ").trim()),
variants.add(base.replace(/\s*\+\s*/g," ").replace(/\s+/g," ").trim()))
;for(const base of[...variants]){
const romanVariant=arabicToRomanVariant(base),arabicVariant=romanToArabicVariant(base)
;romanVariant!==base&&variants.add(romanVariant),
arabicVariant!==base&&variants.add(arabicVariant)}
return[...variants]}
NS.stripCollectionBracket=function(title){
const match=title.match(/^(.*?)\s*\[[^\]]*collection[^\]]*\]\s*$/i)
;return match?match[1].trim():null
},NS.sigmaLetterFallbackTitle=function(title){
return/[Σσς]/.test(title)?title.replace(/[Σσς](\d)/g,"S$1").replace(/[Σσς]/g,"S"):null
},NS.buildCandidateSlugs=function(gameTitle){let slugs=[]
;for(const variant of generateTitleVariants(gameTitle))slugs=slugs.concat(slugsToList(createIgnSlugs(variant)))
;const lowerTitle=gameTitle.toLowerCase().trim()
;for(const alias of TITLE_ALIASES[lowerTitle]||[]){
alias.includes(" ")||slugs.push(alias)
;for(const aliasVariant of generateTitleVariants(alias))slugs=slugs.concat(slugsToList(createIgnSlugs(aliasVariant)))
}return[...new Set(slugs)]}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),
function(NS){"use strict"
;const cleanSteamTitle=raw=>raw.replace(/^Save \d+% on /i,"").replace(/^Pre-purchase /i,"").replace(/ on Steam$/i,"").trim()
;function rowUnder(container,markerEl){
if(!container||!markerEl)return null;let node=markerEl
;for(;node&&node.parentElement&&node.parentElement!==container;)node=node.parentElement
;return node&&node.parentElement===container?node:null}
function commonAncestorChild(a,b){let common=a.parentElement
;for(;common&&!common.contains(b);)common=common.parentElement
;return common?rowUnder(common,a):null}
NS.getGameTitle=function(){let title=null;if(NS.IS_STEAM){
const titleEl=document.getElementById("appHubAppName")||document.querySelector(".page_title_area .apphub_AppName")||document.querySelector(".app_header_content .app_name")
;if(titleEl&&titleEl.textContent.trim()&&(title=titleEl.textContent.trim()),
!title){
const ogTitle=document.querySelector('meta[property="og:title"]')
;if(ogTitle&&ogTitle.content){
const t=cleanSteamTitle(ogTitle.content.trim());t&&(title=t)
}}if(!title&&document.title){
const t=cleanSteamTitle(document.title)
;t&&"Steam"!==t&&(title=t)}}if(!title&&NS.IS_EPIC){
const h1El=document.querySelector("h1")||document.querySelector('[data-testid="pdp-title"]')
;h1El&&(title=h1El.textContent.trim())}
return title?(title=>title.replace(/[\s:-]*\bdemo\b\s*$/i,"").trim())(title):null
},NS.extractSteamReviews=function(){if(!NS.IS_STEAM)return[]
;const SENTIMENT_COLORS={positive:"#66c0f4",mixed:"#e2b93d",
negative:"#a34c25"},results=[]
;return document.querySelectorAll("#userReviews .user_reviews_summary_row").forEach(row=>{
const subtitleEl=row.querySelector(".subtitle"),summaryEl=row.querySelector(".game_review_summary")
;if(!subtitleEl||!summaryEl)return
;const label=subtitleEl.textContent.trim().replace(/:\s*$/,""),summaryText=summaryEl.textContent.trim()
;if(!label||!summaryText)return
;const countEl=row.querySelector(".responsive_hidden"),count=countEl?countEl.textContent.trim().replace(/[()]/g,""):""
;let percent=""
;const percentMatch=(row.getAttribute("data-tooltip-html")||"").match(/(\d+)%/)
;percentMatch&&(percent=`${percentMatch[1]}%`)
;let sentiment="mixed"
;/\bpositive\b/i.test(summaryEl.className)?sentiment="positive":/\bnegative\b/i.test(summaryEl.className)&&(sentiment="negative"),
results.push({label:label,summaryText:summaryText,
count:count,percent:percent,
color:SENTIMENT_COLORS[sentiment]})}),results
},NS.extractDlcBaseGameName=function(){
if(!NS.IS_STEAM)return null
;for(const p of document.querySelectorAll(".content p, p")){
if(!/requires the base game/i.test(p.textContent||""))continue
;const link=p.querySelector('a[href*="/app/"]')||p.querySelector("a"),name=link?link.textContent.trim():""
;if(name)return name}return null
},NS.extractPackageItemNames=function(){
if(!NS.IS_STEAM)return[];const names=[],seen=new Set
;return document.querySelectorAll(".package_landing_page_item_list .tab_item_name").forEach(el=>{
const name=(el.textContent||"").trim(),key=name.toLowerCase()
;name&&!seen.has(key)&&(seen.add(key),names.push(name))
}),names
},NS.getTargetInsertionPoint=function(explicitPosition){
const pref=explicitPosition||NS.getBadgePosition()
;if(NS.IS_STEAM){if("aboveTitle"===pref){
const titleArea=document.querySelector(".page_title_area.game_title_area")||document.querySelector(".page_title_area")
;if(titleArea)return{
element:NS.findSafeBeforeTarget(titleArea),position:"before"
}}
if("sidebarBottom"===pref||"belowRightSidebarMetadata"===pref||"aboveRightSidebarMetadata"===pref){
const sidebar=document.querySelector(".rightcol.game_meta_data")||document.querySelector(".game_meta_data")
;if(sidebar)return{element:sidebar,
position:"aboveRightSidebarMetadata"===pref?"prepend":"append"
}}if("abovePrice"===pref){
const purchaseArea=document.querySelector("#game_area_purchase")
;if(purchaseArea)return{element:purchaseArea,
position:"before"}}if("belowGameMedia"===pref){
const media=document.querySelector(".highlight_ctn")
;if(media)return{element:media,position:"after",
alignTo:media.querySelector(".highlight_overflow")||media}}
if("belowLeftSidebar"===pref){
const sysReq=document.querySelector(".sys_req"),sysReqCtn=sysReq&&sysReq.closest(".game_page_autocollapse_ctn")
;if(sysReqCtn)return{element:sysReqCtn,position:"after"}
;const leftCol=document.querySelector(".leftcol.game_description_column")
;if(leftCol)return{element:NS.findSafeAfterTarget(leftCol),
position:"after",alignTo:leftCol}}
const headerImage=document.querySelector(".game_header_image_full")||document.querySelector(".game_header_image_ctn")||document.querySelector(".glance_ctn_responsive .game_header_image_full")
;if(headerImage)return{element:headerImage,position:"before"
}
;const glanceCtn=document.querySelector(".glance_ctn_responsive")||document.querySelector(".game_meta_data")
;if(glanceCtn)return{element:glanceCtn,position:"prepend"}
;const mobileReviews=document.querySelector("#user_reviews_container")||document.querySelector(".user_reviews_filter_score")||document.querySelector(".review_histogram_rollup")
;if(mobileReviews)return{element:mobileReviews,
position:"after"}
;const packageList=document.querySelector(".package_landing_page_item_list")
;if(packageList)return{element:packageList,position:"before"
}}if(NS.IS_EPIC){
const buyBtn=document.querySelector('[data-testid="purchase-cta-button"]'),aside=buyBtn&&buyBtn.closest("aside")||document.querySelector("aside")
;if("aboveTitle"===pref){
const titleSpan=document.querySelector('[data-testid="pdp-title"]'),titleH1=titleSpan?titleSpan.closest("h1"):null
;if(titleH1)return{element:NS.findSafeBeforeTarget(titleH1),
position:"before"}}
if(("sidebarBottom"===pref||"belowRightSidebarMetadata"===pref)&&aside)return{
element:NS.findSafeAfterTarget(aside),position:"after",
alignTo:aside};if("abovePrice"===pref){
const metaCols=document.querySelectorAll('[data-testid="about-metadata-layout-column"]'),metaRow=metaCols.length?metaCols[metaCols.length-1].parentElement:null
;if(metaRow)return{element:metaRow,position:"after"}
;const about=document.getElementById("about-long-description")
;if(about)return{element:about,position:"before"}}
if("aboveRightSidebarMetadata"===pref){
const row=rowUnder(aside,document.querySelector('[data-testid="metadata-developer-single"]'))
;if(row)return{element:row,position:"before"}}
if("belowGameMedia"===pref){
const metaCol=document.querySelector('[data-testid="about-metadata-layout-column"]'),aboutDesc=document.getElementById("about-long-description"),row=metaCol&&aboutDesc?commonAncestorChild(metaCol,aboutDesc):null
;if(row)return{element:row,position:"before"}}
if("belowLeftSidebar"===pref){
const sysReqHeading=Array.from(document.querySelectorAll("h3")).find(h=>/system requirements/i.test(h.textContent||"")),sysReqSection=sysReqHeading&&sysReqHeading.parentElement&&sysReqHeading.parentElement.parentElement
;if(sysReqSection&&sysReqSection.parentElement&&sysReqSection.parentElement.children.length>1)return{
element:sysReqSection,position:"after"}
;const tabs=document.querySelector('[role="tablist"]'),nextLabel=Array.from(document.querySelectorAll("p")).find(p=>/login accounts required|languages supported/i.test(p.textContent||"")),row=tabs&&nextLabel?commonAncestorChild(tabs,nextLabel):null
;if(row)return{element:row,position:"after"}
;const fallbackRow=rowUnder(document.querySelector("main"),Array.from(document.querySelectorAll("p")).find(p=>/languages supported/i.test(p.textContent||"")))
;if(fallbackRow)return{element:fallbackRow,position:"after",
alignTo:aside&&aside.previousElementSibling||fallbackRow}}
const epicTarget=aside||document.querySelector("main")
;if(epicTarget)return{element:epicTarget,position:"prepend"}
}return null}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),function(NS){
"use strict"
;const BADGE_STYLE='margin: 10px auto; padding: 14px 16px; background: linear-gradient(135deg, rgba(20,20,20,0.95), rgba(35,35,35,0.95)); border-radius: 8px; border-left: 5px solid #ff3e3e; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; clear: both; color: #ffffff; grid-column: 1 / -1;',statBlock=(value,label,valueSize="18px",valueColor="#ffffff",labelSize="8px")=>`<div style="display:flex;flex-direction:column;align-items:center;flex:1;text-align:center;"><span style="font-size:${valueSize};font-weight:bold;color:${valueColor};line-height:1.1;">${NS.escapeHtml(value)}</span><span style="font-size:${labelSize};color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-top:3px;white-space:nowrap;">${NS.escapeHtml(label)}</span></div>`,divider=(height="32px")=>`<div style="border-left:1px solid rgba(255,255,255,0.15);height:${height};"></div>`,sectionRow=(extra="")=>`border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;${extra}`,gearButtonHtml=(extraStyle="")=>`<button type="button" class="ign_open_settings_gear" title="IGN Metadata Injector settings" style="background:transparent;border:none;color:#8f98a0;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;flex-shrink:0;${extraStyle}">⚙</button>`
;function buildTopRow(ignScore,userScore,ignUrl,displayName){
const showIgn=NS.getConfig("showIgnScore"),showUser=NS.getConfig("showUserRating")
;if(!showIgn&&!showUser)return""
;const scoresHtml=(showIgn?statBlock(ignScore,"IGN Score","22px","#ffffff","11px"):"")+(showIgn&&showUser?divider():"")+(showUser?statBlock(userScore,"User Rating","22px","#ffffff","11px"):"")
;return`<div style="display:flex;align-items:center;justify-content:space-between;width:100%;"><div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:center;max-width:130px;overflow:hidden;"><a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="font-weight:bold;color:#ff3e3e;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;white-space:nowrap;">IGN Overview ↗</a><a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" title="${NS.escapeHtml(displayName)}" style="font-size:10px;font-weight:bold;color:#b8b8b8;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;margin-top:2px;">${NS.escapeHtml(displayName)} ↗</a></div><div style="display:flex;align-items:center;gap:14px;">${scoresHtml}</div></div>`
}function buildMultiGameTopRow(games){
if(!games||0===games.length)return""
;const showIgn=NS.getConfig("showIgnScore"),showUser=NS.getConfig("showUserRating")
;if(!showIgn&&!showUser)return""
;const scoreCol="flex:0 0 70px;text-align:center;",headerCells=['<div style="flex:1;overflow:hidden;">IGN Overview</div>']
;return showIgn&&headerCells.push(`<div style="${scoreCol}">IGN Score</div>`),
showUser&&headerCells.push(`<div style="${scoreCol}">User Rating</div>`),
`<div style="display:flex;flex-direction:column;"><div style="display:flex;align-items:center;gap:8px;font-size:9px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;letter-spacing:0.3px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.12);">${headerCells.join("")}</div>${games.map(g=>{
const cells=[`<div style="flex:1;overflow:hidden;"><a href="${encodeURI(g.url)}" target="_blank" rel="noopener noreferrer" title="${NS.escapeHtml(g.name)}" style="font-weight:bold;color:#ff3e3e;font-size:12px;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${NS.escapeHtml(g.name)}${g.isDedicated?" (Collection)":""} ↗</a></div>`]
;return showIgn&&cells.push(`<div style="${scoreCol}font-weight:bold;color:#ffffff;font-size:13px;">${NS.escapeHtml(g.ignScore)}</div>`),
showUser&&cells.push(`<div style="${scoreCol}font-weight:bold;color:#ffffff;font-size:13px;">${NS.escapeHtml(g.userScore)}</div>`),
`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${cells.join("")}</div>`
}).join("")}</div>`}
function buildSteamReviewsRow(reviewsData){
if(!NS.getConfig("showSteamReviews")||!reviewsData||0===reviewsData.length)return""
;const blocks=reviewsData.map(r=>{const subParts=[]
;r.count&&subParts.push(`<span style="font-size:13px;color:#c6d4df;font-weight:bold;white-space:nowrap;">${NS.escapeHtml(r.count)}</span>`),
r.percent&&subParts.push(`<span style="font-size:13px;color:#c6d4df;font-weight:bold;white-space:nowrap;">${NS.escapeHtml(r.percent)} Positive</span>`)
;const subHtml=subParts.join(divider("12px"))
;return`<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;text-align:center;"><span style="font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;letter-spacing:0.3px;white-space:nowrap;">${NS.escapeHtml(r.label)}</span><span style="font-size:14px;font-weight:bold;color:${r.color};text-transform:uppercase;letter-spacing:0.3px;">${NS.escapeHtml(r.summaryText)}</span><div style="display:flex;align-items:center;gap:8px;">${subHtml}</div></div>`
}).join(divider("48px"))
;return`<div style="${sectionRow("display:flex;align-items:flex-start;justify-content:space-around;")}">${blocks}</div>`
}function buildAwardRow(awardData){
return NS.getConfig("showAward")&&awardData?`<a href="https://www.ign.com/icons" target="_blank" rel="noopener noreferrer" style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;text-decoration:none;")}"><span style="color:#a1b0bd;font-weight:bold;">Leaderboard Rank:</span><span style="color:#f1c40f;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">#${NS.escapeHtml(awardData.rank)} (${NS.escapeHtml(awardData.label)}) ↗</span></a>`:""
}function buildEsrbRow(esrbImgSrc,esrbAlt,esrbDescriptors){
if(!NS.getConfig("showEsrb")||!esrbImgSrc&&!esrbDescriptors)return""
;const img=esrbImgSrc?`<img src="${esrbImgSrc}" alt="${NS.escapeHtml(esrbAlt)}" title="${NS.escapeHtml(esrbAlt)}" style="height:56px;border-radius:4px;flex-shrink:0;box-shadow:0 2px 5px rgba(0,0,0,0.3);" />`:"",desc=esrbDescriptors?`<span style="color:#d0d0d0;font-size:10px;line-height:1.3;margin-top:2px;">${NS.escapeHtml(esrbDescriptors)}</span>`:"",displayAlt=NS.normalizeEsrbLabel(esrbAlt)
;return`<div style="${sectionRow("display:flex;align-items:flex-start;gap:12px;")}">${img}<div style="display:flex;flex-direction:column;justify-content:flex-start;gap:2px;flex:1;"><span style="color:#ffffff;font-size:15px;font-weight:bold;line-height:1.2;">${NS.escapeHtml(displayAlt)}</span>${desc}</div>${gearButtonHtml("margin-left:auto;")}</div>`
}function buildDevRow(developerName){
return NS.getConfig("showDeveloper")&&developerName?`<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Developer:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;" title="${NS.escapeHtml(developerName)}">${NS.escapeHtml(developerName)}</span></div>`:""
}function buildPublisherRow(publisherName){
return NS.getConfig("showPublisher")&&publisherName?`<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Publisher:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;" title="${NS.escapeHtml(publisherName)}">${NS.escapeHtml(publisherName)}</span></div>`:""
}function buildGenresRow(genres){
return NS.getConfig("showGenres")&&genres&&0!==genres.length?`<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Genres:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-align:right;">${NS.escapeHtml(genres.join(", "))}</span></div>`:""
}function buildFeaturesRow(features){
return NS.getConfig("showFeatures")&&features&&0!==features.length?`<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Features:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-align:right;">${NS.escapeHtml(features.join(", "))}</span></div>`:""
}function buildPlatformsRow(platforms){
if(!NS.getConfig("showPlatforms")||!platforms||0===platforms.length)return""
;const chips=platforms.map(p=>p.iconSrc?`<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:rgba(255,255,255,0.08);border-radius:5px;flex-shrink:0;" title="${NS.escapeHtml(p.name)}"><img src="${p.iconSrc}" alt="${NS.escapeHtml(p.name)}" style="height:14px;width:14px;" /></span>`:`<span style="font-size:10px;font-weight:bold;color:#c6d4df;background:rgba(255,255,255,0.08);border-radius:5px;padding:4px 6px;">${NS.escapeHtml(p.name)}</span>`).join("")
;return`<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Platforms:</span><span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;">${chips}</span></div>`
}function buildDescriptionRow(description){
return NS.getConfig("showDescription")&&description?`<div style="${sectionRow("display:flex;flex-direction:column;gap:4px;")}"><span style="color:#a1b0bd;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Description:</span><span style="font-size:13px;line-height:1.55;color:#e4e9ee;">${NS.escapeHtml(description)}</span></div>`:""
}function buildReviewGradingRow(gradingText,gradingBadge){
if(!NS.getConfig("showReviewGrading")||!gradingText)return""
;const badge=gradingBadge?`<span style="background:#f1c40f;color:#1a1a1a;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;border-radius:3px;padding:2px 6px;white-space:nowrap;">${NS.escapeHtml(gradingBadge)}</span>`:""
;return`<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Review Grading:</span><span style="display:flex;align-items:center;gap:8px;"><span style="color:#ffffff;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">${NS.escapeHtml(gradingText)}</span>${badge}</span></div>`
}function buildReviewRow(reviewSummary,reviewUrl){
if(!NS.getConfig("showReview")||!reviewSummary)return""
;const link=reviewUrl?`<a href="${encodeURI(reviewUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:#ff3e3e;text-transform:uppercase;font-weight:bold;text-decoration:none;flex-shrink:0;">Full Review ↗</a>`:""
;return`<div style="${sectionRow("display:flex;flex-direction:column;gap:4px;")}"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><span style="color:#a1b0bd;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Review Summary:</span>${link}</div><span style="font-size:13px;line-height:1.55;color:#e4e9ee;">${NS.escapeHtml(reviewSummary)}</span></div>`
}function buildHltbRow(hltbData,hltbUrl){
if(!NS.getConfig("showHltb")||!(hltbData&&hltbData.length>0))return""
;const displayData=hltbData.filter(item=>!/all styles/i.test(item.label))
;return 0===displayData.length?"":hltbSectionHtml("HowLongToBeat","#66c0f4",displayData,hltbUrl)
}function hltbSectionHtml(title,color,data,hltbUrl){
const items=data.map(item=>statBlock(item.time,NS.relabelHltb(item.label),"16px",color,"10px")).join(divider("26px"))
;return`<div style="${sectionRow("display:flex;flex-direction:column;gap:8px;")}"><div style="display:flex;align-items:center;justify-content:space-between;"><a href="${encodeURI(hltbUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:${color};text-transform:uppercase;font-weight:bold;text-decoration:none;">${title} ↗</a>${gearButtonHtml()}</div><div style="display:flex;align-items:center;justify-content:space-around;background:rgba(0,0,0,0.4);padding:8px 4px;border-radius:4px;">${items}</div></div>`
}
NS.buildLeisureRow=(leisureData,hltbUrl)=>NS.getConfig("showLeisure")&&leisureData&&0!==leisureData.length?hltbSectionHtml("HLTB Leisure Time","#9b59b6",leisureData,hltbUrl):""
;const resolveHltbUrl=(hltbUrl,displayName)=>hltbUrl||`https://howlongtobeat.com/?q=${encodeURIComponent(displayName)}`
;function insertAtTarget(node,targetObj){
const{element:element,position:position,alignTo:alignTo}=targetObj
;if("after"===position&&element.parentNode?element.parentNode.insertBefore(node,element.nextSibling):"before"===position&&element.parentNode?element.parentNode.insertBefore(node,element):"prepend"===position?element.prepend(node):element.appendChild(node),
!alignTo)return
;const targetRect=alignTo.getBoundingClientRect(),parentRect=node.parentNode.getBoundingClientRect()
;node.style.width=targetRect.width+"px",
node.style.marginLeft=targetRect.left-parentRect.left+"px",
node.style.marginRight="auto"}
function makeCtn(className,cssText,html){
const ctn=document.createElement("div")
;return ctn.className=className,ctn.style.cssText=cssText,
ctn.innerHTML=html,ctn}function insertBadge(badgeCtn){
const targetObj=NS.getTargetInsertionPoint()
;return!!targetObj&&(insertAtTarget(badgeCtn,targetObj),!0)}
NS.renderStandalone=function(className,html,location){
if(document.querySelector("."+className)?.remove(),
!html)return
;const targetObj=NS.getTargetInsertionPoint(location)
;targetObj&&insertAtTarget(makeCtn(className,BADGE_STYLE,html),targetObj)
}
;const SIMPLE_SECTION_KEYS=["scores","reviewGrading","review","steamReviews","award","esrb","developer","publisher","genres","platforms","features","description","hltb"],groupClassName=loc=>"ign_group_standalone_"+loc.replace(/[^a-zA-Z0-9]/g,"")
;function clearAllGroupStandalones(){
document.querySelectorAll("[data-ign-group-standalone]").forEach(el=>el.remove())
}function renderGroupAt(loc,html){
if(document.querySelector("."+groupClassName(loc))?.remove(),
!html)return;const targetObj=NS.getTargetInsertionPoint(loc)
;if(!targetObj)return
;const ctn=makeCtn(groupClassName(loc),BADGE_STYLE,html)
;ctn.setAttribute("data-ign-group-standalone","1"),
insertAtTarget(ctn,targetObj)}
const orderedHtml=(order,items)=>{const htmlByKey={}
;return items.forEach(i=>{htmlByKey[i.key]=i.html
}),order.filter(k=>htmlByKey[k]).map(k=>htmlByKey[k]).join("")
};let pendingCombine=null;function placeSections(htmlByKey){
const order=NS.getSectionOrder(),groups={},inlineHtmlByKey={}
;order.filter(key=>SIMPLE_SECTION_KEYS.includes(key)).forEach(key=>{
const html=htmlByKey[key];if(!html)return
;const loc=NS.getSectionLocation(key)
;"inline"!==loc?(groups[loc]=groups[loc]||[]).push({key:key,
html:html}):inlineHtmlByKey[key]=html})
;const leisureLoc=NS.getSectionLocation("leisure")
;return pendingCombine="inline"!==leisureLoc&&NS.getConfig("showLeisure")?{
loc:leisureLoc,items:groups[leisureLoc]||[]
}:null,Object.keys(groups).forEach(loc=>renderGroupAt(loc,orderedHtml(order,groups[loc]))),
inlineHtmlByKey}function buildSectionHtml(map){
return NS.getSectionOrder().map(key=>map[key]||"").join("")}
NS.placeLeisureAndFinalize=function(leisureHtml,leisureLoc){
if(pendingCombine&&pendingCombine.loc===leisureLoc){
const items=pendingCombine.items.concat(leisureHtml?[{
key:"leisure",html:leisureHtml}]:[])
;pendingCombine=null,renderGroupAt(leisureLoc,orderedHtml(NS.getSectionOrder(),items))
}else pendingCombine=null,
renderGroupAt(leisureLoc,leisureHtml)
},NS.finalizeHltbStandalone=function(){pendingCombine=null
},NS.clearLeisureStandalones=function(){pendingCombine=null
},NS.renderCompleteBadge=function(ignScore,userScore,hltbData,hltbUrl,developerName,esrbImgSrc,esrbAlt,esrbDescriptors,awardData,ignUrl,fetchedGameTitle="",extra={}){
if(!NS.getTargetInsertionPoint())return null
;document.querySelector(".ign_rating_row")?.remove(),
clearAllGroupStandalones();let displayName=fetchedGameTitle
;displayName||(displayName=(ignUrl.split("/games/")[1]||"").replace(/-/g," ").replace(/\b\w/g,l=>l.toUpperCase()))
;const resolvedHltbUrl=resolveHltbUrl(hltbUrl,displayName),leisureLoc=NS.getSectionLocation("leisure"),hltbHtml=buildHltbRow(hltbData,resolvedHltbUrl),mainHtml=buildSectionHtml({
...placeSections({
scores:buildTopRow(ignScore,userScore,ignUrl,displayName),
reviewGrading:buildReviewGradingRow(extra.reviewGradingText,extra.reviewGradingBadge),
review:buildReviewRow(extra.reviewSummaryText,extra.reviewUrl),
steamReviews:buildSteamReviewsRow(NS.extractSteamReviews()),
award:buildAwardRow(awardData),
esrb:buildEsrbRow(esrbImgSrc,esrbAlt,esrbDescriptors),
developer:buildDevRow(developerName),
publisher:buildPublisherRow(extra.publisherName),
genres:buildGenresRow(extra.genres),
platforms:buildPlatformsRow(extra.platforms),
features:buildFeaturesRow(extra.features),
description:buildDescriptionRow(extra.description),
hltb:hltbHtml}),
leisure:"inline"===leisureLoc&&NS.getConfig("showLeisure")?'<div class="ign_leisure_placeholder"></div>':""
}),hasRealContent=!!mainHtml.replace(/<div class="ign_leisure_placeholder"><\/div>/g,"").trim()
;return hasRealContent&&insertBadge(makeCtn("ign_rating_row",BADGE_STYLE,mainHtml)),
hasRealContent||"inline"!==NS.getSectionLocation("hltb")?resolvedHltbUrl:null
},NS.renderMultiGameBadge=function(games,gameTitle){
if(!NS.getTargetInsertionPoint())return""
;document.querySelector(".ign_rating_row")?.remove(),
clearAllGroupStandalones()
;const primary=games.find(g=>g.parsed),p=primary?primary.parsed:null,resolvedHltbUrl=p?resolveHltbUrl(p.hltbUrl,gameTitle):"",leisureLoc=NS.getSectionLocation("leisure"),hltbHtml=p?buildHltbRow(p.hltbData,resolvedHltbUrl):"",mainHtml=buildSectionHtml({
...placeSections({scores:buildMultiGameTopRow(games),
reviewGrading:p?buildReviewGradingRow(p.reviewGradingText,p.reviewGradingBadge):"",
review:p?buildReviewRow(p.reviewSummaryText,p.reviewUrl):"",
steamReviews:buildSteamReviewsRow(NS.extractSteamReviews()),
award:p?buildAwardRow(p.awardData):"",
esrb:p?buildEsrbRow(p.esrbImgSrc,p.esrbAlt,p.esrbDescriptors):"",
developer:p?buildDevRow(p.developerName):"",
publisher:p?buildPublisherRow(p.publisherName):"",
genres:p?buildGenresRow(p.genres):"",
platforms:p?buildPlatformsRow(p.platforms):"",
features:p?buildFeaturesRow(p.features):"",
description:p?buildDescriptionRow(p.description):"",
hltb:hltbHtml}),
leisure:p&&"inline"===leisureLoc&&NS.getConfig("showLeisure")?'<div class="ign_leisure_placeholder"></div>':""
})
;return insertBadge(makeCtn("ign_rating_row",BADGE_STYLE,mainHtml)),p?resolvedHltbUrl:""
},NS.fillLeisurePlaceholder=function(html){
const placeholder=document.querySelector(".ign_leisure_placeholder")
;placeholder&&(placeholder.outerHTML=html||"")
},NS.renderEmpty=(status,targetUrl,gameTitle)=>NS.renderCompleteBadge(status,status,[],"","","","","",null,targetUrl,gameTitle),
NS.renderSettingsGearStandalone=function(){
if(document.querySelector(".ign_settings_gear_standalone"))return
;const targetObj=NS.getTargetInsertionPoint("sidebarBottom")
;targetObj&&insertAtTarget(makeCtn("ign_settings_gear_standalone","display:flex;align-items:center;justify-content:flex-end;padding:6px 2px;grid-column:1/-1;",'<button type="button" class="ign_open_settings_gear" title="IGN Metadata Injector settings" style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#a1b0bd;cursor:pointer;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;padding:5px 10px;">⚙ Settings</button>'),targetObj)
}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),function(NS){
"use strict";function buildSettingsPanelHtml(){
const enableRows=NS.PLATFORMS.map(p=>`<label class="ign_settings_toggle_row"><span>Enable on ${p}</span><span class="ign_switch"><input type="checkbox" data-site-enable="${p}" ${NS.getSiteEnabled(p)?"checked":""}><span class="ign_switch_slider"></span></span></label>`).join(""),shared=NS.getPlacementShared(),placementPlatforms=NS.getVisiblePlatforms(),separatePlatforms=placementPlatforms.length?placementPlatforms:NS.PLATFORMS,isKeySeparate=key=>separatePlatforms.some(p=>"inline"!==NS.getSectionLocationFor(key,p)),orderRows=NS.getSectionOrder().map(key=>`<li class="ign_order_item" draggable="true" data-key="${key}"><label class="ign_separate_checkbox_wrap"><input type="checkbox" class="ign_separate_checkbox" data-key="${key}" ${isKeySeparate(key)?"checked":""}></label><span class="ign_order_handle">⠿</span><span style="flex:1;">${NS.escapeHtml(NS.SECTION_LABELS[key]||key)}</span><label class="ign_switch"><input type="checkbox" class="ign_visible_checkbox" data-key="${key}" ${(key=>(NS.SECTION_CONFIG_KEYS[key]||[]).some(ck=>NS.getConfig(ck)))(key)?"checked":""}><span class="ign_switch_slider"></span></label></li>`).join(""),combineAllChecked=separatePlatforms.some(p=>NS.getCombineAllFor(p)),platformLabelHtml=platform=>shared?"":`<label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${platform}</label>`,userOverrides=NS.getUserOverrides(),overrideKeys=Object.keys(userOverrides),overrideRowsHtml=0===overrideKeys.length?"":overrideKeys.map(key=>{
const entry=userOverrides[key],pills=[entry.ignUrl?'<span class="ign_override_pill">IGN</span>':"",entry.hltbUrl?'<span class="ign_override_pill ign_override_pill_hltb">HLTB</span>':""].join("")
;return`<li class="ign_override_item"><span class="ign_override_item_main"><strong title="${NS.escapeHtml(entry.displayTitle||key)}">${NS.escapeHtml(entry.displayTitle||key)}</strong>${pills}</span><button class="ign_override_remove" data-key="${NS.escapeHtml(key)}" title="Remove override">✕</button></li>`
}).join("")
;return`\n            \n        <style>\n            #ign_settings_overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\n            #ign_settings_panel { background: linear-gradient(135deg, rgba(20,20,20,0.98), rgba(35,35,35,0.98)); border-radius: 10px; border-left: 5px solid #ff3e3e; box-shadow: 0 8px 30px rgba(0,0,0,0.6); width: 520px; max-width: 92vw; max-height: 85vh; overflow-y: auto; padding: 20px 22px; color: #ffffff; } #ign_settings_panel h2 { margin: 0 0 4px; font-size: 16px; color: #ff3e3e; text-transform: uppercase; letter-spacing: 0.5px; }\n            #ign_settings_panel h3 { margin: 0 0 10px; font-size: 11px; color: #a1b0bd; text-transform: uppercase; letter-spacing: 0.5px; } .ign_settings_sub { font-size: 11px; color: #8f98a0; margin: 0 0 18px; } .ign_settings_columns { display: flex; gap: 22px; flex-wrap: wrap; } .ign_settings_columns > div { flex: 1; min-width: 210px; }\n            .ign_settings_toggle_row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; font-size: 12px; color: #c6d4df; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; } .ign_switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; margin-left: 10px; } .ign_switch input { opacity: 0; width: 0; height: 0; }\n            .ign_switch_slider { position: absolute; inset: 0; background: rgba(255,255,255,0.15); border-radius: 20px; transition: 0.2s; } .ign_switch_slider::before { content: ""; position: absolute; height: 14px; width: 14px; left: 3px; top: 3px; background: #ffffff; border-radius: 50%; transition: 0.2s; } .ign_switch input:checked + .ign_switch_slider { background: #66c0f4; } .ign_switch input:checked + .ign_switch_slider::before { transform: translateX(16px); }\n            #ign_order_list { list-style: none; margin: 0; padding: 0; } .ign_order_item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; cursor: grab; } .ign_order_item.ign_drag_over { border: 1px dashed #66c0f4; } .ign_order_handle { color: #8f98a0; font-size: 14px; } .ign_settings_actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }\n            .ign_order_list_header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; } .ign_order_list_header h3 { margin: 0; flex: 1; text-align: center; }\n            .ign_separate_col_label { flex-shrink: 0; width: 58px; font-size: 10px; color: #a1b0bd; text-transform: uppercase; font-weight: bold; letter-spacing: 0.2px; line-height: 1.15; }\n            .ign_visible_col_label { flex-shrink: 0; width: 58px; text-align: right; font-size: 10px; color: #a1b0bd; text-transform: uppercase; font-weight: bold; letter-spacing: 0.2px; line-height: 1.15; }\n            .ign_separate_checkbox_wrap { flex-shrink: 0; display: flex; align-items: center; }\n            .ign_separate_checkbox { width: 15px; height: 15px; accent-color: #66c0f4; cursor: pointer; }\n            .ign_order_item .ign_switch { margin-left: auto; }\n            .ign_settings_actions button { border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; } #ign_settings_save { background: #ff3e3e; color: #ffffff; } #ign_settings_cancel { background: rgba(255,255,255,0.1); color: #c6d4df; }\n            .ign_settings_select { width: 100%; background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; } .ign_settings_columns > div, .ign_locations_row > div { flex: 1; min-width: 200px; } .ign_locations_row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 18px; } #ign_override_list { list-style: none; margin: 0 0 10px; padding: 0; max-height: 160px; overflow-y: auto; }\n            .ign_key_location_block { margin-top: 10px; } .ign_key_location_block h3, #ign_overlay_position_heading { margin-top: 4px; font-weight: bold; color: #c6d4df; font-size: 12px; }\n            .ign_override_item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; } .ign_override_item_main { display: flex; align-items: center; gap: 8px; overflow: hidden; } .ign_override_item_main strong { font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n            .ign_override_pill { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; color: #ff3e3e; border: 1px solid rgba(255,62,62,0.5); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; } .ign_override_pill_hltb { color: #66c0f4; border-color: rgba(102,192,244,0.5); } .ign_override_remove { background: transparent; border: none; color: #8f98a0; cursor: pointer; font-size: 13px; padding: 2px 6px; flex-shrink: 0; } .ign_override_remove:hover { color: #ff3e3e; }\n            .ign_override_empty { font-size: 11px; color: #8f98a0; margin: 0 0 10px; } .ign_override_form { display: flex; flex-direction: column; gap: 6px; } .ign_override_form input { background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }\n            .ign_override_form button { align-self: flex-end; border: none; border-radius: 6px; padding: 7px 14px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; background: rgba(102,192,244,0.15); color: #66c0f4; }\n        </style>\n            <div id="ign_settings_overlay">\n                <div id="ign_settings_panel">\n                    <h2>IGN Script Settings</h2>\n                    <p class="ign_settings_sub">Changes apply immediately on save — no page refresh needed.</p>\n                    <div class="ign_settings_columns">\n                        <div>\n                            <div class="ign_order_list_header"><span class="ign_separate_col_label">Separate Entry</span><h3>Section Order (drag to reorder)</h3><span class="ign_visible_col_label">Visible</span></div>\n                            <ul id="ign_order_list">${orderRows}</ul>\n                            <div style="margin-top:4px;">\n                                <label class="ign_settings_toggle_row" style="border-bottom:none;">\n                                    <span>Combine all entries in one place</span>\n                                    <span class="ign_switch"><input type="checkbox" id="ign_combine_all" ${combineAllChecked?"checked":""}><span class="ign_switch_slider"></span></span>\n                                </label>\n                                <div id="ign_combine_all_locations" class="ign_locations_row" style="margin-top:8px;${combineAllChecked?"":"display:none;"}">${placementPlatforms.map(platform=>{
const current=NS.getCombineLocationFor(platform),opts=NS.LOCATION_OPTIONS.map(opt=>`<option value="${opt.value}" ${opt.value===current?"selected":""}>${NS.escapeHtml(opt.label)}</option>`).join("")
;return`<div>${platformLabelHtml(platform)}<select id="ign_combine_location_${platform}" class="ign_settings_select">${opts}</select></div>`
}).join("")}</div>\n                            </div>\n                        </div>\n                    </div>\n                    <div style="margin-top:18px;"><h3>Enable / Disable Per Site</h3>${enableRows}</div>\n                    <div style="margin-top:18px;">\n                        <label class="ign_settings_toggle_row" style="border-bottom:none;">\n                            <span>Share the same placement for Steam and Epic</span>\n                            <span class="ign_switch"><input type="checkbox" id="ign_placement_shared" ${shared?"checked":""}><span class="ign_switch_slider"></span></span>\n                        </label>\n                    </div>\n                    ${0===placementPlatforms.length?'<p class="ign_settings_sub">Enable at least one site above to configure placement.</p>':`\n                    <div style="margin-top:10px;"><h3 id="ign_overlay_position_heading">Overlay Position</h3><div class="ign_locations_row">${placementPlatforms.map(platform=>{
const current=NS.getBadgePositionFor(platform),opts=NS.BADGE_POSITION_OPTIONS.map(opt=>`<option value="${opt.value}" ${opt.value===current?"selected":""}>${NS.escapeHtml(opt.label)}</option>`).join("")
;return`<div>${platformLabelHtml(platform)}<select id="ign_badge_position_${platform}" class="ign_settings_select">${opts}</select></div>`
}).join("")}</div></div>\n                    <div id="ign_key_locations_wrap" style="${combineAllChecked?"display:none;":""}">${NS.getSectionOrder().filter(isKeySeparate).map(key=>((key,platforms)=>{
const heading=NS.SECTION_LABELS[key]||key
;return`<div class="ign_key_location_block" data-key-location-block="${key}"><h3>${NS.escapeHtml(heading)}</h3><div class="ign_locations_row">${platforms.map(p=>((key,platform)=>{
const current=NS.getSectionLocationFor(key,platform),opts=NS.LOCATION_OPTIONS.map(opt=>`<option value="${opt.value}" ${opt.value===current?"selected":""}>${NS.escapeHtml(opt.label)}</option>`).join("")
;return`<div>${platformLabelHtml(platform)}<select id="ign_${key}_location_${platform}" class="ign_settings_select" data-key="${key}" data-platform="${platform}">${opts}</select></div>`
})(key,p)).join("")}</div></div>`
})(key,placementPlatforms)).join("")}</div>\n                    <div id="ign_shared_location_notes" style="${combineAllChecked?"display:none;":""}"></div>`}\n                    <div style="margin-top:18px;">\n                        <h3>Per-Title Overrides</h3>\n                        <p class="ign_settings_sub" style="margin-bottom:8px;">Add/Override IGN/HowLongToBeat data. Useful when no data is found.</p>\n                        ${0===overrideKeys.length?'<p class="ign_override_empty">No overrides added yet.</p>':`<ul id="ign_override_list">${overrideRowsHtml}</ul>`}\n                        <div class="ign_override_form">\n                            <input type="text" id="ign_override_title" placeholder="Game title, exactly as shown on the store page">\n                            <input type="text" id="ign_override_ign_url" placeholder="IGN URL (optional) — e.g. https://www.ign.com/games/some-slug">\n                            <input type="text" id="ign_override_hltb_url" placeholder="HowLongToBeat URL (optional) — e.g. https://howlongtobeat.com/game/1234">\n                            <button id="ign_override_add">Add / Update</button>\n                        </div>\n                    </div>\n                    <div class="ign_settings_actions"><button id="ign_settings_cancel">Cancel</button><button id="ign_settings_save">Save</button></div>\n                </div>\n            </div>`
}function refreshBadgeNow(){
NS.state.lastProcessedTitle="",document.querySelector(".ign_rating_row")?.remove(),
NS.init()}NS.openSettingsPanel=function(){
const prevOverlay=document.getElementById("ign_settings_overlay"),snapshot=function(overlay,list){
if(!overlay||!list)return null
;const mapChecked=sel=>Array.from(overlay.querySelectorAll(sel)).reduce((m,el)=>(m[el.dataset.key]=el.checked,
m),{}),mapValues=sel=>Array.from(overlay.querySelectorAll(sel)).reduce((m,el)=>(m[el.id]=el.value,
m),{});return{
order:Array.from(list.querySelectorAll(".ign_order_item")).map(li=>li.dataset.key),
visible:mapChecked(".ign_visible_checkbox"),
separate:mapChecked(".ign_separate_checkbox"),
combineAll:overlay.querySelector("#ign_combine_all")?overlay.querySelector("#ign_combine_all").checked:null,
locationSelects:mapValues("[data-key-location-block] select"),
combineLocationSelects:mapValues('[id^="ign_combine_location_"]'),
positionSelects:mapValues('[id^="ign_badge_position_"]')}
}(prevOverlay,prevOverlay?prevOverlay.querySelector("#ign_order_list"):null)
;prevOverlay?.remove(),
document.body.insertAdjacentHTML("beforeend",buildSettingsPanelHtml())
;const overlay=document.getElementById("ign_settings_overlay"),list=document.getElementById("ign_order_list")
;function syncSharedLocationNotes(){
const container=overlay.querySelector("#ign_shared_location_notes")
;if(!container)return
;const order=Array.from(list.querySelectorAll(".ign_order_item")).map(li=>li.dataset.key),shared=NS.getPlacementShared(),sections=[]
;NS.getVisiblePlatforms().forEach(platform=>{
const groups=function(overlay,platform){const byLoc={}
;return overlay.querySelectorAll(`[data-key-location-block] select[data-platform="${platform}"]`).forEach(sel=>{
(byLoc[sel.value]=byLoc[sel.value]||[]).push(sel.dataset.key)
}),Object.keys(byLoc).filter(loc=>"inline"!==loc&&byLoc[loc].length>1).map(loc=>({
loc:loc,keys:byLoc[loc]}))}(overlay,platform)
;if(!groups.length)return;const lines=groups.map(g=>{
const names=order.filter(k=>g.keys.includes(k)).map(k=>NS.escapeHtml(NS.SECTION_LABELS[k]||k)).join(" ; ")
;return`<strong style="color:#c6d4df;">${NS.escapeHtml((NS.LOCATION_OPTIONS.find(o=>o.value===g.loc)||{}).label||g.loc)}</strong> : ${names}`
}),prefix=shared?"":`<strong style="color:#c6d4df;">${NS.escapeHtml(platform)}</strong><br>`
;sections.push(`${prefix}${lines.join("<br>")}`)
}),container.innerHTML=sections.length?`<p class="ign_settings_sub" style="margin-top:10px;margin-bottom:0;"><strong style="color:#c6d4df;">Overlapping Locations:</strong><br>${sections.join("<br>")}<br><br><span style="opacity:0.8;">Drag items in Section Order above to change their combined order.</span></p>`:""
}!function(listEl){let draggedItem=null
;listEl.querySelectorAll(".ign_order_item").forEach(item=>{
item.addEventListener("dragstart",()=>{
draggedItem=item,item.style.opacity="0.4"
}),item.addEventListener("dragend",()=>{
item.style.opacity="1",item.classList.remove("ign_drag_over")
}),item.addEventListener("dragover",e=>{
if(e.preventDefault(),!draggedItem||draggedItem===item)return
;const bounds=item.getBoundingClientRect(),isAfter=e.clientY-bounds.top>bounds.height/2
;item.parentNode.insertBefore(draggedItem,isAfter?item.nextSibling:item)
})})
}(list),syncSharedLocationNotes(),overlay.querySelectorAll(".ign_separate_checkbox").forEach(checkbox=>{
checkbox.addEventListener("change",()=>{
const key=checkbox.dataset.key,wrap=overlay.querySelector("#ign_key_locations_wrap")
;if(!wrap)return
;const existing=wrap.querySelector(`[data-key-location-block="${key}"]`)
;if(checkbox.checked&&!existing){
const platforms=NS.getVisiblePlatforms(),shared=NS.getPlacementShared(),opts=NS.LOCATION_OPTIONS.map(opt=>`<option value="${opt.value}" ${"belowGameMedia"===opt.value?"selected":""}>${NS.escapeHtml(opt.label)}</option>`).join(""),heading=NS.SECTION_LABELS[key]||key,selects=platforms.map(p=>`<div>${shared?"":`<label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${p}</label>`}<select id="ign_${key}_location_${p}" class="ign_settings_select" data-key="${key}" data-platform="${p}">${opts}</select></div>`).join("")
;wrap.insertAdjacentHTML("beforeend",`<div class="ign_key_location_block" data-key-location-block="${key}"><h3>${NS.escapeHtml(heading)}</h3><div class="ign_locations_row">${selects}</div></div>`),
wrap.querySelectorAll(`[data-key-location-block="${key}"] select`).forEach(sel=>sel.addEventListener("change",syncSharedLocationNotes))
}else!checkbox.checked&&existing&&existing.remove()
;syncSharedLocationNotes()})
}),overlay.querySelectorAll("[data-key-location-block] select").forEach(sel=>sel.addEventListener("change",syncSharedLocationNotes)),
list.addEventListener("dragend",syncSharedLocationNotes)
;const combineAllCheckbox=overlay.querySelector("#ign_combine_all"),combineAllLocations=overlay.querySelector("#ign_combine_all_locations"),keyLocationsWrap=overlay.querySelector("#ign_key_locations_wrap"),sharedLocationNotes=overlay.querySelector("#ign_shared_location_notes")
;combineAllCheckbox&&combineAllCheckbox.addEventListener("change",function(){
const on=combineAllCheckbox.checked
;combineAllLocations&&(combineAllLocations.style.display=on?"":"none"),
keyLocationsWrap&&(keyLocationsWrap.style.display=on?"none":""),
sharedLocationNotes&&(sharedLocationNotes.style.display=on?"none":"")
}),function(overlay,list,snap){if(snap){
if(snap.order.forEach(key=>{
const li=list.querySelector(`.ign_order_item[data-key="${key}"]`)
;li&&list.appendChild(li)
}),Object.keys(snap.visible).forEach(key=>{
const cb=overlay.querySelector(`.ign_visible_checkbox[data-key="${key}"]`)
;cb&&(cb.checked=snap.visible[key])
}),Object.keys(snap.separate).forEach(key=>{
const cb=overlay.querySelector(`.ign_separate_checkbox[data-key="${key}"]`)
;cb&&cb.checked!==snap.separate[key]&&(cb.checked=snap.separate[key],
cb.dispatchEvent(new Event("change",{bubbles:!0})))
}),null!==snap.combineAll){
const cb=overlay.querySelector("#ign_combine_all")
;cb&&cb.checked!==snap.combineAll&&(cb.checked=snap.combineAll,
cb.dispatchEvent(new Event("change",{bubbles:!0})))}
[snap.locationSelects,snap.combineLocationSelects,snap.positionSelects].forEach(map=>{
Object.keys(map).forEach(id=>{
const sel=overlay.querySelector("#"+id)
;sel&&(sel.value=map[id])})})}
}(overlay,list,snapshot),syncSharedLocationNotes(),
overlay.querySelectorAll(".ign_override_remove").forEach(btn=>btn.addEventListener("click",()=>{
NS.removeUserOverride(btn.dataset.key),
refreshBadgeNow(),NS.openSettingsPanel()
})),overlay.querySelector("#ign_override_add").addEventListener("click",()=>{
const title=overlay.querySelector("#ign_override_title").value.trim(),ignUrl=overlay.querySelector("#ign_override_ign_url").value.trim(),hltbUrl=overlay.querySelector("#ign_override_hltb_url").value.trim()
;title&&(ignUrl||hltbUrl)&&(NS.setUserOverride(title,ignUrl,hltbUrl),
refreshBadgeNow(),NS.openSettingsPanel())
}),overlay.querySelector("#ign_placement_shared").addEventListener("change",e=>{
NS.setPlacementShared(e.target.checked),
NS.openSettingsPanel()
}),overlay.querySelectorAll("input[data-site-enable]").forEach(input=>input.addEventListener("change",()=>{
NS.setSiteEnabled(input.dataset.siteEnable,input.checked),
refreshBadgeNow(),NS.openSettingsPanel()
})),overlay.addEventListener("click",e=>{
e.target===overlay&&overlay.remove()
}),overlay.querySelector("#ign_settings_cancel").addEventListener("click",()=>overlay.remove()),
overlay.querySelector("#ign_settings_save").addEventListener("click",()=>{
list.querySelectorAll(".ign_visible_checkbox").forEach(cb=>{
(NS.SECTION_CONFIG_KEYS[cb.dataset.key]||[]).forEach(configKey=>NS.storage.set(configKey,cb.checked))
}),
NS.setSectionOrder(Array.from(list.querySelectorAll(".ign_order_item")).map(li=>li.dataset.key))
;const shared=NS.getPlacementShared(),combineAllChecked=!!combineAllCheckbox&&combineAllCheckbox.checked
;NS.getVisiblePlatforms().forEach(platform=>{
const targets=shared?NS.PLATFORMS:[platform]
;targets.forEach(p=>NS.setCombineAllFor(p,combineAllChecked))
;const combineSel=overlay.querySelector(`#ign_combine_location_${platform}`)
;combineSel&&targets.forEach(p=>NS.setCombineLocationFor(p,combineSel.value))
;const posSel=overlay.querySelector(`#ign_badge_position_${platform}`)
;posSel&&targets.forEach(p=>NS.setBadgePositionFor(p,posSel.value)),
NS.getSectionOrder().forEach(key=>{
const sel=overlay.querySelector(`#ign_${key}_location_${platform}`)
;targets.forEach(p=>NS.setSectionLocationFor(key,p,sel?sel.value:"inline"))
})
}),overlay.remove(),NS.registerMenuCommands(),refreshBadgeNow()
})},NS.openSettings=function(){
"undefined"!=typeof chrome&&chrome.runtime&&"function"==typeof chrome.runtime.openOptionsPage?chrome.runtime.openOptionsPage():NS.openSettingsPanel()
},document.addEventListener("click",e=>{
e.target.closest&&e.target.closest(".ign_open_settings_gear")&&NS.openSettings()
})
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),function(NS){
"use strict";NS.fetchIgnSearch=function(term,callback){
const variables=JSON.stringify({term:term,count:20,
objectType:"Game"}),extensions=JSON.stringify({
persistedQuery:{version:1,
sha256Hash:"e1c2e012a21b4a98aaa618ef1b43eb0cafe9136303274a34f5d9ea4f2446e884"
}
}),url=`https://mollusk.apis.ign.com/graphql?operationName=SearchObjectsByName&variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`
;NS.http.get(url,{onload:function(response){
if(200!==response.status)return callback(null);try{
const best=function(results,searchTerm){
if(!results.length)return null
;const titleWords=new Set(searchTerm.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>2))
;let best=null,bestScore=-1/0
;return results.forEach((r,index)=>{
const words=new Set(r.text.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/))
;let overlap=0;titleWords.forEach(w=>{
words.has(w)&&overlap++});const score=overlap-.01*index
;score>bestScore&&(bestScore=score,best=r)}),best
}(function(json){const results=[],seen=new Set
;function addCandidate(slug,text){if(!slug)return
;const cleanSlug=String(slug).replace(/^\/+|\/+$/g,"").replace(/^games\//,"").toLowerCase()
;cleanSlug&&!seen.has(cleanSlug)&&(seen.add(cleanSlug),
results.push({slug:cleanSlug,
text:text||cleanSlug.replace(/-/g," ")}))}
return function walk(node){
if(results.length>30||!node||"object"!=typeof node)return
;if(Array.isArray(node))return void node.forEach(walk)
;const name="string"==typeof node.name?node.name:"string"==typeof node.title?node.title:""
;if("string"==typeof node.slug&&node.slug&&addCandidate(node.slug,name),
"string"==typeof node.url&&/\/games\//i.test(node.url)){
const match=node.url.match(/\/games\/([a-z0-9-]+)/i)
;match&&addCandidate(match[1],name)}
Object.values(node).forEach(walk)}(json),results
}(JSON.parse(response.responseText)),term);callback(best?{
slug:best.slug,url:`https://www.ign.com/games/${best.slug}`
}:null)}catch(e){callback(null)}},onerror:function(){
callback(null)}})},NS.parseIgnPage=function(doc){
let fetchedGameTitle=""
;const h1TitleEl=doc.querySelector('h1[data-cy="object-header-display-title"]')||doc.querySelector("h1.display-title")
;h1TitleEl&&h1TitleEl.textContent.trim()&&(fetchedGameTitle=h1TitleEl.textContent.trim())
;let ignScore="N/A"
;if(doc.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{
try{const data=JSON.parse(script.textContent)
;data.reviewRating?.ratingValue&&(ignScore=String(data.reviewRating.ratingValue))
}catch(e){}}),"N/A"===ignScore){
const el=doc.querySelector('[data-cy="review-score-hexagon-content-wrapper"] figcaption')
;el&&(ignScore=el.textContent.trim())}let userScore="N/A"
;const userReviewsLink=doc.querySelector('a[href*="/user-reviews"]'),ratingEl=userReviewsLink&&userReviewsLink.querySelector('[data-cy="score-rating-small"]')
;if(ratingEl&&(userScore=ratingEl.textContent.trim()),
"N/A"===userScore){
const smallScoreEls=doc.querySelectorAll('[data-cy="score-rating-small"]')
;smallScoreEls.length>0&&(userScore=smallScoreEls[smallScoreEls.length-1].textContent.trim())
}
const summaryBox=doc.querySelector('[data-cy="object-summary-box"]')||doc
;let developerName=""
;const devEl=summaryBox.querySelector('[data-cy="developers-info"] [data-cy="developerLink"]')||summaryBox.querySelector('[data-cy="developers-info"] [data-cy="producerLink"]')||summaryBox.querySelector('[data-cy="developers-info"] a')
;devEl&&devEl.textContent.trim()&&(developerName=devEl.textContent.trim())
;let publisherName=""
;const pubEl=summaryBox.querySelector('[data-cy="publishers-info"] [data-cy="publisherLink"]')||summaryBox.querySelector('[data-cy="publishers-info"] a')
;pubEl&&pubEl.textContent.trim()&&(publisherName=pubEl.textContent.trim())
;let esrbImgSrc="",esrbAlt="",esrbDescriptors=""
;const ageRatingEl=summaryBox.querySelector('a[data-cy="object-age-rating"]')
;if(ageRatingEl){const img=ageRatingEl.querySelector("img")
;img&&(esrbImgSrc=img.getAttribute("src")||"",
esrbAlt=img.getAttribute("alt")||""),
esrbAlt||(esrbAlt=ageRatingEl.getAttribute("title")||"")
;const descEl=ageRatingEl.parentElement&&ageRatingEl.parentElement.querySelector('[data-cy="content-rating-description"]')
;descEl&&(esrbDescriptors=descEl.textContent.trim())}else{
const esrbImgEl=summaryBox.querySelector('img[data-cy^="icon-esrb"]')||summaryBox.querySelector('img[alt*="ESRB:"]')
;esrbImgEl&&(esrbImgSrc=esrbImgEl.getAttribute("src"),
esrbAlt=esrbImgEl.getAttribute("alt")||"ESRB Rating")}
if(esrbAlt&&esrbAlt.includes(":")){
const[firstPart,...rest]=esrbAlt.split(":"),label=firstPart.trim(),remainder=rest.join(":").trim()
;/^esrb$/i.test(label)?esrbAlt=remainder:(esrbAlt=label,
esrbDescriptors||(esrbDescriptors=remainder))}
if(esrbAlt=NS.normalizeEsrbLabel(esrbAlt),!esrbDescriptors){
const descContainer=summaryBox.querySelector('[data-cy*="esrb-descriptors"]')||summaryBox.querySelector(".esrb-descriptors")
;descContainer&&(esrbDescriptors=descContainer.textContent.trim())
}let description=""
;const descriptionEl=summaryBox.querySelector('[data-cy="summary-info"] [data-cy="content-rating-description"]')
;descriptionEl&&(description=descriptionEl.textContent.trim())
;const genres=[]
;summaryBox.querySelectorAll('[data-cy="genres-info"] a[data-cy="genreLink"]').forEach(a=>{
const t=a.textContent.trim();t&&genres.push(t)})
;const features=[]
;summaryBox.querySelectorAll('[data-cy="features-info"] a[data-cy="featureLink"]').forEach(a=>{
const t=a.textContent.trim();t&&features.push(t)})
;const platforms=[]
;summaryBox.querySelectorAll('[data-cy="platforms-info"] a.platform-icon').forEach(a=>{
const img=a.querySelector("img"),name=a.getAttribute("title")||img&&img.getAttribute("alt")||""
;name&&platforms.push({name:name,
iconSrc:img?img.getAttribute("src"):""})})
;let reviewGradingText="",reviewGradingBadge="",reviewSummaryText="",reviewUrl=""
;const reviewRoot=doc.querySelector(".review-details")
;if(reviewRoot){
const gradingEl=reviewRoot.querySelector('[data-cy="title1"]')
;gradingEl&&(reviewGradingText=gradingEl.textContent.trim())
;const badgeEl=reviewRoot.querySelector('.tag [data-cy="caption"]')
;badgeEl&&(reviewGradingBadge=badgeEl.textContent.trim())
;const subtitleEl=reviewRoot.querySelector('[data-cy="article-subtitle"]')
;subtitleEl&&(reviewSummaryText=subtitleEl.textContent.trim())
;const reviewLinkEl=reviewRoot.querySelector('[data-cy="article-review-link"]')
;if(reviewLinkEl){
const href=reviewLinkEl.getAttribute("href")||""
;href&&(reviewUrl=/^https?:\/\//i.test(href)?href:`https://www.ign.com${href.startsWith("/")?"":"/"}${href}`)
}}let awardData=null
;const awardEl=doc.querySelector('figure[data-cy="review-score"].icon-award')||doc.querySelector('[class*="icon-award"]')
;if(awardEl){
const rankText=awardEl.querySelector("figcaption")?.textContent.trim()||"",labelType=awardEl.className.includes("icon-award-gold")?"Gold Rank":awardEl.className.includes("icon-award-silver")?"Silver Rank":awardEl.className.includes("icon-award-bronze")?"Bronze Rank":"Global Rank"
;rankText&&(awardData={rank:rankText,label:labelType})}
const hltbData=[];let hltbUrl=""
;const hltbContent=doc.querySelector('[data-cy="hl2b-content"]')||doc.querySelector(".hl2b-content")
;if(hltbContent){
hltbContent.querySelectorAll('.meta-item, [data-cy$="meta-item"]').forEach(item=>{
const timeEl=item.querySelector('.title4, [data-cy="title4"]'),captionEl=item.querySelector('.caption, [data-cy="caption"]')
;timeEl&&captionEl&&hltbData.push({
time:timeEl.textContent.trim(),
label:captionEl.textContent.trim()})})
;const hltbLinkEl=hltbContent.closest('a[href*="howlongtobeat.com"]')||hltbContent.querySelector('a[href*="howlongtobeat.com"]')
;hltbLinkEl&&(hltbUrl=hltbLinkEl.getAttribute("href"))}
if(!hltbUrl){
const anyHltbLink=doc.querySelector('a[href*="howlongtobeat.com"]')
;anyHltbLink&&(hltbUrl=anyHltbLink.getAttribute("href"))}
return{fetchedGameTitle:fetchedGameTitle,ignScore:ignScore,
userScore:userScore,developerName:developerName,
publisherName:publisherName,esrbImgSrc:esrbImgSrc,
esrbAlt:esrbAlt,esrbDescriptors:esrbDescriptors,
awardData:awardData,hltbData:hltbData,hltbUrl:hltbUrl,
description:description,genres:genres,features:features,
platforms:platforms,reviewGradingText:reviewGradingText,
reviewGradingBadge:reviewGradingBadge,
reviewSummaryText:reviewSummaryText,reviewUrl:reviewUrl}
},NS.resolveFirstWorkingUrl=function(candidateUrls,callback){
!function tryNext(index){
if(index>=candidateUrls.length)return callback(null)
;const url=candidateUrls[index];NS.http.get(url,{
onload:function(response){
if(200!==response.status)return tryNext(index+1)
;let parsed=null;try{
parsed=NS.parseIgnPage((new DOMParser).parseFromString(response.responseText,"text/html"))
}catch(e){parsed=null}callback({url:url,parsed:parsed})},
onerror:function(){tryNext(index+1)}})}(0)
},NS.gameEntryFromResult=function(result,fallbackName){
const p=result.parsed;return{
name:p&&p.fetchedGameTitle||fallbackName,url:result.url,
ignScore:p?p.ignScore:"N/A",userScore:p?p.userScore:"N/A",
parsed:p}}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),function(NS){
"use strict";function parseHltbTableColumn(doc,columnName){
const table=doc.querySelector('table[class*="GameTimeTable"]')
;if(!table)return[]
;const colIndex=Array.from(table.querySelectorAll("thead td, thead th")).map(td=>td.textContent.trim().toLowerCase()).indexOf(columnName.toLowerCase())
;if(-1===colIndex)return[];const results=[]
;return table.querySelectorAll("tbody tr").forEach(row=>{
const cells=row.querySelectorAll("td")
;if(cells.length<=colIndex)return
;const label=cells[0].textContent.trim()
;if(!label||/all\s*playstyles/i.test(label))return
;const time=cells[colIndex].textContent.trim()
;time&&results.push({label:label,time:time})}),results}
NS.HLTB_SOURCE_OVERRIDES={
"final fantasy vii remake intergrade":"https://www.ign.com/games/final-fantasy-vii-remake"
},NS.HLTB_DIRECT_URL_OVERRIDES={
"ninja gaiden 3: razor's edge":"https://howlongtobeat.com/game/6623",
"ninja gaiden 3: razor's edge [ninja gaiden: master collection]":"https://howlongtobeat.com/game/6623",
"kingdom hearts -hd 1.5+2.5 remix-":"https://howlongtobeat.com/game/42802",
"schrodinger's cat burglar":"https://howlongtobeat.com/game/184497"
},NS.fetchHltbOverride=function(url,callback){
const empty=()=>callback({hltbData:[],hltbUrl:""})
;NS.http.get(url,{onload:function(response){
if(200!==response.status)return empty();try{
const p=NS.parseIgnPage((new DOMParser).parseFromString(response.responseText,"text/html"))
;callback({hltbData:p.hltbData,hltbUrl:p.hltbUrl})}catch(e){
empty()}},onerror:empty})
},NS.fetchHltbDirect=function(url,callback){
const empty=()=>callback({hltbData:[],hltbUrl:url})
;NS.http.get(url,{onload:function(response){
if(200!==response.status)return empty();try{
const doc=(new DOMParser).parseFromString(response.responseText,"text/html")
;callback({hltbData:parseHltbTableColumn(doc,"average"),
hltbUrl:url})}catch(e){empty()}},onerror:empty})
},NS.fetchHltbLeisure=function(hltbUrl,callback){
if(!hltbUrl||!/howlongtobeat\.com/i.test(hltbUrl))return callback([])
;NS.http.get(hltbUrl,{onload:function(response){
if(200!==response.status)return callback([]);try{
callback(parseHltbTableColumn((new DOMParser).parseFromString(response.responseText,"text/html"),"leisure"))
}catch(e){callback([])}},onerror:()=>callback([])})}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),
function(NS){"use strict"
;function attachLeisureSection(resolvedHltbUrl){
const leisureLoc=NS.getSectionLocation("leisure")
;resolvedHltbUrl&&NS.getConfig("showLeisure")?NS.fetchHltbLeisure(resolvedHltbUrl,leisureData=>{
const html=NS.buildLeisureRow(leisureData,resolvedHltbUrl)
;"inline"===leisureLoc?(NS.fillLeisurePlaceholder(html),
NS.clearLeisureStandalones()):NS.placeLeisureAndFinalize(html,leisureLoc)
}):NS.finalizeHltbStandalone()}
function fetchPackageItems(names,originalTitle,dedicatedEntry){
const results=new Array(names.length).fill(null)
;let remaining=names.length
;if(0===names.length)return dedicatedEntry?attachLeisureSection(NS.renderMultiGameBadge([dedicatedEntry],originalTitle)):NS.renderEmpty("N/A","https://www.ign.com",originalTitle),
void(NS.state.isFetching=!1);names.forEach((name,index)=>{
!function(title,callback){
const urlsToTry=NS.buildCandidateSlugs(title).map(slug=>`https://www.ign.com/games/${slug}`)
;NS.resolveFirstWorkingUrl(urlsToTry,result=>{
if(result)return callback(result)
;NS.fetchIgnSearch(title,searchHit=>{
if(!searchHit)return callback(null)
;NS.resolveFirstWorkingUrl([searchHit.url],searchResult=>callback(searchResult))
})})}(name,result=>{
if(results[index]=result?NS.gameEntryFromResult(result,name):null,
0!==--remaining)return
;const found=results.filter(Boolean),deduped=dedicatedEntry?found.filter(g=>g.url!==dedicatedEntry.url):found,combined=dedicatedEntry?[dedicatedEntry,...deduped]:deduped
;0===combined.length?NS.renderEmpty("N/A","https://www.ign.com",originalTitle):attachLeisureSection(NS.renderMultiGameBadge(combined,originalTitle)),
NS.state.isFetching=!1})})}
function renderResolvedGame(result,gameTitle,fallbackUrl){
const{url:targetUrl,parsed:p}=result
;if(!p)return NS.renderEmpty("N/A",targetUrl||fallbackUrl,gameTitle),
void(NS.state.isFetching=!1)
;const packageNames=NS.extractPackageItemNames()
;if(packageNames.length>=2){
const dedicatedEntry=NS.gameEntryFromResult(result,p.fetchedGameTitle||gameTitle)
;return dedicatedEntry.isDedicated=!0,
fetchPackageItems(packageNames,gameTitle,dedicatedEntry)}
const finishRender=(hltbData,hltbUrl)=>{
const resolvedHltbUrl=NS.renderCompleteBadge(p.ignScore,p.userScore,hltbData,hltbUrl,p.developerName,p.esrbImgSrc,p.esrbAlt,p.esrbDescriptors,p.awardData,targetUrl,p.fetchedGameTitle,{
description:p.description,genres:p.genres,
platforms:p.platforms,publisherName:p.publisherName,
features:p.features,reviewGradingText:p.reviewGradingText,
reviewGradingBadge:p.reviewGradingBadge,
reviewSummaryText:p.reviewSummaryText,reviewUrl:p.reviewUrl
})
;NS.state.isFetching=!1,attachLeisureSection(resolvedHltbUrl)
},lookupKey=gameTitle.toLowerCase().trim(),userOverride=NS.getUserOverrideForTitle(gameTitle),directHltbUrl=userOverride&&userOverride.hltbUrl||NS.HLTB_DIRECT_URL_OVERRIDES[lookupKey],overrideUrl=NS.HLTB_SOURCE_OVERRIDES[lookupKey]
;directHltbUrl?NS.fetchHltbDirect(directHltbUrl,r=>finishRender(r.hltbData,r.hltbUrl)):overrideUrl?NS.fetchHltbOverride(overrideUrl,r=>finishRender(r.hltbData,r.hltbUrl)):finishRender(p.hltbData,p.hltbUrl)
}function fetchSingleGame(gameTitle,isFallback,onExhausted){
const urlsToTry=NS.buildCandidateSlugs(gameTitle).map(slug=>`https://www.ign.com/games/${slug}`),userOverride=NS.getUserOverrideForTitle(gameTitle)
;function finalFallback(){if(/collection/i.test(gameTitle)){
const packageNames=NS.extractPackageItemNames()
;if(packageNames.length>=2)return fetchPackageItems(packageNames,gameTitle,null)
}if(onExhausted)return onExhausted()
;NS.renderEmpty("N/A",urlsToTry[0]||"https://www.ign.com",gameTitle),
NS.state.isFetching=!1}
userOverride&&userOverride.ignUrl&&urlsToTry.unshift(userOverride.ignUrl),
NS.resolveFirstWorkingUrl(urlsToTry,result=>{
if(result)return renderResolvedGame(result,gameTitle,urlsToTry[0])
;if(!isFallback){
const baseGameName=NS.extractDlcBaseGameName()
;if(baseGameName&&baseGameName.toLowerCase().trim()!==gameTitle.toLowerCase().trim())return NS.fetchIGNData(baseGameName,{
isFallback:!0,onExhausted:onExhausted})}
NS.fetchIgnSearch(gameTitle,searchHit=>{
if(!searchHit)return finalFallback()
;NS.resolveFirstWorkingUrl([searchHit.url],searchResult=>{
if(searchResult)return renderResolvedGame(searchResult,gameTitle,urlsToTry[0])
;finalFallback()})})})}
NS.fetchIGNData=function(gameTitle,options={}){
NS.state.isFetching=!0
;const isFallback=!!options.isFallback,bundle=NS.BUNDLE_TITLE_OVERRIDES[gameTitle.toLowerCase().trim()]
;return bundle?function(bundle,gameTitle){const results=[]
;!function fetchNext(index){
if(index>=bundle.length)return attachLeisureSection(NS.renderMultiGameBadge(results,gameTitle)),
void(NS.state.isFetching=!1)
;const entry=bundle[index],url=`https://www.ign.com/games/${entry.slug}`,push=parsed=>{
results.push({name:entry.name,url:url,
ignScore:parsed?parsed.ignScore:"N/A",
userScore:parsed?parsed.userScore:"N/A",parsed:parsed
}),fetchNext(index+1)};NS.http.get(url,{
onload:function(response){let parsed=null
;if(200===response.status)try{
parsed=NS.parseIgnPage((new DOMParser).parseFromString(response.responseText,"text/html"))
}catch(e){parsed=null}push(parsed)},onerror:()=>push(null)})
}(0)
}(bundle,gameTitle):!isFallback&&gameTitle.includes("+")?function(gameTitle,callback){
const plusIndex=gameTitle.indexOf("+")
;if(-1===plusIndex)return callback(!1)
;const leftPart=gameTitle.slice(0,plusIndex).trim(),rightPart=gameTitle.slice(plusIndex+1).replace(/\(\s*dlc\s*\)/gi,"").trim()
;if(!leftPart||!rightPart)return callback(!1)
;const mergedTitle=`${leftPart} ${rightPart}`.replace(/\s+/g," ").trim(),leftUrls=NS.buildCandidateSlugs(leftPart).map(slug=>`https://www.ign.com/games/${slug}`),mergedUrls=NS.buildCandidateSlugs(mergedTitle).map(slug=>`https://www.ign.com/games/${slug}`)
;let leftResult,mergedResult,leftDone=!1,mergedDone=!1
;function maybeFinish(){
if(leftDone&&mergedDone)if(leftResult&&mergedResult&&leftResult.url!==mergedResult.url){
const games=[NS.gameEntryFromResult(leftResult,leftPart),NS.gameEntryFromResult(mergedResult,mergedTitle)]
;attachLeisureSection(NS.renderMultiGameBadge(games,gameTitle)),
NS.state.isFetching=!1,callback(!0)}else callback(!1)}
NS.resolveFirstWorkingUrl(leftUrls,r=>{
leftResult=r,leftDone=!0,maybeFinish()
}),NS.resolveFirstWorkingUrl(mergedUrls,r=>{
mergedResult=r,mergedDone=!0,maybeFinish()})
}(gameTitle,handled=>{
handled||fetchSingleGame(gameTitle,isFallback,options.onExhausted)
}):void fetchSingleGame(gameTitle,isFallback,options.onExhausted)
}
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{}),function(NS){
"use strict";NS.init=function(){
const title=NS.getGameTitle();if(!title)return
;if(NS.renderSettingsGearStandalone(),
!NS.isEnabledForCurrentSite())return
;if(title!==NS.state.lastProcessedTitle&&(NS.state.lastProcessedTitle=title,
document.querySelector(".ign_rating_row")?.remove()),
document.querySelector(".ign_rating_row")||NS.state.isFetching)return
;const titleAttempts=[],strippedTitle=NS.stripCollectionBracket(title)
;strippedTitle&&titleAttempts.push(strippedTitle),
titleAttempts.push(title)
;const sigmaFallback=NS.sigmaLetterFallbackTitle(strippedTitle||title)
;var titles
;sigmaFallback&&titleAttempts.push(sigmaFallback),titles=titleAttempts,
function attempt(index){if(index>=titles.length)return
;const isLast=index===titles.length-1
;NS.fetchIGNData(titles[index],{
onExhausted:isLast?null:()=>attempt(index+1)})}(0)
},NS.storage.ready.then(()=>{
NS.registerMenuCommands(),"undefined"!=typeof GM_registerMenuCommand&&GM_registerMenuCommand("⚙️ Open Settings Panel",NS.openSettings),
"loading"===document.readyState?document.addEventListener("DOMContentLoaded",NS.init):NS.init(),
new MutationObserver(mutations=>{
const isOwnElement=node=>1===node.nodeType&&node.className&&String(node.className).startsWith("ign_")||node.id&&String(node.id).startsWith("ign_")
;mutations.some(m=>Array.from(m.addedNodes).some(n=>!isOwnElement(n))||Array.from(m.removedNodes).some(n=>!isOwnElement(n)))&&(clearTimeout(NS.state.debounceTimer),
NS.state.debounceTimer=setTimeout(NS.init,250))
}).observe(document.body,{childList:!0,subtree:!0})})
}(window.IGN_METADATA_INJECTOR=window.IGN_METADATA_INJECTOR||{});
