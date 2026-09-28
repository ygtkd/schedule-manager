import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,createHmac,randomBytes,createCipheriv} from 'node:crypto';
const require=createRequire(import.meta.url);
const {app,HttpRequest}=require('@azure/functions');
const {CosmosClient}=require('@azure/cosmos');
const {OAuth2Client}=require('google-auth-library');
const routes=new Map(),rows=new Map(),googleWrites=[];
const digest=value=>createHash('sha256').update(value).digest('hex');
const system='system-v2',key=randomBytes(32);
Object.assign(process.env,{COSMOS_CONNECTION:'AccountEndpoint=https://localhost:8081/;AccountKey=YQ==;',COSMOS_DATABASE:'test',COSMOS_CONTAINER:'records',TOKEN_KEY:key.toString('base64'),APP_ORIGIN:'https://app.test',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',LINE_CHANNEL_SECRET:'line-secret',AI_CONSENT:'true'});
function seal(text){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(text),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');}
let version=0;
function put(row){const copy={...structuredClone(row),_etag:String(++version)};rows.set(copy.pk+'/'+copy.id,copy);return copy;}
function get(id,pk){return structuredClone(rows.get(pk+'/'+id));}
function fail(code){throw Object.assign(new Error('store failure'),{code});}
const container={
 item(id,pk){return {
  async read(){return {resource:get(id,pk)};},
  async delete(){if(!rows.delete(pk+'/'+id))fail(404);},
  async replace(value,options){const current=get(id,pk);if(!current)fail(404);if(options?.accessCondition?.condition!==current._etag)fail(412);return {resource:put(value)};}
 };},
 items:{
  async create(row){if(get(row.id,row.pk))fail(409);return {resource:put(row)};},
  async upsert(row){return {resource:put(row)};},
  query(spec,options){return {async fetchAll(){
   let result=[...rows.values()].filter(row=>row.pk===(options?.partitionKey||spec.parameters?.find(p=>p.name==='@pk')?.value));
   if(spec.query.includes('c.kind = "event"'))result=result.filter(row=>row.kind==='event');
   if(spec.query.includes('c.kind = "job"'))result=result.filter(row=>row.kind==='job');
   return {resources:structuredClone(result)};
  }};},
  async batch(ops,pk){
   const backup=new Map(rows);
   for(const op of ops){
    const current=get(op.id||op.resourceBody.id,pk);
    if(op.operationType==='Create'&&current || op.ifMatch&&op.ifMatch!==current?._etag){
     rows.clear();for(const [k,v] of backup)rows.set(k,v);return {code:409};
    }
    if(op.operationType==='Delete')rows.delete(pk+'/'+op.id);else put(op.resourceBody);
   }return {code:200};
  }
 }
};
CosmosClient.prototype.database=function(){return {container:()=>container};};
OAuth2Client.prototype.getToken=async function({code}){await new Promise(r=>setTimeout(r,code==='alice'?10:1));return {tokens:{id_token:code,refresh_token:'refresh-'+code}};};
OAuth2Client.prototype.verifyIdToken=async function({idToken}){return {getPayload:()=>({sub:idToken,email_verified:true,email:idToken+'@example.test'})};};
OAuth2Client.prototype.request=async function(options){
 if(options.method==='POST'){googleWrites.push({owner:this.credentials.refresh_token,event:options.data});return {data:{}};}
 return {data:{items:[{id:this.credentials.refresh_token,summary:this.credentials.refresh_token,start:{date:'2026-10-12'},end:{date:'2026-10-13'}}]}};
};
OAuth2Client.prototype.revokeToken=async()=>({});
const original=app.http;app.http=(name,config)=>routes.set(config.route,config.handler);require('../dist/index.js');app.http=original;
async function call(path,{method='GET',body,session,headers={}}={}){
 const base=path.split('?')[0];const request=new HttpRequest({url:'https://app.test/api/'+path,method,headers:{...(session?{cookie:'__Host-session='+session.token,origin:'https://app.test','x-csrf-token':session.csrf}:{}),...headers},body:body?{string:JSON.stringify(body)}:undefined});
 return routes.get(base)(request);
}
async function login(user){
 const state='state-'+user;put({id:'oauth-'+digest(state),pk:system,verifier:seal('verifier'),expires:Date.now()+600000});
 const response=await call('auth/callback?state='+state+'&code='+user,{headers:{cookie:'__Host-oauth='+state}});
 assert.equal(response.status,302);
 const token=response.headers['Set-Cookie'].split(';')[0].split('=')[1];
 const sessionRow=get('session-'+digest(token),system);
 return {token,csrf:sessionRow.csrf,tenant:sessionRow.tenant};
}
test('Public registration, parallel requests, Google writes and LINE links are isolated',async()=>{
 const [alice,bob]=await Promise.all([login('alice'),login('bob')]);
 assert.notEqual(alice.tenant,bob.tenant);
 const eventPath='events?from=2026-10-01T00:00:00%2B09:00&to=2026-11-01T00:00:00%2B09:00';
 const lists=await Promise.all([call(eventPath,{session:alice}),call(eventPath,{session:bob})]);
 assert.equal(lists[0].jsonBody[0].id,'refresh-alice');assert.equal(lists[1].jsonBody[0].id,'refresh-bob');
 put({id:'web-private',pk:alice.tenant,kind:'job',status:'awaiting_confirmation'});
 const bobHistory=await call('history',{session:bob});assert.equal(bobHistory.jsonBody.length,0);
 const denied=await call('confirm',{method:'POST',session:bob,body:{id:'web-private'}});assert.equal(denied.status,409);
 const csrfDenied=await call('settings',{method:'POST',session:bob,body:{autoRegister:true,lineEnabled:false},headers:{'x-csrf-token':'wrong'}});assert.equal(csrfDenied.status,403);
 const manual={requestId:'12345678-1234-4234-8234-123456789abc',title:'会議',start:'2026-10-15T14:00:00+09:00',end:'2026-10-15T15:00:00+09:00',location:''};
 await Promise.all([call('events/create',{method:'POST',session:alice,body:manual}),call('events/create',{method:'POST',session:bob,body:manual})]);
 assert.equal(googleWrites.length,2);assert.notEqual(googleWrites[0].event.id,googleWrites[1].event.id);
 assert.deepEqual(new Set(googleWrites.map(x=>x.owner)),new Set(['refresh-alice','refresh-bob']));
 const aCode=await call('line/code',{method:'POST',session:alice,body:{}});
 const bCode=await call('line/code',{method:'POST',session:bob,body:{}});
 async function line(text,id){
  const body={events:[{type:'message',source:{type:'user',userId:'LINE-A'},webhookEventId:id,timestamp:Date.now(),message:{type:'text',text}}]};
  const signature=createHmac('sha256','line-secret').update(JSON.stringify(body)).digest('base64');
  return call('webhooks/line',{method:'POST',body,headers:{'x-line-signature':signature}});
 }
 await line(aCode.jsonBody.text,'a');await line(bCode.jsonBody.text,'b');
 assert.equal((await call('me',{session:alice})).jsonBody.lineLinked,true);
 assert.equal((await call('me',{session:bob})).jsonBody.lineLinked,false);
 assert.equal(get('line-'+digest('LINE-A'),system).tenant,alice.tenant);
 await call('settings',{method:'POST',session:alice,body:{autoRegister:false,lineEnabled:true}});
 await line('明日14時から15時に会議','message-1');
 assert.ok(get('line-'+digest('message-1'),alice.tenant));
 assert.equal(get('line-'+digest('message-1'),bob.tenant),undefined);
 await call('line/unlink',{method:'POST',session:alice,body:{}});
 assert.equal((await call('me',{session:alice})).jsonBody.lineLinked,false);
});

process.env.LINE_LOGIN_CHANNEL_ID='line-client';process.env.LINE_LOGIN_CHANNEL_SECRET='login-secret';
let lineNonce, lineSubject='LINE-LOGIN-NEW', badNonce=false;
globalThis.fetch=async(url,options)=>{
 const params=new URLSearchParams(options.body);
 if(url.endsWith('/token')){assert.ok(params.get('code_verifier'));return {ok:true,json:async()=>({id_token:'signed-token'})};}
 if(url.endsWith('/verify')){assert.equal(params.get('client_id'),'line-client');assert.equal(params.get('nonce'),lineNonce);return {ok:true,json:async()=>({sub:lineSubject,aud:'line-client',iss:'https://access.line.me',nonce:badNonce?'wrong':lineNonce,exp:Date.now()/1000+600})};}
 throw Error('Unexpected provider request');
};
async function lineLogin(existing){
 const start=await call('auth/line/start',{session:existing});assert.equal(start.status,302);
 const url=new URL(start.headers.Location);assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 const state=url.searchParams.get('state');lineNonce=url.searchParams.get('nonce');
 const options={headers:{cookie:'__Host-line-oauth='+state+(existing?'; __Host-session='+existing.token:'')}};
 const callback='auth/line/callback?state='+state+'&code=test';
 const response=await call(callback,options);
 return {response,callback,options};
}
function sessionFrom(response){
 assert.equal(response.status,302,JSON.stringify(response.jsonBody));
 const token=response.headers['Set-Cookie'].split(';')[0].split('=')[1];
 return {token,...get('session-'+digest(token),system)};
}
test('LINE-only login, local calendar, account linking, replay and nonce protection',async()=>{
 const expired=await call('auth/line/start',{headers:{cookie:'__Host-session=expired'}});assert.equal(expired.status,302);
 const first=await lineLogin();const user=sessionFrom(first.response);
 assert.equal((await call(first.callback,first.options)).status,400);
 assert.equal((await call('auth/line/callback?state=wrong&code=x')).status,400);
 let me=(await call('me',{session:user})).jsonBody;assert.equal(me.connected,false);assert.equal(me.lineLogin,true);
 const body={requestId:'eeeeeeee-1234-4234-8234-123456789abc',title:'LINEのみの予定',start:'2026-10-15T14:00:00+09:00',end:'2026-10-15T15:00:00+09:00',location:'東京'};
 const writes=googleWrites.length;
 assert.equal((await call('events/create',{method:'POST',session:user,body})).jsonBody.ok,true);
 await call('events/create',{method:'POST',session:user,body});assert.equal(googleWrites.length,writes);
 const path='events?from=2026-10-01T00:00:00%2B09:00&to=2026-11-01T00:00:00%2B09:00';
 const events=(await call(path,{session:user})).jsonBody;assert.equal(events.length,1);assert.equal(events[0].title,body.title);
 const second=sessionFrom((await lineLogin()).response);assert.equal(second.tenant,user.tenant);
 badNonce=true;assert.equal((await lineLogin()).response.status,403);badNonce=false;
 const alice=await login('alice');assert.equal((await lineLogin(alice)).response.status,409);
 lineSubject='LINE-LOGIN-ALICE';const linked=sessionFrom((await lineLogin(alice)).response);assert.equal(linked.tenant,alice.tenant);
 assert.equal(sessionFrom((await lineLogin()).response).tenant,alice.tenant);
 // Add Google to an existing LINE account, preserving its local events and identity.
 const started=await call('auth/start',{session:user});const state=new URL(started.headers.Location).searchParams.get('state');
 const google=await call('auth/callback?state='+state+'&code=line-google',{headers:{cookie:'__Host-oauth='+state+'; __Host-session='+user.token}});
 assert.equal(sessionFrom(google).tenant,user.tenant);
 assert.equal((await login('line-google')).tenant,user.tenant);
 assert.equal((await call('disconnect',{method:'POST',session:user,body:{}})).jsonBody.ok,true);
 assert.equal((await call('me',{session:user})).jsonBody.connected,false);
 assert.equal((await call(path,{session:user})).jsonBody.length,1);
 // Confirm an extracted message without a Google refresh token.
 const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 put({id:'web-line-confirm',pk:user.tenant,kind:'job',status:'awaiting_confirmation',event:{status:'event',title:'確認する予定',start:date+'T14:00:00+09:00',end:date+'T15:00:00+09:00',location:'',reason:''}});
 const before=googleWrites.length;
 assert.equal((await call('confirm',{method:'POST',session:user,body:{id:'web-line-confirm'}})).jsonBody.ok,true);
 assert.equal(googleWrites.length,before);
 assert.equal(get('web-line-confirm',user.tenant).status,'registered');
 assert.equal((await call('line/code',{method:'POST',session:user,body:{}})).jsonBody.text.startsWith('連携 '),true);
});
