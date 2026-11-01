import { test,expect,type Page } from '@playwright/test';
import { initial,PROGRESS_KEY } from '../../src/domain';
import { WORKSPACE_KEY } from '../../src/agents/useLearning';
async function ready(page:Page,sound=false,permission:'prompt'|'granted'='prompt',blocked=false,playbackMs=40,legacy=false){
 await page.addInitScript(({key,value,sound,permission,blocked,playbackMs,legacy,workspace})=>{
  localStorage.setItem(key,JSON.stringify(legacy?{...value,page:'chat'}:value));localStorage.setItem('xiaon-voice-on',String(sound));
  if(legacy)localStorage.setItem(workspace,JSON.stringify({pending:{path:'learning/chat',body:{operationId:'retired',history:[{role:'user',content:'不要重试旧智能体'}]}},chat:[{role:'user',content:'保留旧缓存原文'}]}));
  Object.defineProperty(navigator.permissions,'query',{value:async()=>({state:permission})});
  class Recognition{
   static all:Recognition[]=[];onstart?:()=>void;onresult?:(event:unknown)=>void;onend?:()=>void;
   constructor(){Recognition.all.push(this);}start(){queueMicrotask(()=>this.onstart?.());}abort(){}stop(){this.onend?.();}
   say(text:string){this.onresult?.({results:[[{transcript:text}]]});this.onend?.();}
  }
  Object.assign(window,{SpeechRecognition:Recognition,__recognitions:Recognition.all});
  // 合成音频生命周期，验证收听/播报顺序，不代表真实设备声音效果。
  Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return this.dataset.playing!=='1';}});
  HTMLMediaElement.prototype.play=function(){Object.assign(window,{__lastAudio:this});if(blocked)return Promise.reject(new DOMException('autoplay blocked','NotAllowedError'));this.dataset.playing='1';queueMicrotask(()=>this.dispatchEvent(new Event('playing')));setTimeout(()=>{this.dataset.playing='0';this.dispatchEvent(new Event('ended'));},playbackMs);return Promise.resolve();};
  HTMLMediaElement.prototype.pause=function(){this.dataset.playing='0';this.dispatchEvent(new Event('pause'));};
 },{key:PROGRESS_KEY,value:{...initial(),onboarded:true,age:'adult',necessary:true,page:'home'},sound,permission,blocked,playbackMs,legacy,workspace:WORKSPACE_KEY});
 await page.route('**/api/health',async route=>{const response=await route.fetch(),json=await response.json();json.voice.asr=false;await route.fulfill({response,json});});
 await page.goto(legacy?'/#chat':'/');await expect(page.getByRole('button',{name:'开始语音对话',exact:true})).toBeEnabled();
}
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true});
const recognize=(page:Page,text:string)=>page.evaluate(t=>(window as unknown as {__recognitions:{say(text:string):void}[]}).__recognitions.at(-1)!.say(t),text);

test('旧chat链接回到自由聊，缓存的旧智能体请求不再显示重试或联网',async({page})=>{
 const old:string[]=[];page.on('request',r=>{if(/\/api\/(chat(?:\?|$)|learning\/(chat|greeting|conversation))/.test(r.url()))old.push(r.url());});
 await ready(page,false,'prompt',false,40,true);await expect(page).toHaveURL(/#home$/);await expect(page.locator('.companion-chat')).toBeVisible();
 await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await nav(page,'成长').click();
 await expect(page.getByRole('button',{name:'重试上次请求',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'我的档案'})).toBeVisible();
 expect(old).toEqual([]);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).chat[0].content,WORKSPACE_KEY)).toBe('保留旧缓存原文');
});

