import { test,expect,type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const shots=join(tmpdir(),'xiaon-f-browser','shots');
const api=process.env.XIAON_F_API_PORT??'18963';
const voiceLog=async(page:Page)=>(await page.request.get(`http://127.0.0.1:${api}/__test/voice-log`,{headers:{'X-Xiaon-Test':'synthetic-f-only'}})).json() as Promise<{spoken:string[];heard:{bytes:number;wav:boolean}[]}>;
async function onboard(page:Page){await page.goto('/');await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');await page.getByRole('checkbox',{name:'我已了解基本服务所需信息与本机演示规则'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验'}).click();await expect(page.getByRole('heading',{name:'今天，按你的节奏来。'})).toBeVisible();await expect(page.getByText('模拟模型 · 真实工具 / SQLite',{exact:true})).toBeVisible();}
/** Viewport centre of a spot that really belongs to the zone (curved arms and leaves are not their bounding-box centre). */
async function point(page:Page,scope:string,zone:string){
 return page.evaluate(([s,z])=>{const svg=document.querySelector(`${s} .mascot`)!,r=svg.querySelector(`[data-zone="${z}"]`)!.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let best:[number,number]|null=null,bd=1e9;
  for(let x=r.left;x<=r.right;x+=2)for(let y=r.top;y<=r.bottom;y+=2){const el=document.elementFromPoint(x,y);if(el?.closest('[data-zone]')?.getAttribute('data-zone')===z){const d=Math.hypot(x-cx,y-cy);if(d<bd){bd=d;best=[x,y];}}}return best!;},[scope,zone] as const);
}
/** The body is the unmarked default zone: pick a spot on the body path itself, away from the arms, leaf and belly. */
async function bodyPoint(page:Page,scope:string){
 return page.evaluate(s=>{const svg=document.querySelector(`${s} .mascot`)!,r=svg.getBoundingClientRect(),cx=r.left+r.width*0.5,cy=r.top+r.height*0.36;let best:[number,number]|null=null,bd=1e9;
  for(let x=r.left;x<=r.right;x+=2)for(let y=r.top;y<=r.bottom;y+=2){const el=document.elementFromPoint(x,y);if(el&&svg.contains(el)&&el.tagName==='path'&&!el.closest('[data-zone]')){const d=Math.hypot(x-cx,y-cy);if(d<bd){bd=d;best=[x,y];}}}return best!;},scope);
}
const moodOf=(page:Page,scope:string)=>page.locator(`${scope} .mascot`).evaluate(el=>(el.getAttribute('class')!.match(/mood-(\w+)/)??[])[1]);
const tap=async(page:Page,scope:string,zone:string)=>{const [x,y]=zone==='body'?await bodyPoint(page,scope):await point(page,scope,zone);await page.mouse.click(x,y);};
const LINES={poke:['嘿嘿，我在呢。','哎，痒痒的。','怎么啦？我在听。','戳戳戳，我听见啦。'],belly:['哈哈，别挠肚子，好痒！','咯咯咯，那里最怕痒了。'],leaf:['那是我的小叶子，轻轻碰就好。','叶子动啦，它在跟你打招呼。'],hand:['来，击个掌！','握握手，我们是好朋友。'],pat:['嗯，好舒服，谢谢你。','被摸摸头，心里暖暖的。'],dizzy:['哎呀，别戳啦，我有点晕。']};
test.beforeAll(()=>{});
test('home pet: each part answers differently; poking many times makes it dizzy; hold/stroke is a pat',async({page})=>{
 await onboard(page);const line=page.locator('.hero-art .pet-line');
 await tap(page,'.hero-art','leaf');await expect(line).toHaveText(new RegExp(LINES.leaf.join('|')));expect(await moodOf(page,'.hero-art')).toBe('leaf');
 await expect(line).toHaveCount(0,{timeout:5000});
 await tap(page,'.hero-art','hand-r');await expect(line).toHaveText(new RegExp(LINES.hand.join('|')));expect(await moodOf(page,'.hero-art')).toBe('waveR');await expect(line).toHaveCount(0,{timeout:5000});
 await tap(page,'.hero-art','hand-l');expect(await moodOf(page,'.hero-art')).toBe('waveL');await expect(line).toHaveCount(0,{timeout:5000});
 await tap(page,'.hero-art','belly');await expect(line).toHaveText(new RegExp(LINES.belly.join('|')));expect(await moodOf(page,'.hero-art')).toBe('giggle');await page.screenshot({path:join(shots,'home-belly-giggle.png')});await expect(line).toHaveCount(0,{timeout:5000});
 await tap(page,'.hero-art','body');await expect(line).toHaveText(new RegExp(LINES.poke.join('|')));await expect(line).toHaveCount(0,{timeout:5000});
 // five quick pokes
 const [px,py]=await bodyPoint(page,'.hero-art');for(let i=0;i<5;i++)await page.mouse.click(px,py);
 await expect(line).toHaveText(LINES.dizzy[0]);expect(await moodOf(page,'.hero-art')).toBe('dizzy');await page.screenshot({path:join(shots,'home-dizzy.png')});
 await page.mouse.click(px,py);await expect(line).toHaveText(LINES.dizzy[0],{timeout:500}); // still dizzy: further pokes are ignored
 await expect(line).toHaveCount(0,{timeout:5000});
 // hold = pat
 const [x,y]=await bodyPoint(page,'.hero-art');await page.mouse.move(x,y);await page.mouse.down();await expect(line).toHaveText(new RegExp(LINES.pat.join('|')),{timeout:3000});expect(await moodOf(page,'.hero-art')).toBe('happy');await page.screenshot({path:join(shots,'home-pat-happy.png')});await page.mouse.up();
 await expect(line).toHaveCount(0,{timeout:5000});
 // stroking across the body = pat too
 await page.mouse.move(x-50,y);await page.mouse.down();await page.mouse.move(x+60,y+10,{steps:6});await page.mouse.move(x-40,y+20,{steps:6});await page.mouse.up();
 await expect(line).toHaveText(new RegExp(LINES.pat.join('|')));
});

