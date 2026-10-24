import { test,expect,type Page } from '@playwright/test';
import { initial,PROGRESS_KEY } from '../../src/domain';

async function ready(page:Page){
 await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:PROGRESS_KEY,value:{...initial(),onboarded:true,age:'adult',necessary:true,page:'home'}});
 await page.goto('/');await expect(page.getByRole('textbox',{name:'对小N说',exact:true})).toBeVisible();
 await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
 await page.getByRole('button',{name:'切换到语音'}).click();
}

test('one click starts a conversation; after ASR, chat and spoken reply it listens again; second click ends it',async({page})=>{
 let asr=0,chats=0;page.on('request',r=>{if(r.url().endsWith('/voice/asr'))asr++;if(r.url().endsWith('/learning/chat'))chats++;});
 await ready(page);
 await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
 const end=page.getByRole('button',{name:'结束语音对话',exact:true});await expect(end).toBeEnabled();
 await expect.poll(()=>chats,{timeout:20000}).toBe(1);
 await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false',{timeout:15000});
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening',{timeout:15000});
 expect(asr).toBe(1);await end.click();
 await expect(page.getByRole('button',{name:'开始语音对话',exact:true})).toBeVisible();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
 await page.waitForTimeout(1800);expect(chats).toBe(1);
});

test('ending during recognition cancels the upload and never sends a late transcript as a chat',async({page})=>{
 let release!:()=>void,chats=0;
 const gate=new Promise<void>(r=>{release=r;});
 page.on('request',r=>{if(r.url().endsWith('/learning/chat'))chats++;});
 await page.route('**/api/voice/asr',async route=>{await gate;await route.fulfill({json:{text:'这句话不应该发送'}}).catch(()=>{});});
 await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','transcribing',{timeout:15000});
 await page.getByRole('button',{name:'结束语音对话',exact:true}).click();release();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');await page.waitForTimeout(1000);expect(chats).toBe(0);
});

test('switching to typing or leaving home closes the microphone session',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
 await page.getByRole('button',{name:'切换到打字'}).click();
 await expect(page.getByRole('textbox',{name:'对小N说',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'切换到语音'}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
 await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'专业模式',exact:true}).click();
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'小N',exact:true}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
});

test('browser speech fallback also continues after playback and stops without restarting',async({page})=>{
 await page.route('**/api/health',async route=>{const response=await route.fetch();const body=await response.json();body.voice.asr=false;await route.fulfill({response,json:body});});
 await page.addInitScript(()=>{
  class Recognition {
   static instances:Recognition[]=[];
   onstart?:()=>void;onresult?:(e:{results:{transcript:string}[][]})=>void;onend?:()=>void;
   constructor(){Recognition.instances.push(this);}
   start(){queueMicrotask(()=>this.onstart?.());}abort(){}stop(){this.onend?.();}
   speak(){this.onresult?.({results:[[{transcript:'我今天有点烦'}]]});this.onend?.();}
  }
  Object.assign(window,{SpeechRecognition:Recognition,__recognitions:Recognition.instances});
 });
 await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
 await page.evaluate(()=>{const rs=(window as unknown as {__recognitions:{speak():void}[]}).__recognitions;rs.at(-1)!.speak();});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {__recognitions:unknown[]}).__recognitions.length),{timeout:15000}).toBe(2);
 await page.getByRole('button',{name:'结束语音对话',exact:true}).click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
});

test('ending while the model is replying keeps its text but suppresses late speech and microphone restart',async({page})=>{
 let release!:()=>void,tts=0,thinkingClips=0;
 const gate=new Promise<void>(r=>{release=r;});
 await page.route('**/api/learning/chat',async route=>{const response=await route.fetch();await gate;await route.fulfill({response});});
 page.on('request',r=>{if(r.url().endsWith('/voice/tts'))tts++;if(/\/voice\/(think|long)-/.test(r.url()))thinkingClips++;});
 await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
 await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','true',{timeout:15000});
 await page.getByRole('button',{name:'结束语音对话',exact:true}).click();
 await page.waitForTimeout(2200);expect(thinkingClips).toBe(0);release();
 await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');expect(tts).toBe(0);
});

test('a thinking clip ending must not reopen the microphone while reply audio is still being generated',async({page})=>{
 let release!:()=>void;
 const gate=new Promise<void>(r=>{release=r;});
 await page.route('**/api/learning/chat',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,1800));await route.fulfill({response});});
 await page.route('**/api/voice/tts',async route=>{await gate;await route.continue();});
 await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
 await page.waitForRequest(r=>r.url().endsWith('/voice/tts'),{timeout:20000});
 await page.waitForTimeout(3500); // let the short thinking clip finish while TTS is deliberately held
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
 release();await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening',{timeout:15000});
 await page.getByRole('button',{name:'结束语音对话',exact:true}).click();
});
