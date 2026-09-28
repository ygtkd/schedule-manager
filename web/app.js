import { dateKey, onDay, eventTime } from './calendar.js';
const $ = id => document.getElementById(id);
const pages=$('pages'), panels=[...document.querySelectorAll('.page')], tabs=[...document.querySelectorAll('.tab')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let active=0, me=null, selectedDate=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'}));
let shownMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1), lastTappedDate=null;
let events=[], loading=false, calendarError='', loadVersion=0, requestId=crypto.randomUUID(), manualId=crypto.randomUUID();
function status(id, text){$(id).textContent=text;}
async function api(path, body) {
 const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
 headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':me?.csrf||''},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({error:'サーバーに接続できません。'}));
 if(!response.ok){const error=new Error(data.error||'処理できませんでした。');error.status=response.status;throw error;}
 return data;
}
function sync(index){if(active!==index)lastTappedDate=null;active=index;tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});panels.forEach((panel,i)=>panel.inert=i!==index);}
function navigate(index,focus=false){document.activeElement?.blur();pages.scrollTo({left:index*pages.clientWidth,behavior:reduced.matches?'instant':'smooth'});if(focus)tabs[index].focus();}
tabs.forEach((tab,i)=>{tab.onclick=()=>navigate(i);tab.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;else if(e.key==='ArrowLeft')n=(i+2)%3;else if(e.key==='Home')n=0;else if(e.key==='End')n=2;else return;e.preventDefault();navigate(n,true);};});
pages.addEventListener('scroll',()=>sync(Math.round(pages.scrollLeft/pages.clientWidth)),{passive:true});
new ResizeObserver(()=>pages.scrollTo({left:active*pages.clientWidth,behavior:'instant'})).observe(pages);
function dayEvents(){return events.filter(e=>onDay(e,dateKey(selectedDate)));}
function eventList(container, list) {
 container.replaceChildren();
 if(!list.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=calendarError||(!me?'ログインしてください':loading?'読み込み中':'予定なし');container.append(empty);return;}
 list.forEach(event=>{
 const row=document.createElement('article');row.className='day-event';
 const time=document.createElement('time');time.textContent=eventTime(event);
 const details=document.createElement('div'),title=document.createElement('h3'),place=document.createElement('p');
 title.textContent=event.title;place.textContent=event.location;details.append(title,place);
 if(event.start.date && event.end.date){const range=document.createElement('p');range.textContent=event.start.date;details.append(range);}
 else if(event.start.dateTime){const range=document.createElement('p');range.textContent=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'}).format(new Date(event.start.dateTime));details.append(range);}
 row.append(time,details);container.append(row);
 });
}
function renderCalendar(){
 status('month-label',shownMonth.getFullYear()+'年 '+(shownMonth.getMonth()+1)+'月');
 const grid=$('calendar-grid');grid.replaceChildren();
 const first=new Date(shownMonth.getFullYear(),shownMonth.getMonth(),1),days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 for(let i=0;i<Math.ceil((first.getDay()+days)/7)*7;i++){
 const date=new Date(first.getFullYear(),first.getMonth(),i-first.getDay()+1),key=dateKey(date),count=events.filter(e=>onDay(e,key)).length;
 const button=document.createElement('button');button.type='button';button.className='day';button.textContent=date.getDate();button.dataset.date=key;
 button.classList.toggle('outside',date.getMonth()!==shownMonth.getMonth());button.classList.toggle('today',key===today);button.classList.toggle('has-events',count>0);
 button.setAttribute('aria-pressed',String(key===dateKey(selectedDate)));button.setAttribute('aria-label',key+'、予定'+count+'件');
 if(key===today)button.setAttribute('aria-current','date');
 button.onclick=()=>{
 const details=lastTappedDate===key,changed=date.getMonth()!==shownMonth.getMonth()||date.getFullYear()!==shownMonth.getFullYear();
 lastTappedDate=details?null:key;selectedDate=date;shownMonth=new Date(date.getFullYear(),date.getMonth(),1);renderCalendar();
 grid.querySelector('[data-date="'+key+'"]')?.focus({preventScroll:true});
 if(changed)loadEvents();
 if(details){status('day-dialog-title',new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(date));eventList($('day-dialog-events'),dayEvents());$('day-dialog').showModal();}
 };grid.append(button);
 }
 status('selected-label',new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'long'}).format(selectedDate));
 status('day-count',loading?'…':dayEvents().length+'件');eventList($('day-events'),dayEvents());
 if($('day-dialog').open)eventList($('day-dialog-events'),dayEvents());
}
async function loadEvents(){
 const version=++loadVersion;events=[];calendarError='';if(!me){renderCalendar();return;}
 loading=true;renderCalendar();
 const first=new Date(shownMonth.getFullYear(),shownMonth.getMonth(),1);const from=new Date(first.getFullYear(),first.getMonth(),1-first.getDay());
 const last=new Date(first.getFullYear(),first.getMonth()+1,0);const to=new Date(last.getFullYear(),last.getMonth(),last.getDate()+8-last.getDay());
 try{const result=await api('events?'+new URLSearchParams({from:dateKey(from)+'T00:00:00+09:00',to:dateKey(to)+'T00:00:00+09:00'}));if(version===loadVersion)events=result;}
 catch(error){if(version===loadVersion)calendarError=error.message;}
 finally{if(version===loadVersion){loading=false;renderCalendar();}}
}
function changeMonth(offset){lastTappedDate=null;shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()+offset,1);selectedDate=new Date(shownMonth);loadEvents();}
$('prev-month').onclick=()=>changeMonth(-1);$('next-month').onclick=()=>changeMonth(1);
$('today').onclick=()=>{lastTappedDate=null;selectedDate=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'}));shownMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);loadEvents();};
$('close-day-dialog').onclick=()=>$('day-dialog').close();
const dayDialog=$('day-dialog');let outsideDown=false;
function outside(e){const b=dayDialog.getBoundingClientRect();return e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom;}
dayDialog.onpointerdown=e=>{outsideDown=e.target===dayDialog&&outside(e);};dayDialog.onpointercancel=()=>outsideDown=false;
dayDialog.onclick=e=>{if(outsideDown&&e.target===dayDialog&&outside(e))dayDialog.close();outsideDown=false;};dayDialog.onclose=()=>outsideDown=false;
$('add-event').onclick=()=>{
 if(!me){status('calendar-status','設定からログインしてください');return;}
 lastTappedDate=null;manualId=crypto.randomUUID();$('event-form').reset();$('event-date').value=dateKey(selectedDate);status('form-status','');$('event-dialog').showModal();$('event-title').focus();
};
$('close-dialog').onclick=()=>$('event-dialog').close();
$('event-form').onsubmit=async e=>{
 e.preventDefault();const title=$('event-title').value.trim(),date=$('event-date').value,start=$('event-start').value,end=$('event-end').value;
 if(!title||end<=start){status('form-status','件名・開始・終了を確認してください');return;}
 const button=e.submitter;button.disabled=true;
 try{
 await api('events/create',{requestId:manualId,title,start:date+'T'+start+':00+09:00',end:date+'T'+end+':00+09:00',location:$('event-location').value.trim()});
 const [y,m,d]=date.split('-').map(Number);selectedDate=new Date(y,m-1,d);shownMonth=new Date(y,m-1,1);
 $('event-dialog').close();status('calendar-status','保存済み');await loadEvents();
 }catch(error){status('form-status',error.message);}finally{button.disabled=false;}
};
const labels={cancelled:'取消済み',pending:'処理待ち',retryable:'再試行待ち',failed:'処理失敗',awaiting_confirmation:'確認待ち',registered:'登録済み',needs_review:'日時の修正が必要',no_event:'予定なし'};
async function history(){
 if(!me){$('history').replaceChildren();return;}
 try{
 const jobs=await api('history');$('history').replaceChildren();
 for(const job of jobs){
 const row=document.createElement('article');row.className='history-row';const title=document.createElement('h3'),detail=document.createElement('p');
 title.textContent=(labels[job.status]||job.status)+' · '+(job.event?.title||'LINEメッセージ');
 detail.textContent=[job.event?.start,job.event?.end,job.event?.location,job.event?.reason].filter(Boolean).join(' / ');row.append(title,detail);
 if(job.status==='awaiting_confirmation'){
 const button=document.createElement('button');button.className='outline';button.textContent='確認して登録';button.onclick=async()=>{
 button.disabled=true;try{await api('confirm',{id:job.id});await history();await loadEvents();}catch(error){status('register-status',error.message);button.disabled=false;}
 };row.append(button);
 }$('history').append(row);
 }
 if(!jobs.length)status('register-status','処理履歴なし');
 }catch(error){status('register-status',error.message);}
}
$('refresh-history').onclick=history;
$('message').oninput=()=>{requestId=crypto.randomUUID();status('counter',$('message').value.length.toLocaleString('ja-JP')+' / 4,000');};
$('clear').onclick=()=>{$('message').value='';$('message').oninput();};
$('extract').onclick=async()=>{
 if(!me){status('input-status','設定からログインしてください');return;}
 if(!$('message').value.trim()||!$('ai-consent').checked){status('input-status','本文とAI送信の同意を確認してください');return;}
 $('extract').disabled=true;status('input-status','抽出中');
 try{const result=await api('messages',{text:$('message').value,requestId});status('input-status',labels[result.status]||result.status);await history();await loadEvents();}
 catch(error){status('input-status',error.message);}finally{$('extract').disabled=false;}
};
function renderAccount(){
 $('line-login').textContent=me?.lineLogin?'LINEログイン設定済み':me?'LINEログインを追加':'LINEでログイン';$('line-login').disabled=!!me?.lineLogin;
 const connected=!!me?.connected;status('auth-status',me?'':'設定からログインしてください');
 status('connection-state',connected?'連携済み':'未連携');status('input-connection',connected?'連携済み':'未連携');
 status('calendar-name',me?(connected?'アプリ ＋ Google':'アプリ内カレンダー'):'—');$('connect').textContent=connected?'連携解除':'Google連携';$('logout').hidden=!me;
 $('automatic').checked=me?.autoRegister||false;$('line-enabled').checked=me?.lineEnabled||false;
 $('automatic').disabled=!me||!me.aiConsent;$('line-enabled').disabled=!me||!me.lineConfigured||!me.lineLinked||!me.aiConsent;
 status('line-state',!me?'ログイン後に設定':!me.lineConfigured?'サーバー設定待ち':!me.lineLinked?'未連携':me.lineEnabled?'連携済み・受信中':'連携済み・受信停止');
 $('line-code-button').hidden=!me||!me.lineConfigured;$('line-check').hidden=!me||!me.lineConfigured;
 $('line-code-button').textContent=me?.lineLinked?'LINE連携を解除':'連携コードを発行';
 if(!me||me.lineLinked)$('line-code-area').hidden=true;
 $('line-friend').hidden=!me?.lineFriendUrl;if(me?.lineFriendUrl)$('line-friend').href=me.lineFriendUrl;
}
async function init(){
 try{const config=await api('auth/config');$('line-login').hidden=!config.lineLogin;}catch{$('line-login').hidden=true;}
 try{me=await api('me');status('settings-status','');}catch(error){me=null;if(error.status!==401)status('settings-status',error.message);}
 renderAccount();await Promise.all([loadEvents(),history()]);
}
$('connect').onclick=async()=>{
 if(!me?.connected){location.href='/api/auth/start';return;}
 if(!confirm('Googleカレンダーとの連携を解除しますか？'))return;
 try{await api('disconnect',{});me=null;await init();}catch(error){status('settings-status',error.message);}
};
$('logout').onclick=async()=>{try{await api('logout',{});me=null;await init();}catch(error){status('settings-status',error.message);}};
async function saveSettings(){
 const autoRegister=$('automatic').checked,lineEnabled=$('line-enabled').checked;
 if((autoRegister||lineEnabled)&&!confirm('対象メッセージをGeminiへ送信します。無料枠のデータ利用条件を確認のうえ有効にしますか？')){renderAccount();return;}
 $('automatic').disabled=true;$('line-enabled').disabled=true;
 try{await api('settings',{autoRegister,lineEnabled});me={...me,autoRegister,lineEnabled};status('settings-status','保存済み');}
 catch(error){status('settings-status',error.message);}finally{renderAccount();}
}
$('automatic').onchange=saveSettings;$('line-enabled').onchange=saveSettings;
addEventListener('online',init);addEventListener('offline',()=>status('auth-status','オフライン'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&me){loadEvents();history();}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
renderCalendar();init();

$('line-code-button').onclick=async()=>{
 $('line-code-button').disabled=true;
 try {
  if(me.lineLinked){await api('line/unlink',{});me=await api('me');renderAccount();status('settings-status','LINE連携を解除しました');}
  else{const result=await api('line/code',{});$('line-code-text').value=result.text;$('line-code-area').hidden=false;status('settings-status','この文字列をご自身のLINEから公式アカウントへ送信してください');}
 }catch(error){status('settings-status',error.message);}finally{$('line-code-button').disabled=false;}
};
$('line-check').onclick=async()=>{
 try{me=await api('me');renderAccount();status('settings-status',me.lineLinked?'LINE連携済み':'未連携です。送信したアカウントとコードの期限を確認してください');}
 catch(error){status('settings-status',error.message);}
};
$('copy-line-code').onclick=async()=>{
 try{await navigator.clipboard.writeText($('line-code-text').value);status('settings-status','コピーしました');}
 catch{$('line-code-text').select();status('settings-status','文字列を選択してコピーしてください');}
};

$('line-login').onclick=()=>{location.href='/api/auth/line/start';};