test('首页直接用自由聊；缩小后可打字，切换自由聊入口共用同一回复',async({page})=>{
 await page.setViewportSize({width:380,height:625});
 const old:string[]=[];page.on('request',r=>{if(/\/learning\/(chat|greeting|conversation)/.test(r.url()))old.push(r.url());});
 await ready(page);
 const stage=page.locator('.companion-chat');await expect(stage).toHaveAttribute('data-compact','false');
 expect((await page.locator('.companion-pet .mascot').boundingBox())!.width).toBeLessThanOrEqual(240);
 await page.screenshot({path:'/tmp/xiaon-home-expanded.png'});
 const caption=(await page.locator('.companion-full-caption').boundingBox())!,controls=(await page.locator('.companion-voice-controls').boundingBox())!;
 expect(caption.y+caption.height).toBeLessThan(controls.y);
 await page.setViewportSize({width:320,height:568});
 await expect.poll(async()=>(await page.locator('.companion-pet').boundingBox())!.width).toBeLessThan(193);
 const shortCaption=(await page.locator('.companion-full-caption').boundingBox())!,shortControls=(await page.locator('.companion-voice-controls').boundingBox())!;
 expect(shortCaption.y+shortCaption.height+5).toBeLessThan(shortControls.y);
 await page.screenshot({path:'/tmp/xiaon-home-short-expanded.png'});await page.setViewportSize({width:380,height:625});
 await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await expect(stage).toHaveAttribute('data-compact','true');
 await page.getByRole('textbox',{name:'对小N说',exact:true}).fill('首页共享会话测试');
 await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.locator('.free-chat-list').first()).toHaveAttribute('aria-busy','false');
 await expect(page.getByText('我在听。你想从哪里开始聊？',{exact:true}).last()).toBeVisible();
 await nav(page,'自由聊').click();await expect(page.getByText('首页共享会话测试',{exact:true})).toBeVisible();
 await nav(page,'小N').click();await expect(stage).toHaveAttribute('data-compact','true');await expect(page.getByText('首页共享会话测试',{exact:true})).toBeVisible();expect(old).toEqual([]);
 await page.screenshot({path:'/tmp/xiaon-home-compact.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('直接拖小N时连续跟手，松手收成顶部栏；键盘和减弱动效可展开',async({page})=>{
 await ready(page);const pet=page.getByRole('button',{name:'按住小N向下拉，切换语音与聊天'}),box=(await pet.boundingBox())!;
 const original=await pet.evaluate(el=>el.style.transform);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+120,{steps:10});
 await expect.poll(()=>pet.evaluate(el=>el.style.transform)).not.toBe(original);
 await expect(page.locator('.companion-chat')).toHaveAttribute('data-compact','false');
 await page.mouse.up();await expect(page.locator('.companion-chat')).toHaveAttribute('data-compact','true');
 await expect(page.locator('.companion-mini')).toBeVisible();
 await page.getByRole('button',{name:'展开小N',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.companion-chat')).toHaveAttribute('data-compact','false');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await expect(page.locator('.companion-chat')).toHaveAttribute('data-compact','true');
});

test('进入时播报开场白，首次权限待确认时不自动开麦',async({page})=>{
 let tts=0;page.on('request',r=>{if(r.url().endsWith('/voice/tts'))tts++;});await ready(page,true);
 await expect.poll(()=>tts).toBeGreaterThan(0);await expect.poll(()=>page.evaluate(()=>(window as unknown as {__recognitions:unknown[]}).__recognitions.length)).toBe(0);
 await page.getByRole('button',{name:'开始语音对话',exact:true}).click();await expect(page.locator('.free-chat')).toHaveAttribute('data-mic-phase','listening');
 // An old audio source can report an error after intentional stop/revoke; it must not end the new mic session.
 await page.evaluate(()=>(window as unknown as {__lastAudio:HTMLMediaElement}).__lastAudio.dispatchEvent(new Event('error')));
 await expect(page.locator('.free-chat')).toHaveAttribute('data-voice-running','true');
 await page.getByRole('button',{name:'结束语音对话',exact:true}).click();await expect(page.locator('.free-chat')).toHaveAttribute('data-mic-phase','idle');
});

test('已有权限时开场白结束后自动听，回复播完继续听；离开首页结束收音',async({page})=>{
 let chats=0;page.on('request',r=>{if(r.url().endsWith('/api/free-chat'))chats++;});await ready(page,true,'granted');
 await expect(page.locator('.free-chat')).toHaveAttribute('data-mic-phase','listening');await recognize(page,'连续语音测试');
 await expect.poll(()=>chats).toBe(1);await expect.poll(()=>page.evaluate(()=>(window as unknown as {__recognitions:unknown[]}).__recognitions.length)).toBe(2);
 await expect(page.locator('.free-chat')).toHaveAttribute('data-mic-phase','listening');
 await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await nav(page,'自由聊').click();await nav(page,'小N').click();await expect(page.locator('.free-chat')).toHaveAttribute('data-mic-phase','idle');
});

test('等模型时停止语音，晚到回复保留文字但不播报或重开麦',async({page})=>{
 let opening=0;page.on('request',r=>{if(r.url().endsWith('/voice/tts'))opening++;});await ready(page,true);await expect.poll(()=>opening).toBeGreaterThan(0);await expect(page.locator('.free-chat')).toHaveAttribute('data-voice-phase','idle');
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);let tts=0;
 await page.route('**/api/free-chat',async route=>{const response=await route.fetch();await gate;await route.fulfill({response});});
 page.on('request',r=>{if(r.url().endsWith('/voice/tts'))tts++;});
 await page.getByRole('button',{name:'开始语音对话',exact:true}).click();await expect(page.locator('.free-chat')).toHaveAttribute('data-mic-phase','listening');
 await recognize(page,'停止后不要朗读测试');await expect(page.locator('.free-chat-list').first()).toHaveAttribute('aria-busy','true');
 await page.getByRole('button',{name:'结束语音对话',exact:true}).click();release();
 await expect(page.locator('.free-chat-list').first()).toHaveAttribute('aria-busy','false');await expect(page.getByText('停止后不要朗读测试',{exact:true})).toBeVisible();
 expect(tts).toBe(0);expect(await page.evaluate(()=>(window as unknown as {__recognitions:unknown[]}).__recognitions.length)).toBe(1);
});

test('旧学习原文超过八场仍可展开更早场次，不依赖小结',async({page})=>{
 await page.route('**/api/learning',async route=>{const response=await route.fetch(),json=await response.json();json.summaries=[];json.chatLog=Array.from({length:9},(_,i)=>({schemaVersion:'1.0.0',id:'archive-'+i,operationId:'op-'+i,sessionId:'old-'+i,role:'user',content:'旧记录标记-'+i,at:`2026-10-${String(20+i).padStart(2,'0')}T02:00:00.000Z`}));await route.fulfill({response,json});});
 await ready(page);await page.getByRole('button',{name:'缩小小N，查看对话'}).click();
 await expect(page.getByText('旧记录标记-0',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'再看更早的对话',exact:true}).click();
 const archive=page.locator('details').filter({hasText:'2026/10/20'});await archive.locator('summary').click();await expect(page.getByText('旧记录标记-0',{exact:true})).toBeVisible();
});

test('档案删除失败保留条目并可重试',async({page})=>{
 await page.route('**/api/free-chat/digest',route=>route.fulfill({json:{digest:{runId:'digest-test',changes:[{op:'add',itemId:'item-test',kind:'interest',text:'喜欢养猫'}]},consolidating:false}}));
 await page.route('**/api/free-chat/profile/item',route=>route.fulfill({status:503,json:{error:{message:'合成失败'}}}));
 await ready(page);await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await page.getByRole('button',{name:'不对，删掉',exact:true}).click();
 await expect(page.getByText('这条暂时没删掉，请再点一次',{exact:true})).toBeVisible();await expect(page.getByText('记住了「喜欢养猫」',{exact:true})).toBeVisible();
});

test('回复等待期间切页仍保留同一请求和回复',async({page})=>{
 await ready(page);let release!:()=>void;const gate=new Promise<void>(r=>release=r);let calls=0;
 await page.route('**/api/free-chat',async route=>{calls++;const response=await route.fetch();await gate;await route.fulfill({response});});
 await page.getByRole('button',{name:'切换到打字'}).click();await page.getByRole('textbox',{name:'对小N说',exact:true}).fill('在途切页唯一消息');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.locator('.free-chat-list').first()).toHaveAttribute('aria-busy','true');await nav(page,'自由聊').click();release();
 await expect(page.locator('.free-chat-list').first()).toHaveAttribute('aria-busy','false');await nav(page,'小N').click();
 await expect(page.getByText('在途切页唯一消息',{exact:true})).toHaveCount(1);expect(calls).toBe(1);
});

