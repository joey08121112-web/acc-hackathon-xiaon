import { spawnSync } from 'node:child_process';
import { readFileSync,readdirSync } from 'node:fs';
const sentinel='XIAON_SYNTHETIC_BUNDLE_SENTINEL_20261021_NO_REAL_CREDENTIAL';
const result=spawnSync('npm',['run','build'],{stdio:'inherit',env:{...process.env,VITE_LLM_API_KEY:sentinel,VITE_LLM_BASE_URL:'https://sentinel.invalid',VITE_LLM_MODEL:'sentinel',XIAON_GLM_API_KEY:sentinel}});
if(result.status!==0)process.exit(result.status??1);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);}
const artifacts=files('dist');const leaked=artifacts.filter(p=>readFileSync(p).includes(Buffer.from(sentinel)));
console.log(JSON.stringify({check:'actual_frontend_bundle_sentinel',artifactsChecked:artifacts.length,leakedFiles:leaked,offlineArtifactRegenerated:false}));process.exit(leaked.length?1:0);
