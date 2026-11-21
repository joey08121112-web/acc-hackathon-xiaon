/** 把服务端编译成 CommonJS 产物（dist-server/）。
 * 2026-11-21 加：生产镜像原本用 tsx 直接跑 .ts 源码，等于把 TypeScript 转译器带进运行时。
 * 编译后运行镜像里只需要 node + 生产依赖。
 * 仓库根是 "type":"module"，所以要在产物目录里再放一个 package.json 声明 commonjs。 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
// 先清空产物目录：tsc 不会删除已不存在源文件对应的旧 .js，
// 改过模块位置后残留的旧产物会被一起打进镜像，运行时加载到过期实现。
rmSync('dist-server',{recursive:true,force:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.server.json'],{stdio:'inherit'});
writeFileSync('dist-server/package.json',JSON.stringify({type:'commonjs'},null,2)+'\n');
console.log('服务端已编译到 dist-server/');
