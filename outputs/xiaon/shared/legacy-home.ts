/** 旧小N首页已被自由聊替代。保留历史数据和源码，但不再开放旧智能体事件入口。 */
export const LEGACY_HOME_DISABLED_MESSAGE='旧小N的智能体和提示词已停用，请回到小N首页使用自由聊。';
export const LEGACY_HOME_PATHS=[
 'chat',
 'learning/chat',
 'learning/greeting',
 'learning/conversation/end',
 'learning/loop',
 'learning/recognize',
 'learning/problem/confirm',
 'learning/progress-card/confirm',
 'learning/memory/confirm-draft',
] as const;
const paths=new Set<string>(LEGACY_HOME_PATHS);
export function isLegacyHomePath(path:string){
 return paths.has(path.split(/[?#]/,1)[0].replace(/^\//,'').replace(/^api\//,''));
}
