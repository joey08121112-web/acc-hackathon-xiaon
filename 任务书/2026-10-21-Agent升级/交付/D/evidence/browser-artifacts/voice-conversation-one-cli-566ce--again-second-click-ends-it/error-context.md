# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: voice-conversation.spec.ts >> one click starts a conversation; after ASR, chat and spoken reply it listens again; second click ends it
- Location: tests-agent/d/voice-conversation.spec.ts:11:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('.talk-hold')
Expected: "listening"
Received: "requesting"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" locator('.talk-hold') with timeout 5000ms
  - waiting for locator('.talk-hold')
    14 × locator resolved to <button type="button" class="talk-hold" aria-pressed="true" aria-label="结束语音对话" data-phase="requesting">…</button>
       - unexpected value "requesting"

```

```yaml
- button "结束语音对话" [pressed]:
  - text: 结束语音对话
  - img
```

# Test source

```ts
  1  | import { test,expect,type Page } from '@playwright/test';
  2  | import { initial,PROGRESS_KEY } from '../../src/domain';
  3  | 
  4  | async function ready(page:Page){
  5  |  await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:PROGRESS_KEY,value:{...initial(),onboarded:true,age:'adult',necessary:true,page:'home'}});
  6  |  await page.goto('/');await expect(page.getByRole('textbox',{name:'对小N说',exact:true})).toBeVisible();
  7  |  await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
  8  |  await page.getByRole('button',{name:'切换到语音'}).click();
  9  | }
  10 | 
  11 | test('one click starts a conversation; after ASR, chat and spoken reply it listens again; second click ends it',async({page})=>{
  12 |  let asr=0,chats=0;page.on('request',r=>{if(r.url().endsWith('/voice/asr'))asr++;if(r.url().endsWith('/learning/chat'))chats++;});
  13 |  await ready(page);
  14 |  await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
> 15 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
     |                                           ^ Error: expect(locator).toHaveAttribute(expected) failed
  16 |  const end=page.getByRole('button',{name:'结束语音对话',exact:true});await expect(end).toBeEnabled();
  17 |  await expect.poll(()=>chats,{timeout:20000}).toBe(1);
  18 |  await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false',{timeout:15000});
  19 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening',{timeout:15000});
  20 |  expect(asr).toBe(1);await end.click();
  21 |  await expect(page.getByRole('button',{name:'开始语音对话',exact:true})).toBeVisible();
  22 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
  23 |  await page.waitForTimeout(1800);expect(chats).toBe(1);
  24 | });
  25 | 
  26 | test('ending during recognition cancels the upload and never sends a late transcript as a chat',async({page})=>{
  27 |  let release!:()=>void,chats=0;
  28 |  const gate=new Promise<void>(r=>{release=r;});
  29 |  page.on('request',r=>{if(r.url().endsWith('/learning/chat'))chats++;});
  30 |  await page.route('**/api/voice/asr',async route=>{await gate;await route.fulfill({json:{text:'这句话不应该发送'}}).catch(()=>{});});
  31 |  await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
  32 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','transcribing',{timeout:15000});
  33 |  await page.getByRole('button',{name:'结束语音对话',exact:true}).click();release();
  34 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');await page.waitForTimeout(1000);expect(chats).toBe(0);
  35 | });
  36 | 
  37 | test('switching to typing or leaving home closes the microphone session',async({page})=>{
  38 |  await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
  39 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
  40 |  await page.getByRole('button',{name:'切换到打字'}).click();
  41 |  await expect(page.getByRole('textbox',{name:'对小N说',exact:true})).toBeVisible();
  42 |  await page.getByRole('button',{name:'切换到语音'}).click();
  43 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
  44 |  await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
  45 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
  46 |  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'专业模式',exact:true}).click();
  47 |  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'小N',exact:true}).click();
  48 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
  49 | });
  50 | 
  51 | test('browser speech fallback also continues after playback and stops without restarting',async({page})=>{
  52 |  await page.route('**/api/health',async route=>{const response=await route.fetch();const body=await response.json();body.voice.asr=false;await route.fulfill({response,json:body});});
  53 |  await page.addInitScript(()=>{
  54 |   class Recognition {
  55 |    static instances:Recognition[]=[];
  56 |    onstart?:()=>void;onresult?:(e:{results:{transcript:string}[][]})=>void;onend?:()=>void;
  57 |    constructor(){Recognition.instances.push(this);}
  58 |    start(){queueMicrotask(()=>this.onstart?.());}abort(){}stop(){this.onend?.();}
  59 |    speak(){this.onresult?.({results:[[{transcript:'我今天有点烦'}]]});this.onend?.();}
  60 |   }
  61 |   Object.assign(window,{SpeechRecognition:Recognition,__recognitions:Recognition.instances});
  62 |  });
  63 |  await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
  64 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
  65 |  await page.evaluate(()=>{const rs=(window as unknown as {__recognitions:{speak():void}[]}).__recognitions;rs.at(-1)!.speak();});
  66 |  await expect.poll(()=>page.evaluate(()=>(window as unknown as {__recognitions:unknown[]}).__recognitions.length),{timeout:15000}).toBe(2);
  67 |  await page.getByRole('button',{name:'结束语音对话',exact:true}).click();
  68 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
  69 | });
  70 | 
  71 | test('ending while the model is replying keeps its text but suppresses late speech and microphone restart',async({page})=>{
  72 |  let release!:()=>void,tts=0,thinkingClips=0;
  73 |  const gate=new Promise<void>(r=>{release=r;});
  74 |  await page.route('**/api/learning/chat',async route=>{const response=await route.fetch();await gate;await route.fulfill({response});});
  75 |  page.on('request',r=>{if(r.url().endsWith('/voice/tts'))tts++;if(/\/voice\/(think|long)-/.test(r.url()))thinkingClips++;});
  76 |  await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
  77 |  await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','true',{timeout:15000});
  78 |  await page.getByRole('button',{name:'结束语音对话',exact:true}).click();
  79 |  await page.waitForTimeout(2200);expect(thinkingClips).toBe(0);release();
  80 |  await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
  81 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');expect(tts).toBe(0);
  82 | });
  83 | 
  84 | test('a thinking clip ending must not reopen the microphone while reply audio is still being generated',async({page})=>{
  85 |  let release!:()=>void;
  86 |  const gate=new Promise<void>(r=>{release=r;});
  87 |  await page.route('**/api/learning/chat',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,1800));await route.fulfill({response});});
  88 |  await page.route('**/api/voice/tts',async route=>{await gate;await route.continue();});
  89 |  await ready(page);await page.getByRole('button',{name:'开始语音对话',exact:true}).click();
  90 |  await page.waitForRequest(r=>r.url().endsWith('/voice/tts'),{timeout:20000});
  91 |  await page.waitForTimeout(3500); // let the short thinking clip finish while TTS is deliberately held
  92 |  await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
  93 |  release();await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening',{timeout:15000});
  94 |  await page.getByRole('button',{name:'结束语音对话',exact:true}).click();
  95 | });
  96 | 
```