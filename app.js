const DBKEY="buytiming_v5";let state={products:{},records:[]};let currentJan=null,currentProduct=null,currentStore=null,stream=null,reader=null;
const $=id=>document.getElementById(id);
function load(){try{const x=JSON.parse(localStorage.getItem(DBKEY));if(x)state=x}catch(e){}}
function save(){localStorage.setItem(DBKEY,JSON.stringify(state));renderHome()}
function today(){return new Date().toISOString().slice(0,10)}
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");window.scrollTo(0,0);if(id==="home")renderHome();if(id==="data")renderData()}
function toast(s){const t=$("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function imgSrc(p){return p?.image||""}
function renderHome(){
 $("productCount").textContent=Object.keys(state.products).length;$("recordCount").textContent=state.records.length;
 const rs=[...state.records].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 $("recent").innerHTML=rs.length?rs.map(r=>`<div class="record"><div><b>${esc(r.name)}</b><div class="muted">${esc(r.store)}・${esc(r.date)}</div></div><div class="price">¥${Number(r.price).toLocaleString()}</div></div>`).join(""):"まだ記録がありません。";
}
function lookup(){
 const p=state.products[currentJan];
 if(p){currentProduct=p;$("lookupBody").innerHTML=`<div class="card"><div class="product">${p.image?`<img src="${p.image}">`:`<div class="noimg">📦</div>`}<div><b>${esc(p.name)}</b><div class="muted">${esc(p.brand||"")}</div><div class="muted">${esc(p.qty||"")}</div></div></div><div class="score">${scoreHtml(p)}</div><button id="addPrice" class="primary">この商品の価格を記録</button><button id="editProduct" class="secondary">商品情報を編集</button></div>`;$("addPrice").onclick=()=>openPrice(p);$("editProduct").onclick=()=>openRegister(p)}else{$("lookupBody").innerHTML=`<div class="card"><div class="notice">このJANコードの商品はまだ登録されていません。</div><p class="muted">商品名と、必要なら商品写真を登録してください。</p><button id="newProduct" class="primary">この商品を登録する</button></div>`;$("newProduct").onclick=()=>openRegister(null)}
 show("lookup")
}
function scoreHtml(p){
 const rs=state.records.filter(r=>r.jan===p.jan).map(r=>Number(r.price)).filter(Boolean);
 if(!rs.length)return `<div class="muted">まだ価格履歴がありません。価格を1件登録すると買い時判定が始まります。</div>`;
 const avg=rs.reduce((a,b)=>a+b,0)/rs.length,min=Math.min(...rs),max=Math.max(...rs),latest=rs[0];
 const pct=(latest-avg)/avg;
 let cls="normal",label="標準的な価格帯";
 if(latest<=avg*.9){cls="good";label="かなり買いやすい価格";}
 else if(latest>=avg*1.1){cls="high";label="過去平均より高め";}
 return `<div class="${cls} score"><div>${label}</div><strong>¥${latest.toLocaleString()}</strong><div class="muted">平均 ¥${Math.round(avg).toLocaleString()} ・ 最安 ¥${min.toLocaleString()} ・ 最高 ¥${max.toLocaleString()} ・ ${rs.length}件</div></div>`;
}
function openRegister(p){
 $("regJan").textContent=currentJan;$("pName").value=p?.name||"";$("pBrand").value=p?.brand||"";$("pQty").value=p?.qty||"";$("preview").classList.add("hidden");$("previewImg").src="";
 if(p?.image){$("previewImg").src=p.image;$("preview").classList.remove("hidden")}
 show("register")
}
$("productForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const file=$("pImage").files[0];let image=currentProduct?.image||"";
 if(file)image=await resizeImage(file);
 state.products[currentJan]={jan:currentJan,name:$("pName").value.trim(),brand:$("pBrand").value.trim(),qty:$("pQty").value.trim(),image};
 save();currentProduct=state.products[currentJan];toast("商品を登録しました");openPrice(currentProduct)
});
$("pImage").addEventListener("change",()=>{const f=$("pImage").files[0];if(f){$("previewImg").src=URL.createObjectURL(f);$("preview").classList.remove("hidden")}})
function resizeImage(file){return new Promise(resolve=>{const im=new Image(),c=document.createElement("canvas"),ctx=c.getContext("2d");im.onload=()=>{const max=900,scale=Math.min(1,max/im.width,max/im.height);c.width=im.width*scale;c.height=im.height*scale;ctx.drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};im.src=URL.createObjectURL(file)})}
function openPrice(p){currentProduct=p;$("priceProduct").innerHTML=`<div class="product">${p.image?`<img src="${p.image}">`:`<div class="noimg">📦</div>`}<div><b>${esc(p.name)}</b><div class="muted">${esc(p.brand||"")} ${esc(p.qty||"")}</div><div class="muted">JAN ${esc(p.jan)}</div></div></div>`;$("dateInput").value=today();$("priceInput").value="";$("storeText").textContent=currentStore?.name||"店舗を選択";show("price")}
$("priceForm").addEventListener("submit",e=>{e.preventDefault();if(!currentStore){toast("店舗を選択してください");return}state.records.push({jan:currentProduct.jan,name:currentProduct.name,brand:currentProduct.brand,price:Number($("priceInput").value),date:$("dateInput").value,store:currentStore.name,address:currentStore.address||""});save();toast("価格を保存しました");lookup()})
$("storeBtn").onclick=()=>{show("store");getLocation()}
$("nearbyBtn").onclick=()=>getLocation()
function getLocation(){if(!navigator.geolocation){$("locMsg").textContent="位置情報に対応していません";return}$("locMsg").textContent="現在地を取得しています…";navigator.geolocation.getCurrentPosition(pos=>{$("locMsg").textContent=`現在地を取得しました。緯度 ${pos.coords.latitude.toFixed(4)} / 経度 ${pos.coords.longitude.toFixed(4)}`;findStores(pos.coords.latitude,pos.coords.longitude)},()=>{$("locMsg").textContent="位置情報を取得できませんでした。店舗名を入力してください。"},{enableHighAccuracy:true,timeout:10000})}
async function findStores(lat,lon){
 $("stores").innerHTML="<div class='card'>近くのスーパーを検索中…</div>";
 try{
  const q=`[out:json][timeout:10];(nwr["shop"="supermarket"](around:5000,${lat},${lon});nwr["name"~"スーパー|マルナカ|ハローズ|天満屋|イオン|ゆめタウン|コープ|業務スーパー|ザグザグ|ドン・キホーテ"](around:5000,${lat},${lon}););out center 15;`;
  const res=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:q});const data=await res.json();
  const arr=(data.elements||[]).filter(x=>x.tags?.name).map(x=>({name:x.tags.name,address:x.tags["addr:street"]||x.tags["addr:city"]||"",lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon})).slice(0,12);
  $("stores").innerHTML=arr.length?arr.map((s,i)=>`<div class="store-item"><button data-store='${JSON.stringify(s).replace(/'/g,"&#39;")}'>🏪 <b>${esc(s.name)}</b><div class="muted">${esc(s.address)}</div></button></div>`).join(""):"<div class='card'>近くの店舗が見つかりませんでした。</div>";
  $("stores").querySelectorAll("button").forEach(b=>b.onclick=()=>{currentStore=JSON.parse(b.dataset.store);$("storeText").textContent=currentStore.name;show("price")});
 }catch(e){$("stores").innerHTML="<div class='card'>店舗検索に失敗しました。下の入力欄から店舗名を入力してください。</div>"}
}
$("useManual").onclick=()=>{const n=$("storeManual").value.trim();if(!n){toast("店舗名を入力してください");return}currentStore={name:n};$("storeText").textContent=n;show("price")}
function renderData(){
 const ps=Object.values(state.products),rs=state.records;
 $("dataBody").innerHTML=`<div class="card"><h3>商品 ${ps.length}件</h3>${ps.length?ps.map(p=>`<div class="record"><div>${p.image?`<img class="thumb" src="${p.image}">`:``}<b>${esc(p.name)}</b><div class="muted">JAN ${esc(p.jan)}</div></div><button class="smallbtn" data-jan="${esc(p.jan)}">価格</button></div>`).join(""):"<div class='empty'>登録商品なし</div>"}</div><div class="card"><h3>価格記録 ${rs.length}件</h3>${rs.length?[...rs].reverse().map(r=>`<div class="record"><div><b>${esc(r.name)}</b><div class="muted">${esc(r.store)}・${esc(r.date)}</div></div><div class="price">¥${Number(r.price).toLocaleString()}</div></div>`).join(""):"<div class='empty'>価格記録なし</div>"}</div>`;
 $("dataBody").querySelectorAll("[data-jan]").forEach(b=>b.onclick=()=>{currentJan=b.dataset.jan;lookup()})
}
$("clearData").onclick=()=>{if(confirm("商品・価格データをすべて削除しますか？")){localStorage.removeItem(DBKEY);state={products:{},records:[]};renderHome();toast("削除しました")}}
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>{stopCamera();show(b.dataset.back)})
$("manualBtn").onclick=()=>{const j=prompt("JANコードを入力してください");if(j){currentJan=j.trim();lookup()}}
$("scanManualBtn")?.addEventListener("click",()=>{const j=prompt("JANコードを入力してください");if(j){currentJan=j.trim();lookup()}})
$("scanBtn").onclick=async()=>{show("scanner");startCamera()}
$("stopBtn").onclick=()=>stopCamera()
async function startCamera(){
 try{
  if(!window.ZXing){$("scanMsg").textContent="スキャンライブラリの読み込みに失敗しました。手入力を利用してください。";return}
  reader=new ZXing.BrowserMultiFormatReader();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});$("video").srcObject=stream;await $("video").play();$("scanMsg").textContent="バーコードを枠に合わせてください";
  reader.decodeFromVideoElement($("video"),(result,err)=>{if(result){const code=result.getText();currentJan=code;stopCamera();lookup()}})
 }catch(e){$("scanMsg").textContent="カメラを起動できませんでした。Safariのカメラ許可を確認してください。"}
}
function stopCamera(){if(reader){try{reader.reset()}catch(e){}reader=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
$("dataBtn").onclick=()=>show("data")
$("installHelp").onclick=()=>alert("iPhoneのSafariなら、共有ボタン →「ホーム画面に追加」でアプリのように起動できます。")
load();renderHome();$("dateInput").value=today();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
