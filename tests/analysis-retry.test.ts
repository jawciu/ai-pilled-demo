import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnalysisRequestError,analysisRetryDelay,createAnalysisRetry,jitterRetryDelay} from '../src/lib/analysis-retry';

test('transient extraction failures respect Retry-After and network default',()=>{
 for(const code of [429,502,503]) assert.equal(analysisRetryDelay(new AnalysisRequestError('Retry',code,'75')),75000);
 assert.equal(analysisRetryDelay(new AnalysisRequestError('Retry',429,'Wed, 25 Nov 2026 12:01:00 GMT'),Date.parse('2026-11-25T12:00:00Z')),60000);
 assert.equal(analysisRetryDelay(new TypeError('Failed to fetch')),60000);
 assert.equal(analysisRetryDelay(new AnalysisRequestError('No',401)),null);
 assert.equal(analysisRetryDelay(new Error('No session')),null);
});
test('three automatic attempts then manual retry remains available without resetting budget',async()=>{
 let calls=0,success=0; const timers=new Map<number,()=>void>();let next=0;
 const runner=createAnalysisRetry({random:()=>0,perform:async()=>{calls++;throw new AnalysisRequestError('Busy',429,'60');},onSuccess:async()=>{success++;},onError:()=>{},onBusy:()=>{},
 schedule:(fn,delay)=>{assert.equal(delay,60000);timers.set(++next,fn);return next as unknown as ReturnType<typeof setTimeout>;},unschedule:id=>{timers.delete(id as unknown as number);}});
 runner.setKey('event:user:v1');await runner.run();await runner.run();assert.equal(calls,1,'manual clicks respect pending backoff');
 async function tick(){const [id,fn]=timers.entries().next().value!;timers.delete(id);fn();await new Promise(r=>setImmediate(r));}
 await tick();await tick();assert.equal(calls,3);assert.equal(timers.size,0);assert.equal(success,0);
 await runner.run();assert.equal(calls,4);assert.equal(timers.size,0,'manual attempt does not reset auto budget');
 runner.setKey('event:user:v2');await runner.run();assert.equal(calls,5);assert.equal(timers.size,1);
 runner.setKey(null);assert.equal(timers.size,0);
});
test('identity/version cancellation aborts old requests and suppresses stale completion',async()=>{
 let resolve!:()=>void;let signal:AbortSignal|undefined;let success=0,errors=0;
 const runner=createAnalysisRetry({perform:s=>{signal=s;return new Promise<void>(r=>{resolve=r;});},onSuccess:async()=>{success++;},onError:()=>{errors++;},onBusy:()=>{}});
 runner.setKey('event:user:v1');const pending=runner.run();runner.setKey('another-event:user:v2');assert.equal(signal!.aborted,true);resolve();await pending;assert.equal(success,0);assert.equal(errors,0);
});

test('positive retry jitter spreads requests without undercutting Retry-After',()=>{
 assert.equal(jitterRetryDelay(60000,()=>0),60000);
 assert.equal(jitterRetryDelay(60000,()=>0.5),65000);
 assert.equal(jitterRetryDelay(60000,()=>0.9999),69999);
 assert.equal(analysisRetryDelay(new DOMException('Timed out','TimeoutError')),60000);
});
test('offline requests pause without spending attempts, and online resumes only paused work',async()=>{
 let online=false,calls=0;const timers:Array<()=>void>=[];
 const runner=createAnalysisRetry({canRun:()=>online,random:()=>0,perform:async()=>{calls++;throw new TypeError('Disconnected');},onSuccess:async()=>{},onError:()=>{},onBusy:()=>{},schedule:fn=>{timers.push(fn);return 1 as unknown as ReturnType<typeof setTimeout>;}});
 runner.setKey('version1');await runner.run();assert.equal(calls,0);
 online=true;await runner.resume();assert.equal(calls,1);
 await runner.resume();assert.equal(calls,1,'online events cannot bypass Retry-After');
 online=false;timers.shift()!();await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 online=true;await runner.resume();assert.equal(calls,2);
 timers.shift()!();await new Promise(r=>setImmediate(r));assert.equal(calls,3);
 await runner.resume();assert.equal(calls,3,'reconnect cannot restart exhausted retry budget');
});
