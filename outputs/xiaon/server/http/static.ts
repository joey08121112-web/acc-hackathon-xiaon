import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
/** Serves the built SPA from the same origin as /api so the browser client needs no cross-origin setup. */
const contentTypes:Record<string,string>={
 '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.map':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon',
 '.zip':'application/zip','.mp3':'audio/mpeg','.woff':'font/woff','.woff2':'font/woff2','.webmanifest':'application/manifest+json',
};
export function createStaticHandler(root:string){
 const base=resolve(root);const index=resolve(base,'index.html');
 statSync(index);
 return function serveStatic(req:IncomingMessage,res:ServerResponse,pathname:string):boolean{
  if(req.method!=='GET'&&req.method!=='HEAD')return false;
  let decoded:string;try{decoded=decodeURIComponent(pathname);}catch{return false;}
  if(decoded.includes('\0'))return false;
  let file=resolve(base,'.'+decoded);
  if(file!==base&&!file.startsWith(base+sep))return false;
  let stat=statOrNull(file);
  if(stat?.isDirectory()){file=resolve(file,'index.html');stat=statOrNull(file);}
  if(!stat){
   // A missing asset must stay a 404; only extension-less app routes fall back to the shell.
   if(extname(decoded))return false;
   file=index;stat=statOrNull(index);if(!stat)return false;
  }
  const immutable=decoded.startsWith('/assets/');
  res.writeHead(200,{'Content-Type':contentTypes[extname(file).toLowerCase()]??'application/octet-stream','Content-Length':stat.size,'Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache'});
  if(req.method==='HEAD'){res.end();return true;}
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  return true;
 };
}
function statOrNull(path:string){try{return statSync(path);}catch{return null;}}
