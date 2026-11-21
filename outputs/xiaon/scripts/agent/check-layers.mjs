/** 依赖方向门禁。分层不是靠自觉维持的，靠这条命令。
 *
 * 规则（越靠前越底层）：
 *   shared/   ← 谁都能依赖它
 *   server/core/    ← 只依赖 shared/ 与 node 内置
 *   server/plugins/ ← 依赖 core/，不依赖 agents/
 *   server/agents/  ← 依赖 plugins/、core/
 *   src/      ← 只依赖 shared/，不依赖 server/
 *
 * 历史教训：2026-11-21 审查发现 server 反向 import src（服务端从前端目录取题库）、
 * plugins 反向 import agents（阶段机住在 agents 层却在 plugins 层被用）、
 * 前端从 server 实现反推类型。三条都修掉了，这里防止它们再长回来。
 *
 * 退出码 0 = 全部合规；1 = 存在越层依赖，逐条打印。
 */
import { readdirSync,readFileSync,statSync } from 'node:fs';
import { join,relative,resolve } from 'node:path';

const root=resolve(process.argv[2]??'.');

/** 递归收集某目录下的 .ts/.tsx 文件（跳过 node_modules、dist、.git）。 */
function collect(dir){
 const out=[];
 let entries;
 try{entries=readdirSync(dir,{withFileTypes:true});}catch{return out;}
 for(const e of entries){
  if(e.name==='node_modules'||e.name==='dist'||e.name==='dist-server'||e.name==='.git'||e.name==='.local')continue;
  const full=join(dir,e.name);
  if(e.isDirectory())out.push(...collect(full));
  else if(/\.(ts|tsx)$/.test(e.name))out.push(full);
 }
 return out;
}

/** 取文件里的 import specifier（只认静态 import / export from）。 */
function specifiers(source){
 const out=[];
 const re=/(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]/g;
 let m;
 while((m=re.exec(source)))out.push(m[1]);
 const bare=/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
 while((m=bare.exec(source)))out.push(m[1]);
 return out;
}

/** 相对路径解析到仓库内的实际文件（粗粒度：够判断层归属即可）。 */
function resolveLocal(fromFile,spec){
 if(!spec.startsWith('.'))return null;
 const base=resolve(fromFile,'..',spec);
 for(const candidate of [base,`${base}.ts`,`${base}.tsx`,join(base,'index.ts'),join(base,'index.tsx')]){
  try{if(statSync(candidate).isFile())return candidate;}catch{/* 继续试下一个 */}}
 return base;
}

const rules=[
 {name:'server 不得依赖 src',from:'server',deny:['src/']},
 {name:'src 不得依赖 server',from:'src',deny:['server/']},
 {name:'server/plugins 不得依赖 server/agents',from:'server/plugins',deny:['server/agents/']},
];

const violations=[];
for(const rule of rules){
 const fromDir=join(root,rule.from);
 for(const file of collect(fromDir)){
  for(const spec of specifiers(readFileSync(file,'utf8'))){
   const target=resolveLocal(file,spec);
   if(!target)continue;
   const rel=relative(root,target).split('\\').join('/');
   if(rule.deny.some(prefix=>rel.startsWith(prefix))){
    violations.push(`${rule.name}：${relative(root,file)} → ${rel}`);
   }
  }
 }
}

if(violations.length){
 console.error('分层越界：');
 for(const v of violations)console.error('  · '+v);
 process.exit(1);
}
console.log('分层门禁通过：server↛src、src↛server、plugins↛agents');