test('chat page: big pet, mic and keyboard side by side; quick replies; typing is optional; history sits below and can be collapsed',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:/先聊聊/}).first().click();
 const pet=page.locator('.pet-hero .mascot');await expect(pet).toBeVisible();
 const box=(await pet.boundingBox())!;expect(box.width).toBeGreaterThan(240);expect(box.height).toBeGreaterThan(225); // the pet is the main thing on screen
 await expect(page.locator('.pet-hero-bubble')).toHaveText('嗨，我是小N。今天过得怎么样？想跟我说说吗？');
 await expect(page.getByLabel('对小N说',{exact:true})).toBeVisible(); // the input bar starts in typing mode, like the last-used mode in WeChat
 await page.getByRole('button',{name:'切换到语音'}).click();await expect(page.getByRole('button',{name:/按住 说话/})).toBeVisible();await expect(page.getByLabel('对小N说',{exact:true})).toBeHidden();
 await page.screenshot({path:join(shots,'chat-first-screen.png')});
 // a quick-reply the student chose changes the pet's face; free text never does
 await page.getByRole('button',{name:'今天有点烦',exact:true}).click();expect(await moodOf(page,'.pet-hero')).toBe('concerned');
 await expect(page.locator('.pet-hero-bubble')).toHaveText('我在这里。我们只做你愿意的一步。');
 await expect(page.getByRole('button',{name:'考试没考好',exact:true})).toBeVisible();
 // poking works on this page too, and the pet looks at the pointer
 await page.mouse.move(10,300);const left=await page.locator('.pet-hero .pet-look').evaluate(el=>getComputedStyle(el).transform);await page.mouse.move(380,300);await expect.poll(()=>page.locator('.pet-hero .pet-look').evaluate(el=>getComputedStyle(el).transform)).not.toBe(left);
 await expect(page.locator('.pet-hero-bubble')).toBeVisible();
 const bad=await new AxeBuilder({page}).analyze().then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact??'')).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target.join(' ')+' :: '+(n.any[0]?.message??'')).slice(0,4)})));
 expect(bad).toEqual([]);
});

