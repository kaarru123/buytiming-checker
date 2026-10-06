const DBKEY="buytiming_v5_1";
let state={products:{},customProducts:{},records:[],shoppingList:[]};let currentJan=null,currentProduct=null,currentCustom=null,currentStore=null,stream=null,reader=null,currentCustomCategory="";let scanTimer=null,scanRunning=false,scanAttempts=0,scanHits=new Map();
let scanDiag={startedAt:0,frames:0,decodeCalls:0,decodeHits:0,errors:0,lastError:"",lastMode:"",nativeAvailable:false,nativeCalls:0,nativeHits:0,lastResult:"",lastResultAt:0,videoWidth:0,videoHeight:0,trackSettings:null,trackCapabilities:null};
const $=id=>document.getElementById(id); const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function load(){try{const x=JSON.parse(localStorage.getItem(DBKEY));if(x)state={products:{},customProducts:{},records:[],shoppingList:[],...x}}catch(e){}} function save(){localStorage.setItem(DBKEY,JSON.stringify(state));renderHome()}
function today(){return new Date().toISOString().slice(0,10)}
function show(id){stopCamera();document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');window.scrollTo(0,0);if(id==='home')renderHome();if(id==='data')renderData();if(id==='janless')renderJanless()}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function scoreHtml(p,key=p.jan){const rs=state.records.filter(r=>r.key===key||r.jan===key).map(r=>Number(r.unitPrice??r.price)).filter(Boolean);if(!rs.length)return `<div class="muted">まだ価格履歴がありません。価格を1件登録すると買い時判定が始まります。</div>`;const avg=rs.reduce((a,b)=>a+b,0)/rs.length,min=Math.min(...rs),max=Math.max(...rs),latest=rs[0];let cls='normal',label='標準的な価格帯';if(latest<=avg*.9){cls='good';label='かなり買いやすい価格';}else if(latest>=avg*1.1){cls='high';label='過去平均より高め';}return `<div class="score ${cls}"><div>${label}</div><strong>¥${Math.round(latest).toLocaleString()} / ${esc(p.unitLabel||'比較単位')}</strong><div class="muted">平均 ¥${Math.round(avg).toLocaleString()} ・ 最安 ¥${Math.round(min).toLocaleString()} ・ 最高 ¥${Math.round(max).toLocaleString()} ・ ${rs.length}件</div></div>`}
function renderHome(){
 $('productCount').textContent=Object.keys(state.products).length+Object.keys(state.customProducts).length;$('recordCount').textContent=state.records.length;
 const rs=[...state.records].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);$('recent').innerHTML=rs.length?rs.map(r=>`<div class="record"><div><b>${esc(r.name)}</b><div class="muted">${esc(r.store)}・${esc(r.date)}</div></div><div class="price">¥${Number(r.price).toLocaleString()}</div></div>`).join(''):'まだ記録がありません。';renderList();
}
function renderList(){const el=$('shoppingList');if(!state.shoppingList.length){el.innerHTML='<div class="empty">まだありません。買う予定の商品を追加しましょう。</div>';return}el.innerHTML=state.shoppingList.map((x,i)=>`<div class="list-item"><button class="check ${x.done?'done':''}" data-check="${i}" aria-label="${x.done?'購入済みを解除':'購入済みにする'}">${x.done?'✓':''}</button><div class="list-main ${x.done?'done':''}"><b>${esc(x.name)}</b><div class="muted">${esc(x.category||'')}</div></div><div class="list-actions"><button class="smallbtn" data-list-open="${i}">価格</button><button class="smallbtn delete-list-btn" data-list-delete="${i}">削除</button></div></div>`).join('');el.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{state.shoppingList[+b.dataset.check].done=!state.shoppingList[+b.dataset.check].done;save()});el.querySelectorAll('[data-list-open]').forEach(b=>b.onclick=()=>openListItem(+b.dataset.listOpen));el.querySelectorAll('[data-list-delete]').forEach(b=>b.onclick=()=>deleteListItem(+b.dataset.listDelete))}
function addListItem(){const name=prompt('買い物リストに追加する商品名');if(!name?.trim())return;state.shoppingList.push({name:name.trim(),category:'',done:false});save();toast('買い物リストに追加しました')}
function deleteListItem(i){const item=state.shoppingList[i];if(!item)return;if(!confirm(`「${item.name}」を買い物リストから削除しますか？`))return;state.shoppingList.splice(i,1);save();toast('買い物リストから削除しました')}
function openListItem(i){const x=state.shoppingList[i];const p=findProductByName(x.name);if(p){if(p.jan){currentJan=p.jan;lookup()}else{currentCustom=p;openCustomPrice(p)}}else{toast('価格履歴がない商品です。JANなし商品から登録できます')}}
function findProductByName(n){return Object.values(state.products).find(p=>p.name===n)||Object.values(state.customProducts).find(p=>p.name===n)}
function lookup(){const p=state.products[currentJan];if(p){currentProduct=p;$('lookupBody').innerHTML=`<div class="card"><div class="product">${p.image?`<img src="${p.image}">`:`<div class="noimg">📦</div>`}<div><b>${esc(p.name)}</b><div class="muted">${esc(p.brand||'')}</div><div class="muted">${esc(p.qty||'')}</div></div></div>${scoreHtml(p,p.jan)}<button id="addPrice" class="primary">この商品の価格を記録</button><button id="addToList" class="secondary">🛒 買い物リストに追加</button><button id="editProduct" class="secondary">商品情報を編集</button></div>`;$('addPrice').onclick=()=>openPrice(p);$('addToList').onclick=()=>addProductToList(p);$('editProduct').onclick=()=>openRegister(p)}else{$('lookupBody').innerHTML=`<div class="card"><div class="notice">このJANコードの商品はまだ登録されていません。</div><p class="muted">商品名と、必要なら商品写真を登録してください。</p><button id="newProduct" class="primary">この商品を登録する</button></div>`;$('newProduct').onclick=()=>openRegister(null)}show('lookup')}
function addProductToList(p){if(!state.shoppingList.some(x=>x.name===p.name&&!x.done)){state.shoppingList.push({name:p.name,category:'JAN商品',done:false});save();toast('買い物リストに追加しました')}else toast('すでにリストにあります')}
function openRegister(p){$('regJan').textContent=currentJan;$('pName').value=p?.name||'';$('pBrand').value=p?.brand||'';$('pQty').value=p?.qty||'';$('preview').classList.add('hidden');$('previewImg').src='';if(p?.image){$('previewImg').src=p.image;$('preview').classList.remove('hidden')}show('register')}
$('productForm').addEventListener('submit',async e=>{e.preventDefault();const file=$('pImage').files[0];let image=currentProduct?.image||'';if(file)image=await resizeImage(file);state.products[currentJan]={jan:currentJan,name:$('pName').value.trim(),brand:$('pBrand').value.trim(),qty:$('pQty').value.trim(),unitLabel:'1個',image};save();currentProduct=state.products[currentJan];toast('商品を登録しました');openPrice(currentProduct)});
$('pImage').addEventListener('change',()=>{const f=$('pImage').files[0];if(f){$('previewImg').src=URL.createObjectURL(f);$('preview').classList.remove('hidden')}});
function resizeImage(file){return new Promise(resolve=>{const im=new Image(),c=document.createElement('canvas'),ctx=c.getContext('2d');im.onload=()=>{const max=900,scale=Math.min(1,max/im.width,max/im.height);c.width=im.width*scale;c.height=im.height*scale;ctx.drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78))};im.src=URL.createObjectURL(file)})}
function openPrice(p){currentProduct=p;$('priceProduct').innerHTML=`<div class="product">${p.image?`<img src="${p.image}">`:`<div class="noimg">📦</div>`}<div><b>${esc(p.name)}</b><div class="muted">${esc(p.brand||'')} ${esc(p.qty||'')}</div><div class="muted">JAN ${esc(p.jan)}</div></div></div>`;$('dateInput').value=today();$('priceInput').value='';$('storeText').textContent=currentStore?.name||'店舗を選択';show('price')}
$('priceForm').addEventListener('submit',e=>{e.preventDefault();if(!currentStore){toast('店舗を選択してください');return}state.records.push({key:currentProduct.jan,jan:currentProduct.jan,name:currentProduct.name,price:Number($('priceInput').value),unitPrice:Number($('priceInput').value),unitLabel:currentProduct.unitLabel||'1個',date:$('dateInput').value,store:currentStore.name,address:currentStore.address||''});save();toast('価格を保存しました');lookup()});
function renderJanless(){const fav=Object.values(state.customProducts).sort((a,b)=>(b.useCount||0)-(a.useCount||0)).slice(0,8);$('favoriteItems').innerHTML=fav.length?fav.map(p=>`<button class="chip" data-fav="${esc(p.key)}">⭐ ${esc(p.name)}</button>`).join(''):'<span class="muted">ここにはよく使う商品が自動で並びます。</span>';$('favoriteItems').querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>{currentCustom=state.customProducts[b.dataset.fav];openCustomPrice(currentCustom)});$('janlessBody').innerHTML=`<div class="card"><h3>① カテゴリを選ぶ</h3><div class="category-grid">${['肉','魚','野菜','果物','卵・乳製品','パン','惣菜','その他'].map(c=>`<button class="category" data-cat="${c}">${c}</button>`).join('')}</div></div><div id="optionsCard"></div>`;$('janlessBody').querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>chooseCategory(b.dataset.cat))}
const parts={肉:{鶏肉:['もも肉','むね肉','ささみ','手羽元','手羽先','ひき肉','その他'],牛肉:['もも肉','肩肉','肩ロース','ロース','バラ肉','こま切れ','ひき肉','その他'],豚肉:['こま切れ','もも肉','肩肉','肩ロース','ロース','バラ肉','ひき肉','その他']},野菜:['キャベツ','レタス','きゅうり','トマト','にんじん','玉ねぎ','じゃがいも','その他'],果物:['りんご','みかん','バナナ','いちご','その他'],魚:['鮭','さば','さんま','刺身','その他'],その他:['その他']};
function chooseCategory(cat){currentCustomCategory=cat;const o=$('optionsCard');let html='';if(cat==='肉'){html=`<div class="card"><h3>② 種類を選ぶ</h3><div class="option-list">${Object.keys(parts.肉).map(x=>`<button class="option" data-meat="${x}">${x}</button>`).join('')}</div></div>`}else{html=`<div class="card"><h3>② 商品を選ぶ</h3><div class="option-list">${parts[cat].map(x=>`<button class="option" data-item="${x}">${x}</button>`).join('')}</div></div>`}o.innerHTML=html;o.querySelectorAll('[data-meat]').forEach(b=>b.onclick=()=>chooseMeat(b.dataset.meat));o.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>selectCommonItem(b.dataset.item))}
function chooseMeat(type){const o=$('optionsCard');o.innerHTML=`<div class="card"><h3>③ 部位を選ぶ</h3><div class="option-list">${parts.肉[type].map(x=>`<button class="option" data-part="${x}">${x}</button>`).join('')}</div></div>`;o.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>selectCommonItem(`${type} ${b.dataset.part}`))}
function selectCommonItem(name){if(name==='その他'||name.endsWith(' その他')){$('cCategory').value=currentCustomCategory;show('customItem');return}let unit='unit';if(currentCustomCategory==='肉'||currentCustomCategory==='魚')unit='100g';const key='custom_'+btoa(unescape(encodeURIComponent(currentCustomCategory+'|'+name))).replace(/=/g,'');if(!state.customProducts[key])state.customProducts[key]={key,name,category:currentCustomCategory,unit,useCount:0,unitLabel:unit==='100g'?'100g':'1個・1本など'};currentCustom=state.customProducts[key];currentCustom.useCount=(currentCustom.useCount||0)+1;save();openCustomPrice(currentCustom)}
$('customForm').addEventListener('submit',e=>{e.preventDefault();const name=$('cName').value.trim(),unit=$('cUnit').value;const key='custom_'+Date.now();state.customProducts[key]={key,name,category:$('cCategory').value,unit,useCount:1,unitLabel:unit==='100g'?'100g':unit==='kg'?'1kg':'1個・1本など'};save();currentCustom=state.customProducts[key];toast('商品を追加しました');openCustomPrice(currentCustom)});
function openCustomPrice(p){currentCustom=p;const unit=p.unit;$('customProduct').innerHTML=`<h3>${esc(p.name)}</h3><div class="muted">${esc(p.category)} ・ 比較単位：${esc(p.unitLabel)}</div>${scoreHtml(p,p.key)}`;$('customDate').value=today();$('customStoreText').textContent=currentStore?.name||'店舗を選択';$('customMeasureFields').innerHTML=unit==='100g'?`<label>内容量（g） *</label><input id="customWeight" type="number" min="1" required placeholder="300"><label>価格（税込・円） *</label><input id="customPriceInput" type="number" min="1" required placeholder="348"><div class="unit-note">例：300g 348円 → 116円 / 100g</div>`:unit==='kg'?`<label>内容量（g） *</label><input id="customWeight" type="number" min="1" required placeholder="500"><label>価格（税込・円） *</label><input id="customPriceInput" type="number" min="1" required placeholder="398"><div class="unit-note">重量から1kgあたりの価格を自動計算します。</div>`:`<label>数量 *</label><input id="customQty" type="number" min="1" step="0.1" required placeholder="3"><label>価格（税込・円） *</label><input id="customPriceInput" type="number" min="1" required placeholder="220"><div class="unit-note">例：きゅうり3本 220円 → 73.3円 / 本</div>`;show('customPrice')}
$('customPriceForm').addEventListener('submit',e=>{e.preventDefault();if(!currentStore){toast('店舗を選択してください');return}const raw=Number($('customPriceInput').value),p=currentCustom;let unitPrice,qty,weight;if(p.unit==='100g'){weight=Number($('customWeight').value);unitPrice=raw/(weight/100)}else if(p.unit==='kg'){weight=Number($('customWeight').value);unitPrice=raw/(weight/1000)}else{qty=Number($('customQty').value);unitPrice=raw/qty}state.records.push({key:p.key,jan:'',name:p.name,category:p.category,price:raw,unitPrice,unitLabel:p.unitLabel,qty,weight,date:$('customDate').value,store:currentStore.name,address:currentStore.address||''});p.useCount=(p.useCount||0)+1;save();toast('価格を保存しました');openCustomPrice(p)});
$('customStoreBtn').onclick=()=>{storeReturn='customPrice';show('store');getLocation()};let storeReturn='price';$('storeBtn').onclick=()=>{storeReturn='price';show('store');getLocation()};$('nearbyBtn').onclick=()=>getLocation();
function getLocation(){if(!navigator.geolocation){$('locMsg').textContent='位置情報に対応していません';return}$('locMsg').textContent='現在地を取得しています…';navigator.geolocation.getCurrentPosition(pos=>{$('locMsg').textContent='現在地を取得しました。近くの店舗を検索しています…';findStores(pos.coords.latitude,pos.coords.longitude)},()=>{$('locMsg').textContent='位置情報を取得できませんでした。店舗名を入力してください。'},{enableHighAccuracy:true,timeout:10000})}
async function findStores(lat,lon){$('stores').innerHTML="<div class='card'>近くのスーパーを検索中…</div>";try{const q=`[out:json][timeout:10];(nwr["shop"="supermarket"](around:5000,${lat},${lon});nwr["name"~"スーパー|マルナカ|ハローズ|天満屋|イオン|ゆめタウン|コープ|業務スーパー|ザグザグ|ドン・キホーテ"](around:5000,${lat},${lon}););out center 15;`;const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q});const data=await res.json();const arr=(data.elements||[]).filter(x=>x.tags?.name).map(x=>({name:x.tags.name,address:x.tags['addr:street']||x.tags['addr:city']||'',lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon})).slice(0,12);$('stores').innerHTML=arr.length?arr.map(s=>`<div class="store-item"><button data-store='${JSON.stringify(s).replace(/'/g,'&#39;')}'>🏪 <b>${esc(s.name)}</b><div class="muted">${esc(s.address)}</div></button></div>`).join(''):'<div class="card">近くの店舗が見つかりませんでした。</div>';$('stores').querySelectorAll('button').forEach(b=>b.onclick=()=>{currentStore=JSON.parse(b.dataset.store);$('storeText').textContent=currentStore.name;$('customStoreText').textContent=currentStore.name;show(storeReturn)})}catch(e){$('stores').innerHTML='<div class="card">店舗検索に失敗しました。下の入力欄から店舗名を入力してください。</div>'}}
$('useManual').onclick=()=>{const n=$('storeManual').value.trim();if(!n){toast('店舗名を入力してください');return}currentStore={name:n};$('storeText').textContent=n;$('customStoreText').textContent=n;show(storeReturn)};
function renderData(){const ps=[...Object.values(state.products),...Object.values(state.customProducts)],rs=state.records;$('dataBody').innerHTML=`<div class="card"><h3>商品 ${ps.length}件</h3>${ps.length?ps.map(p=>`<div class="record"><div>${p.image?`<img class="thumb" src="${p.image}">`:''}<b>${esc(p.name)}</b><div class="muted">${esc(p.category||'JAN商品')}</div></div></div>`).join(''):'<div class="empty">登録商品なし</div>'}</div><div class="card"><h3>価格記録 ${rs.length}件</h3>${rs.length?[...rs].reverse().map(r=>`<div class="record"><div><b>${esc(r.name)}</b><div class="muted">${esc(r.store)}・${esc(r.date)}</div></div><div class="price">¥${Number(r.price).toLocaleString()}</div></div>`).join(''):'<div class="empty">価格記録なし</div>'}</div>`}
$('addListBtn').onclick=addListItem;$('nonJanBtn').onclick=()=>show('janless');$('dataBtn').onclick=()=>show('data');$('manualBtn').onclick=()=>{const j=prompt('商品バーコード番号を入力してください');if(j){currentJan=j.trim();lookup()}};
$('scanBtn').onclick=()=>{show('scanner');setTimeout(startCamera,80)};
$('stopBtn')?.addEventListener('click',()=>stopCamera());

