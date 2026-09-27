import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
const require=createRequire(import.meta.url);
const { app, HttpRequest }=require('@azure/functions');
const routes=new Map();
const original=app.http;
app.http=(name,config)=>routes.set(config.route,config.handler);
require('../dist/index.js');
app.http=original;
function request(path,method='GET',body,headers={}) {
 return new HttpRequest({url:'https://app.test/api/'+path,method,headers,body:body===undefined?undefined:{string:body}});
}
test('health endpoint does not require secrets',async()=>{
 const response=await routes.get('health')(request('health'));
 assert.deepEqual(response.jsonBody,{ok:true,version:'0.2.0'});
});
test('private endpoints reject unauthenticated requests before DB access',async()=>{
 for(const [path,method] of [['events','GET'],['history','GET'],['events/create','POST'],['settings','POST']]){
  const response=await routes.get(path)(request(path,method,'{}'));
  assert.equal(response.status,401,path);
 }
});
test('LINE rejects invalid signatures and accepts signed URL verification',async()=>{
 process.env.LINE_CHANNEL_SECRET='test-secret';
 const raw='{"events":[]}';
 const denied=await routes.get('webhooks/line')(request('webhooks/line','POST',raw));
 assert.equal(denied.status,401);
 const signature=createHmac('sha256','test-secret').update(raw).digest('base64');
 const accepted=await routes.get('webhooks/line')(request('webhooks/line','POST',raw,{'x-line-signature':signature}));
 assert.equal(accepted.status,200);
});
test('worker rejects incorrect secret without DB access',async()=>{
 process.env.WORKER_SECRET='worker-test-secret';
 const response=await routes.get('worker')(request('worker','POST','{}',{'x-worker-secret':'wrong'}));
 assert.equal(response.status,401);
});