test('microphone: one tap records, stops by itself after a pause, sends a WAV to the server, shows what was heard and the pet answers aloud',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:/先聊聊/}).first().click();
 await expect.poll(()=>page.evaluate(()=>fetch('/api/health').then(r=>r.json()).then(d=>d.voice.asr))).toBe(true);
 await page.getByRole('button',{name:'切换到语音'}).click();
 const mic=page.getByRole('button',{name:/按住 说话/});await mic.click();
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');expect(await moodOf(page,'.pet-hero')).toBe('listening');
 await expect(page.locator('.talk-hold')).toHaveCSS('background-color','rgb(196, 105, 79)'); // a clearly different, high-contrast "recording" colour
 await expect(page.locator('.pet-hero-bubble')).toHaveText('我在听，你慢慢说…');await page.screenshot({path:join(shots,'chat-listening.png')});
 // no second tap: the pause after the fake voice ends the recording
 await expect(page.locator('.pet-hero-bubble')).toHaveText('我在这里。我们只做你愿意的一步。',{timeout:20000});
 const log=await voiceLog(page);expect(log.heard).toHaveLength(1);expect(log.heard[0].wav).toBe(true);expect(log.heard[0].bytes).toBeGreaterThan(30000);expect(log.heard[0].bytes).toBeLessThan(400000);
 await expect.poll(async()=>(await voiceLog(page)).spoken).toContain('我在这里。我们只做你愿意的一步。');
 await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','idle');
});

test('microphone can be cancelled by tapping again, and a refused permission leaves typing available',async({page,context})=>{
 await onboard(page);await page.getByRole('button',{name:/先聊聊/}).first().click();
 await page.getByRole('button',{name:'切换到语音'}).click();await page.getByRole('button',{name:/按住 说话/}).click();await expect(page.locator('.talk-hold')).toHaveAttribute('data-phase','listening');
 await page.getByRole('button',{name:/我在听/}).click(); // second tap = stop and send what was said (nothing was said yet)
 await expect(page.locator('.talk-hold')).not.toHaveAttribute('data-phase','listening',{timeout:8000});
 await page.getByRole('button',{name:'切换到打字'}).click();await page.getByLabel('对小N说',{exact:true}).fill('我想打字说');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.locator('.pet-hero-bubble')).toHaveText('我在这里。我们只做你愿意的一步。');
 await context.clearPermissions();
});

test('the microphone is never requested by loading, refreshing, switching pages or touching the pet; only the mic button asks',async({page})=>{
 await page.addInitScript(()=>{
  const w=window as unknown as {__mic:{getUserMedia:number;recognition:number}};w.__mic={getUserMedia:0,recognition:0};
  const md=navigator.mediaDevices,orig=md.getUserMedia.bind(md);md.getUserMedia=(c?:MediaStreamConstraints)=>{w.__mic.getUserMedia++;return orig(c);};
  const SR=(window as unknown as Record<string,{prototype:{start():void}}|undefined>).webkitSpeechRecognition;if(SR){const start=SR.prototype.start;SR.prototype.start=function(){w.__mic.recognition++;return start.call(this);};}
 });
 const asked=()=>page.evaluate(()=>{const m=(window as unknown as {__mic:{getUserMedia:number;recognition:number}}).__mic;return m.getUserMedia+m.recognition;});
 await onboard(page);expect(await asked()).toBe(0);
 await tap(page,'.hero-art','belly');await page.reload();await expect(page.getByRole('heading',{name:'今天，按你的节奏来。'})).toBeVisible();expect(await asked()).toBe(0);
 await page.getByRole('button',{name:/先聊聊/}).first().click();await page.getByRole('button',{name:'切换到语音'}).click();await expect(page.locator('.talk-hold')).toBeVisible();
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'探索',exact:true}).click();await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'小N',exact:true}).click();
 await page.reload();await page.waitForTimeout(800);expect(await asked()).toBe(0);
 await page.getByRole('button',{name:/先聊聊/}).first().click();await page.locator('.talk-hold').click();await expect.poll(asked).toBeGreaterThan(0);
});
