/** Pre-recorded lines (synthesized once by scripts/agent/make-voice-clips.ts into public/voice/). Browser safe. */
export type ClipGroup = 'think' | 'long' | 'greet' | 'opener' | 'error' | 'poke' | 'belly' | 'leaf' | 'hand' | 'pat' | 'dizzy' | 'sleepy' | 'retry';
export const CLIPS: ReadonlyArray<{ id: string; group: ClipGroup; text: string }> = [
 { id: 'think-1', group: 'think', text: '嗯，让我想想哦。' },
 { id: 'think-2', group: 'think', text: '我在认真听，让我想一想。' },
 { id: 'think-3', group: 'think', text: '嗯嗯，我想想怎么说。' },
 { id: 'think-4', group: 'think', text: '收到，我理一理你说的。' },
 { id: 'think-5', group: 'think', text: '好，我认真想一想。' },
 { id: 'long-1', group: 'long', text: '这个有点难，再给我一点点时间。' },
 { id: 'long-2', group: 'long', text: '我还在想，你不用着急。' },
 { id: 'long-3', group: 'long', text: '快想好了，再等我一下下。' },
 { id: 'long-4', group: 'long', text: '谢谢你等我，马上就好。' },
 { id: 'greet-1', group: 'greet', text: '你好，我是小N，我们慢慢来。' },
 { id: 'opener-1', group: 'opener', text: '嗨，我是小N。今天过得怎么样？想跟我说说吗？' },
 { id: 'error-1', group: 'error', text: '我这边卡了一下，我们再试一次好吗？' },
 // Touch reactions: the on-screen line is always this text, with or without sound.
 { id: 'poke-1', group: 'poke', text: '嘿嘿，我在呢。' },
 { id: 'poke-2', group: 'poke', text: '哎，痒痒的。' },
 { id: 'poke-3', group: 'poke', text: '怎么啦？我在听。' },
 { id: 'poke-4', group: 'poke', text: '戳戳戳，我听见啦。' },
 { id: 'belly-1', group: 'belly', text: '哈哈，别挠肚子，好痒！' },
 { id: 'belly-2', group: 'belly', text: '咯咯咯，那里最怕痒了。' },
 { id: 'leaf-1', group: 'leaf', text: '那是我的小叶子，轻轻碰就好。' },
 { id: 'leaf-2', group: 'leaf', text: '叶子动啦，它在跟你打招呼。' },
 { id: 'hand-1', group: 'hand', text: '来，击个掌！' },
 { id: 'hand-2', group: 'hand', text: '握握手，我们是好朋友。' },
 { id: 'pat-1', group: 'pat', text: '嗯，好舒服，谢谢你。' },
 { id: 'pat-2', group: 'pat', text: '被摸摸头，心里暖暖的。' },
 { id: 'dizzy-1', group: 'dizzy', text: '哎呀，别戳啦，我有点晕。' },
 { id: 'sleepy-1', group: 'sleepy', text: '嘘，我在休息，你也可以歇一会儿。' },
 { id: 'sleepy-2', group: 'sleepy', text: '今天先歇歇，休息也是在照顾自己。' },
 { id: 'sleepy-3', group: 'sleepy', text: '我打个小盹，想聊天随时叫我。' },
 { id: 'sleepy-4', group: 'sleepy', text: '想继续学的时候，点上面的继续学习就好。' },
 { id: 'sleepy-5', group: 'sleepy', text: '呼……我陪你一起放松一会儿。' },
 { id: 'retry-1', group: 'retry', text: '我没听清，再说一次好吗？' },
];
export const clipsOf = (group: ClipGroup) => CLIPS.filter(c => c.group === group);
export const clipById = (id: string) => CLIPS.find(c => c.id === id);
export const clipUrl = (id: string) => `/voice/${id}.mp3`;
