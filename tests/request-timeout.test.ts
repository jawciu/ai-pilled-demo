import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withRequestTimeout} from '../src/lib/request-timeout';

test('a hung request is aborted and releases its caller',async()=>{
 let signal:AbortSignal|undefined;
 await assert.rejects(withRequestTimeout(s=>{signal=s;return new Promise(()=>{});},10),{name:'TimeoutError'});
 assert.equal(signal!.aborted,true);
});
test('external cancellation aborts work and normal completion survives its cleared timer',async()=>{
 const controller=new AbortController();let signal:AbortSignal|undefined;
 const request=withRequestTimeout(s=>{signal=s;return new Promise(()=>{});},1000,controller.signal);
 await Promise.resolve();controller.abort();await assert.rejects(request,{name:'AbortError'});assert.equal(signal!.aborted,true);
 let completedSignal!:AbortSignal;
 assert.equal(await withRequestTimeout(s=>{completedSignal=s;return Promise.resolve(42);},10),42);
 await new Promise(r=>setTimeout(r,20));assert.equal(completedSignal.aborted,false);
});