async function loadZXing(){
  if(window.ZXingBrowser?.BrowserMultiFormatReader) return true;
  return await new Promise(resolve=>{
    const s=document.createElement('script');
    s.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js?janfix=20261004';
    s.async=true;
    s.onload=()=>resolve(!!window.ZXingBrowser?.BrowserMultiFormatReader);
    s.onerror=()=>resolve(false);
    document.head.appendChild(s);
  });
}
function cameraErrorMessage(e){
  const n=e?.name||'', m=e?.message||'';
  if(n==='NotAllowedError'||n==='PermissionDeniedError') return 'Safariのカメラ許可が必要です。サイト設定で「カメラ→許可」を確認してください。';
  if(n==='NotFoundError') return '利用できるカメラが見つかりませんでした。';
  if(n==='NotReadableError'||n==='TrackStartError') return 'カメラを他のアプリや機能が使用中の可能性があります。カメラを閉じてから再試行してください。';
  if(n==='SecurityError') return 'このページではカメラを利用できません。SafariでHTTPSのページを開いてください。';
  return `カメラ起動エラー: ${n||'Unknown'}${m?` / ${m}`:''}`;
}
function normalizeJan(text){
  const digits=String(text??'').replace(/[^0-9]/g,'');
  if(digits.length===13 || digits.length===8) return digits;
  if(digits.length===12) return '0'+digits;
  return digits;
}
function validJan(text){
  const j=normalizeJan(text);
  if(!/^\d{8}$|^\d{13}$/.test(j)) return false;
  let sum=0;
  for(let i=0;i<j.length-1;i++) sum += Number(j[i]) * ((j.length-i-1)%2===0 ? 3 : 1);
  return (10-(sum%10))%10===Number(j[j.length-1]);
}
function makeZXingReader(){
  const hints=new Map();
  if(window.ZXingBrowser?.DecodeHintType && window.ZXingBrowser?.BarcodeFormat){
    hints.set(window.ZXingBrowser.DecodeHintType.POSSIBLE_FORMATS,[
      window.ZXingBrowser.BarcodeFormat.EAN_13,
      window.ZXingBrowser.BarcodeFormat.EAN_8,
      window.ZXingBrowser.BarcodeFormat.UPC_A,
      window.ZXingBrowser.BarcodeFormat.UPC_E
    ]);
    // iPhone SafariではTRY_HARDERが逆に不安定になる既知の報告があるため、今回は使わない。
  }
  const Reader=window.ZXingBrowser?.BrowserMultiFormatOneDReader||window.ZXingBrowser?.BrowserMultiFormatReader;
  if(!Reader) throw new Error('ZXing OneD reader unavailable');
  // 120msごとに解析。失敗時も連続して再試行し、成功後は画面側で確定する。
  return new Reader(hints,{delayBetweenScanAttempts:120,delayBetweenScanSuccess:800,tryPlayVideoTimeout:5000});
}
function scanCanvasFromVideo(video, crop){
  const vw=video.videoWidth||1280, vh=video.videoHeight||720;
  const canvas=scanCanvasFromVideo.canvas||(scanCanvasFromVideo.canvas=document.createElement('canvas'));
  let sx=0,sy=0,sw=vw,sh=vh;
  if(crop){
    sw=Math.floor(vw*0.82); sh=Math.floor(vh*0.48);
    sx=Math.floor((vw-sw)/2); sy=Math.floor((vh-sh)/2);
  }
  const maxW=crop?1200:1440;
  const scale=Math.min(1,maxW/sw);
  canvas.width=Math.max(320,Math.floor(sw*scale));
  canvas.height=Math.max(180,Math.floor(sh*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  return canvas;
}
function resetScanCandidates(){scanHits.clear();scanAttempts=0}
function resetScanDiag(){
  scanDiag={startedAt:Date.now(),frames:0,decodeCalls:0,decodeHits:0,errors:0,lastError:"",lastMode:"",nativeAvailable:('BarcodeDetector' in window),nativeCalls:0,nativeHits:0,lastResult:"",lastResultAt:0,videoWidth:0,videoHeight:0,trackSettings:null,trackCapabilities:null};
  renderScanDiag();
}
function diagError(e){
  scanDiag.errors++;
  scanDiag.lastError=`${e?.name||'Error'}: ${e?.message||String(e)}`.slice(0,220);
}
function renderScanDiag(){
  const el=$('scanDiagnostics'); if(!el) return;
  const sec=Math.max(0,(Date.now()-(scanDiag.startedAt||Date.now()))/1000);
  const fps=sec?Math.round(scanDiag.frames/sec):0;
  const settings=scanDiag.trackSettings||{};
  el.innerHTML=`<div class="diag-grid">
    <div><b>カメラ</b><span>${scanDiag.videoWidth||0}×${scanDiag.videoHeight||0}</span></div>
    <div><b>映像フレーム</b><span>${scanDiag.frames}（${fps}/秒）</span></div>
    <div><b>解析回数</b><span>${scanDiag.decodeCalls}</span></div>
    <div><b>検出回数</b><span>${scanDiag.decodeHits}</span></div>
    <div><b>Native検出</b><span>${scanDiag.nativeAvailable?'対応':'非対応'} / ${scanDiag.nativeCalls}回</span></div>
    <div><b>解析方式</b><span>${esc(scanDiag.lastMode||'準備中')}</span></div>
    <div><b>候補</b><span>${scanDiag.lastResult?esc(scanDiag.lastResult):'なし'}</span></div>
    <div><b>エラー</b><span>${scanDiag.errors}${scanDiag.lastError?` / ${esc(scanDiag.lastError)}`:''}</span></div>
  </div>
  <details><summary>詳細情報</summary>
    <div class="diag-detail">facingMode: ${esc(settings.facingMode||'—')}<br>width: ${esc(settings.width||'—')} / height: ${esc(settings.height||'—')}<br>zoom: ${esc(settings.zoom??'—')}<br>focusMode: ${esc(settings.focusMode||'—')}<br>torch: ${esc(settings.torch??'—')}</div>
  </details>`;
}
function registerScanHit(raw){
  const jan=normalizeJan(raw);
  scanDiag.lastResult=String(raw||'').slice(0,40);
  scanDiag.lastResultAt=Date.now();
  if(!/^\d{8}$|^\d{12}$|^\d{13}$/.test(jan)) return false;
  const now=Date.now();
  for(const [k,v] of scanHits){if(now-v.last>1800)scanHits.delete(k)}
  const v=scanHits.get(jan)||{count:0,last:0};
  v.count++;v.last=now;scanHits.set(jan,v);scanDiag.decodeHits++;
  $('cameraDiag').textContent=`自動読み取り中… 試行 ${scanAttempts}回 ・ 候補 ${jan}（${v.count}/2）`;
  if(v.count>=2){showScanSuccess(jan);return true}
  return false;
}
function startBarcodeLoop(video){
  scanRunning=true; resetScanCandidates();
  const run=async()=>{
    if(!scanRunning||!stream||video.readyState<2){if(scanRunning)scanTimer=setTimeout(run,120);return}
    scanAttempts++; scanDiag.frames++; scanDiag.videoWidth=video.videoWidth; scanDiag.videoHeight=video.videoHeight;
    if(scanAttempts%5===0) renderScanDiag();
    let found=false;
    // 1) BarcodeDetectorが利用可能ならネイティブ解析も試す（Safariでは通常非対応）
    if(scanDiag.nativeAvailable && scanAttempts%2===0){
      try{
        if(!window.__barcodeDetector) window.__barcodeDetector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','itf']});
        scanDiag.nativeCalls++; scanDiag.lastMode='BarcodeDetector';
        const hits=await window.__barcodeDetector.detect(video);
        if(hits?.length){for(const h of hits){if(registerScanHit(h.rawValue)){found=true;break}}}
      }catch(e){diagError(e)}
    }
    // 2) 同じvideo映像をCanvasに取り込み、ZXingで解析
    if(!found && reader){
      try{
        scanDiag.decodeCalls++; scanDiag.lastMode=(scanAttempts%4===0)?'ZXing / 全画面':'ZXing / 中央クロップ';
        const crop=(scanAttempts%4)!==0;
        const canvas=scanCanvasFromVideo(video,crop);
        const result=reader.decodeFromCanvas(canvas);
        if(result){const raw=result.getText?.()||result.text||'';found=registerScanHit(raw)}
      }catch(e){diagError(e)}
    }
    if(scanRunning&&!found) scanTimer=setTimeout(run,120);
  };
  run();
}
async function lookupProductAuto(jan){
  currentJan=jan;
  const local=state.products[jan];
  if(local){
    currentProduct=local;
    lookup();
    return;
  }

  // 未登録なら外部の商品データベースも自動検索する。
  show('lookup');
  $('lookupBody').innerHTML=`<div class="card"><div class="loading">商品情報を検索しています…</div><div class="muted">バーコード：${esc(jan)}</div></div>`;

  const endpoints=[
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(jan)}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(jan)}.json?fields=code,product_name,product_name_ja,brands,quantity,image_front_url`
  ];
  let data=null;
  for(const url of endpoints){
    try{
      const res=await fetch(url,{headers:{Accept:'application/json'}});
      if(!res.ok) continue;
      const json=await res.json();
      if(json?.status===1 && json.product){data=json;break}
    }catch(e){/* ネットワーク失敗時は登録画面へ */}
  }

  if(data?.product){
    const x=data.product;
    const name=(x.product_name_ja||x.product_name||'').trim();
    const brand=(x.brands||'').split(',')[0].trim();
    const qty=(x.quantity||'').trim();
    if(name){
      const product={
        jan,
        name,
        brand,
        qty,
        unitLabel:'1個',
        image:x.image_front_url||''
      };
      state.products[jan]=product;
      save();
      currentProduct=product;
      lookup();
      toast('商品情報を取得しました');
      return;
    }
  }

  // 外部DBにもなければ、今まで通り登録画面へ誘導する。
  lookup();
}

function showScanSuccess(jan){
  currentJan=jan; scanRunning=false;
  if(scanTimer){clearTimeout(scanTimer);scanTimer=null}
  $('scanMsg').textContent='読み取り完了';
  $('cameraDiag').innerHTML=`<strong>バーコードを認識しました</strong> ・ ${esc(jan)}`;
  $('janResultValue').textContent=jan; $('scanSuccessValue').textContent=jan;
  $('scanSuccess').classList.remove('hidden'); $('cameraCard').classList.add('scan-success-active');
  if(navigator.vibrate) try{navigator.vibrate([45,35,90])}catch(e){}
  toast('商品バーコードを読み取りました'); renderScanDiag();

  // 成功エフェクトを少し見せたあと、自動で商品検索へ進む。
  setTimeout(()=>{
    stopCamera();
    lookupProductAuto(jan);
  },900);
}
async function startCamera(){
  stopCamera(); resetScanDiag();
  $('cameraHelp').classList.add('hidden'); $('janResult').classList.add('hidden'); $('scanSuccess').classList.add('hidden'); $('cameraCard').classList.remove('scan-success-active');
  $('scanMsg').textContent='カメラを起動しています…'; $('cameraDiag').textContent='';
  try{
    if(!window.isSecureContext) throw Object.assign(new Error('HTTPSが必要です'),{name:'SecurityError'});
    if(!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('getUserMediaが利用できません'),{name:'NotSupportedError'});
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    const video=$('video'); video.srcObject=stream; video.setAttribute('playsinline',''); video.muted=true; await video.play();
    const track=stream.getVideoTracks()[0]; if(track){try{scanDiag.trackSettings=track.getSettings();}catch(e){} try{scanDiag.trackCapabilities=track.getCapabilities?.();}catch(e){}}
    scanDiag.videoWidth=video.videoWidth; scanDiag.videoHeight=video.videoHeight;
    $('scanMsg').textContent='商品バーコードを枠に合わせてください';
    $('cameraDiag').textContent='診断モード：カメラは起動済み。バーコード解析を開始します。';
    const ok=await loadZXing();
    if(!ok){$('cameraDiag').textContent='診断：カメラはOKですがZXingの読み込みに失敗しました。';renderScanDiag();return}
    reader=makeZXingReader(); startBarcodeLoop(video); renderScanDiag();
  }catch(e){
    diagError(e); stopCamera(); const msg=cameraErrorMessage(e); $('scanMsg').textContent='カメラを起動できませんでした'; $('cameraDiag').textContent=msg; $('cameraHelpText').textContent=msg; $('cameraHelp').classList.remove('hidden'); renderScanDiag();
  }
}
$('useJanBtn').onclick=()=>{if(currentJan){lookupProductAuto(currentJan)}};
$('rescanBtn').onclick=()=>startCamera();
$('cameraRetry').onclick=()=>startCamera();
$('cameraClose').onclick=()=>{$('cameraHelp').classList.add('hidden')};
$('copyDiagBtn')?.addEventListener('click',async()=>{
  const s=scanDiag||{};
  const settings=s.trackSettings||{};
  const text=[
    '買い時チェッカー 診断情報',
    `URL: ${location.href}`,
    `時間: ${new Date().toLocaleString('ja-JP')}`,
    `SecureContext: ${window.isSecureContext}`,
    `Camera API: ${!!navigator.mediaDevices?.getUserMedia}`,
    `Video: ${s.videoWidth||0}x${s.videoHeight||0}`,
    `Frames: ${s.frames||0}`,
    `Decode calls: ${s.decodeCalls||0}`,
    `Decode hits: ${s.decodeHits||0}`,
    `BarcodeDetector: ${s.nativeAvailable?'対応':'非対応'}`,
    `Native calls/hits: ${s.nativeCalls||0}/${s.nativeHits||0}`,
    `Mode: ${s.lastMode||''}`,
    `Candidate: ${s.lastResult||''}`,
    `Errors: ${s.errors||0}`,
    `Last error: ${s.lastError||''}`,
    `facingMode: ${settings.facingMode||''}`,
    `width/height: ${settings.width||''}/${settings.height||''}`,
    `focusMode: ${settings.focusMode||''}`
  ].join('\n');
  try{await navigator.clipboard.writeText(text);toast('診断情報をコピーしました')}catch(e){prompt('診断情報をコピーしてください',text)}
});
function stopCamera(){scanRunning=false;if(scanTimer){clearTimeout(scanTimer);scanTimer=null}resetScanCandidates();if(window.__nativeScanStop){try{window.__nativeScanStop()}catch(e){}window.__nativeScanStop=null}if(reader){try{reader.reset()}catch(e){}reader=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
$('installHelp').onclick=()=>alert('iPhoneのSafariで共有ボタン →「ホーム画面に追加」でアプリのように使えます。');document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show(b.dataset.back));$('clearData').onclick=()=>{if(confirm('商品・価格・買い物リストをすべて削除しますか？')){localStorage.removeItem(DBKEY);state={products:{},customProducts:{},records:[],shoppingList:[]};renderHome();toast('削除しました')}};
load();renderHome();$('dateInput').value=today();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