test('以前的自由聊超过八场仍可回看，并能加载同段更早消息',async({page})=>{
 await page.route('**/api/free-chat/threads',route=>route.fulfill({json:{threads:Array.from({length:9},(_,i)=>({threadId:'archive-'+(8-i),startedAt:'2026-10-20T02:00:00.000Z',preview:'旧自由聊-'+(8-i),messageCount:202}))}}));
 await page.route('**/api/free-chat/messages?*',route=>{
  const query=new URL(route.request().url()).searchParams;
  return route.fulfill({json:{threadId:query.get('threadId'),messages:[{id:query.has('before')?'first':'last',role:'user',content:query.has('before')?'更早的一句话':'旧段最后一句',createdAt:'2026-10-20T02:00:00.000Z'}],hasMore:!query.has('before'),before:'first'}});
 });
 await ready(page);await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await page.getByRole('button',{name:'再看更早的聊天',exact:true}).click();
 await page.locator('summary').filter({hasText:'旧自由聊-0'}).click();await expect(page.getByText('旧段最后一句',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'再看这一段更早的消息',exact:true}).click();await expect(page.getByText('更早的一句话',{exact:true})).toBeVisible();
});

test('浏览器拒绝自动播放时显示可用的开始入口，文字仍在',async({page})=>{
 await ready(page,true,'prompt',true);
 await expect(page.getByText('浏览器需要你点一下「开始语音对话」才能发声，文字都在。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await expect(page.locator('.free-bubble.assistant').first()).toContainText('嗨，我是小N');
 await expect(page.getByRole('button',{name:'开始语音对话',exact:true})).toBeEnabled();
});

test('收起与展开保留同一次收音；静音保留会话，取消静音继续听',async({page})=>{
 await ready(page,true,'granted');const root=page.locator('.free-chat');
 const count=()=>page.evaluate(()=>(window as unknown as {__recognitions:unknown[]}).__recognitions.length);
 await expect(root).toHaveAttribute('data-mic-phase','listening');expect(await count()).toBe(1);
 await page.getByRole('button',{name:'缩小小N，查看对话'}).click();await expect(root).toHaveAttribute('data-voice-running','true');
 await expect(root).toHaveAttribute('data-mic-phase','listening');expect(await count()).toBe(1);
 await page.getByRole('button',{name:'展开语音',exact:true}).click();await expect(root).toHaveAttribute('data-mic-phase','listening');expect(await count()).toBe(1);
 await page.getByRole('button',{name:'静音麦克风',exact:true}).click();await expect(root).toHaveAttribute('data-mic-phase','idle');await expect(root).toHaveAttribute('data-voice-running','true');
 await page.getByRole('button',{name:'打开麦克风',exact:true}).click();await expect(root).toHaveAttribute('data-mic-phase','listening');expect(await count()).toBe(2);
});

test('播报时切换打字只静音麦克风，回复继续播放，随后可恢复收音',async({page})=>{
 await ready(page,true,'granted',false,600);const root=page.locator('.free-chat');
 await expect(root).toHaveAttribute('data-mic-phase','listening');await recognize(page,'打字期间继续播报测试');
 await expect(root).toHaveAttribute('data-voice-phase','playing');await page.getByRole('button',{name:'切换到打字'}).click();
 await expect(root).toHaveAttribute('data-mic-muted','true');await expect(root).toHaveAttribute('data-voice-running','true');
 await expect(root).toHaveAttribute('data-voice-phase','playing');await expect(page.getByRole('textbox',{name:'对小N说',exact:true})).toBeFocused();
 await expect(root).toHaveAttribute('data-voice-phase','idle');await expect(root).toHaveAttribute('data-mic-phase','idle');
 await page.getByRole('button',{name:'打开麦克风',exact:true}).click();await expect(root).toHaveAttribute('data-mic-phase','listening');
});

test('长聊天在内容区滚动，顶部宠物和语音栏固定；窄屏控件完整可见',async({page})=>{
 await page.setViewportSize({width:320,height:648});
 await page.route('**/api/free-chat/messages',route=>route.fulfill({json:{threadId:'long-ui',messages:Array.from({length:30},(_,i)=>({id:'long-'+i,role:i%2?'assistant':'user',content:'滚动聊天记录测试 '+i,createdAt:'2026-11-01T00:00:00Z'})),hasMore:false,before:null}}));
 await ready(page);await page.getByRole('button',{name:'缩小小N，查看对话'}).focus();await page.keyboard.press('Enter');
 const pet=page.locator('.companion-pet'),before=(await pet.boundingBox())!;
 await page.locator('.companion-messages').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const after=(await pet.boundingBox())!;expect(after.y).toBeCloseTo(before.y,1);expect(after.width).toBeCloseTo(54,0);
 await expect(page.locator('.free-chat-list').getByText('滚动聊天记录测试 29',{exact:true})).toBeInViewport();
 for(const name of ['静音麦克风','展开语音','开始语音对话'])await expect(page.getByRole('button',{name,exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/xiaon-home-narrow.png'});
});
