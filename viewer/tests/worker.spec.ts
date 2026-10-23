import { afterEach, expect, test, vi } from 'vitest';
import { ImportController, type WorkerPort } from '../src/import/controller';
import { handleRequest } from '../src/import/worker-handler';
import { importError } from '../src/import/errors';
import { LIMITS } from '../src/import/limits';
import type { ParseRequest } from '../src/import/protocol';
import { fixture, bytes } from './helpers';

class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage']=null;
  onerror: WorkerPort['onerror']=null;
  onmessageerror: WorkerPort['onmessageerror']=null;
  request: ParseRequest | undefined;
  postMessage=vi.fn((request:ParseRequest)=>{this.request=request;});
  terminate=vi.fn();
  reply(data:unknown){this.onmessage?.({data} as MessageEvent<unknown>);}
}
const file=()=>new Blob([bytes(fixture()).slice().buffer as ArrayBuffer]);
afterEach(()=>{vi.useRealTimers();});
test('Worker handler validates actual Blob and returns typed success with matching id', async()=>{
  const result=await handleRequest({protocol:1,id:7,file:file()});expect(result).toEqual({protocol:1,id:7,result:{ok:true,report:fixture()}});
});
test.each([null,{}, {protocol:2,id:1,file:new Blob()}, {protocol:1,id:-1,file:new Blob()}, {protocol:1,id:1,file:'not-a-file'}])('Worker rejects malformed request %#',async input=>{
  expect(await handleRequest(input)).toMatchObject({result:{ok:false,error:{code:'WorkerError'}}});
});
test('Worker validation exception returns no raw error or input',async()=>{
  const result=await handleRequest({protocol:1,id:1,file:file()},async()=>{throw new Error('SECRET_LOG');});
  expect(result).toMatchObject({result:{ok:false,error:{code:'WorkerError'}}});expect(JSON.stringify(result)).not.toContain('SECRET_LOG');
});
test('Worker schema failure returns only classified failure, never a partial report',async()=>{
  const result=await handleRequest({protocol:1,id:2,file:new Blob(['{}'])});
  expect(result.result).toMatchObject({ok:false,error:{code:'SchemaError'}});expect(result.result).not.toHaveProperty('report');
});
test('controller releases worker and timer on success',async()=>{
  vi.useFakeTimers();const w=new FakeWorker();const c=new ImportController(()=>w);const pending=c.import(file());
  w.reply({protocol:1,id:w.request!.id,result:{ok:true,report:fixture()}});
  expect(await pending).toEqual({ok:true,report:fixture()});expect(w.terminate).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);expect(w.onmessage).toBeNull();
});
test.each(['construction','postMessage','error','messageerror','protocol'])('controller safely handles %s failure',async mode=>{
  const w=new FakeWorker();const c=new ImportController(()=>{if(mode==='construction')throw new Error('SECRET');return w;});
  if(mode==='postMessage')w.postMessage.mockImplementation(()=>{throw new Error('SECRET');});
  const pending=c.import(file());
  if(mode==='error')w.onerror?.({preventDefault:vi.fn(),message:'SECRET'} as unknown as ErrorEvent);
  if(mode==='messageerror')w.onmessageerror?.({} as MessageEvent<unknown>);
  if(mode==='protocol')w.reply({protocol:2,id:w.request!.id,result:{ok:true,report:fixture()}});
  const result=await pending;expect(result).toMatchObject({ok:false,error:{code:'WorkerError'}});expect(JSON.stringify(result)).not.toContain('SECRET');
  if(mode!=='construction')expect(w.terminate).toHaveBeenCalledOnce();
});
test('controller timeout has finite cleanup and ResourceLimitError',async()=>{
  vi.useFakeTimers();const w=new FakeWorker();const c=new ImportController(()=>w);const pending=c.import(file());
  await vi.advanceTimersByTimeAsync(LIMITS.workerMs);expect(await pending).toMatchObject({ok:false,error:{code:'ResourceLimitError'}});expect(w.terminate).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});
test('oversize is rejected without starting a Worker',async()=>{
  const factory=vi.fn(()=>new FakeWorker());const c=new ImportController(factory);
  expect(await c.import(new Blob([new Uint8Array(LIMITS.bytes+1)]))).toMatchObject({ok:false,error:{code:'ResourceLimitError'}});expect(factory).not.toHaveBeenCalled();
});
test('replacement cancels previous request and stale callback cannot replace current result',async()=>{
  const first=new FakeWorker(),second=new FakeWorker();const factory=vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);const c=new ImportController(factory);
  const a=c.import(file());const stale=first.onmessage!;const b=c.import(file());
  expect(await a).toMatchObject({ok:false,error:{code:'Cancelled'}});
  stale({data:{protocol:1,id:1,result:{ok:true,report:fixture()}}} as MessageEvent<unknown>);
  second.reply({protocol:1,id:second.request!.id,result:{ok:false,error:importError('ParseError')}});
  expect(await b).toMatchObject({ok:false,error:{code:'ParseError'}});expect(first.terminate).toHaveBeenCalledOnce();expect(second.terminate).toHaveBeenCalledOnce();
});
test('explicit cancel is idempotent and late messages are ignored',async()=>{
  const w=new FakeWorker();const c=new ImportController(()=>w);const p=c.import(file());c.cancel();c.cancel();
  expect(await p).toMatchObject({ok:false,error:{code:'Cancelled'}});expect(w.terminate).toHaveBeenCalledOnce();
});
test('controller preserves bounded schema issue locations but never transports raw messages',async()=>{
  const w=new FakeWorker();const pending=new ImportController(()=>w).import(file());
  w.reply({protocol:1,id:w.request!.id,result:{ok:false,error:{code:'SchemaError',message:'SECRET',issues:[{path:'/score',keyword:'type'}]}}});
  const result=await pending;
  expect(result).toEqual({ok:false,error:importError('SchemaError',[{path:'/score',keyword:'type'}])});
  expect(JSON.stringify(result)).not.toContain('SECRET');
});
test.each([{},null,{protocol:1,result:{}},{protocol:1,id:'1',result:{}},
  {protocol:1,id:1,result:{ok:false,error:{code:'SchemaError',issues:[{path:'x'.repeat(257),keyword:'type'}]}}}
])('controller immediately rejects malformed response %#',async message=>{
  vi.useFakeTimers();const w=new FakeWorker();const pending=new ImportController(()=>w).import(file());
  w.reply(message);
  expect(await pending).toMatchObject({ok:false,error:{code:'WorkerError'}});
  expect(w.terminate).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});
test('controller ignores a stale request id and accepts the active response',async()=>{
  const w=new FakeWorker();const pending=new ImportController(()=>w).import(file());
  w.reply({protocol:1,id:99,result:{ok:true,report:fixture()}});
  expect(w.terminate).not.toHaveBeenCalled();
  w.reply({protocol:1,id:w.request!.id,result:{ok:true,report:fixture()}});
  expect(await pending).toMatchObject({ok:true});
});
