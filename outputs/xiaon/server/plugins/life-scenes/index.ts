/** 所有者：zCode（生活话题观察：预置场景库，2026-10-24）。产品决策：综合模式从"只观察学习话题"扩展到
 * 生活话题。演示优先：问题和观察点都写死在场景里，程序在 companion 轮按触发词匹配后直接调用，模型只负责
 * 把问题说自然、按观察点判断 signal；观察仍走 validateObservation 的通道，quote 逐字、每维度每场≤3、unverified。
 * 每个聊天场次最多用一次场景；学生拒绝、转向学习或告别就中止，不追问。 */
export interface LifeSceneObserve { dimension:'理解'|'逻辑';lookFor:string;notEvidence:string }
/** observe 为空的是纯经历问题（如"你去过故宫吗"），永远不产生观察。 */
export interface LifeSceneTurn { ask:string;observe?:LifeSceneObserve }
export interface LifeScene { id:string;title:string;trigger:RegExp;turns:LifeSceneTurn[] }
export const LIFE_SCENES:LifeScene[]=[
 {id:'gugong',title:'故宫与对称',trigger:/故宫|天安门|长城|北京/,turns:[
  {ask:'你去过故宫吗？'},
  {ask:'那你觉得故宫的房子是怎么排的，有什么特别的地方？没去过也可以猜猜它为什么出名。',observe:{dimension:'理解',lookFor:'学生用自己的话说出布局特点（比如左右对称、中间一条线）并解释这个说法的意思',notEvidence:'是否去过、是否知道建筑术语都不算，说不出也不代表能力弱'}},
  {ask:'为什么设计者要把房子排得左右对称？你能想出一个不对称也挺好看、或者不对称反而更妙的东西吗？',observe:{dimension:'逻辑',lookFor:'给出一个说得通的理由，并且真的试着举反例（举得对不对是另一回事）',notEvidence:'建筑知识对错不算，只复述"对称就是好看"没有理由也不算'}},
 ]},
 {id:'place',title:'那地方的构造',trigger:/名胜|古迹|古镇|博物馆|兵马俑|东方明珠|外滩|园林|寺庙|古城|景区|建筑|城堡|宫殿|大雁塔|西湖/,turns:[
  {ask:'你去玩的那个地方，最让你印象深刻的一处房子、塔或者布置是什么样的？说给我听听，像我没去过一样。',observe:{dimension:'理解',lookFor:'能具体说出一个构造或布局的特点（对称、层层向上、绕着走、挨着水等都算），像描述给没去过的人听',notEvidence:'地名和建筑名记得多不多、去没去过都不算，说不出也不代表能力弱'}},
  {ask:'你觉得当时的人为什么这样设计？能想到不是这样设计、也很好看或好用的地方吗？',observe:{dimension:'逻辑',lookFor:'对设计原因给出说得通的推测，并且真的试着举一个反例',notEvidence:'历史知识对不对不算，猜错方向但推理自洽也算'}},
 ]},
 {id:'trip',title:'当一天导游',trigger:/旅游|旅行|导游|放假.{0,6}去|出去玩/,turns:[
  {ask:'如果让你当一天导游带朋友逛你的城市，一天怎么安排？先去哪后去哪？',observe:{dimension:'理解',lookFor:'安排里说出道理，比如先远后近、把累的放前面、留时间吃饭',notEvidence:'地方选得好不好、去没去过都不算'}},
 ]},
 {id:'ball',title:'赢一场比赛',trigger:/篮球|足球|排球|比赛|打球|球赛/,turns:[
  {ask:'你觉得赢一场比赛，最关键的往往是什么？用一个你看过的例子说说。',observe:{dimension:'理解',lookFor:'能把自己的观点落到一个具体例子上，说清"关键在哪一步"',notEvidence:'记不记得比分、懂不懂规则都不算'}},
  {ask:'最后落后两分还剩十秒，教练故意犯规停表，你觉得图什么？有什么风险？',observe:{dimension:'逻辑',lookFor:'能说出这个选择的得失两头，而不是只说"犯规不好"',notEvidence:'知不知道篮球规则术语不算'}},
 ]},
 {id:'game',title:'游戏里的一招',trigger:/游戏|手游|王者|我的世界|吃鸡|蛋仔/,turns:[
  {ask:'这个游戏里你用得最顺的一招是什么？它是怎么起作用的？',observe:{dimension:'理解',lookFor:'能说清这招"为什么有用"，比如它卡住了对面的哪一步',notEvidence:'玩得好不好、段位高低都不算'}},
  {ask:'如果对面每次都用你这招，你会怎么破？说说你的思路。',observe:{dimension:'逻辑',lookFor:'针对那招的原理想出反制办法，并且说得通',notEvidence:'答案是不是"标准解"不算'}},
 ]},
 {id:'movie',title:'讲一部片子',trigger:/电影|动画|动画片|电视剧|追剧|番剧/,turns:[
  {ask:'用三四句话给我讲讲它讲了什么？不剧透结尾也行。',observe:{dimension:'理解',lookFor:'能抓住主线讲清楚，而不是罗列记得的片段',notEvidence:'记得细节多不多不算'}},
  {ask:'你觉得主角那个最重要的决定做得对吗？说说你的理由，也可以反驳我。',observe:{dimension:'逻辑',lookFor:'理由和结论对得上，哪怕结论跟我不同',notEvidence:'结论对不对、跟剧情一样不一样不算'}},
 ]},
 {id:'music',title:'喜欢的那首歌',trigger:/唱歌|歌曲|歌手|听歌|音乐|周杰伦/,turns:[
  {ask:'你喜欢这首歌哪一点？用自己的话说说它好在哪。',observe:{dimension:'理解',lookFor:'能说出具体的点（旋律、词、节奏）并解释打动自己的原因',notEvidence:'知不知道歌名、歌手、乐理都不算'}},
  {ask:'要是给全班选一首必听的歌，你按什么标准挑？为什么是这个标准？',observe:{dimension:'逻辑',lookFor:'标准说得清，而且真的能用来挑歌',notEvidence:'选哪首歌不算'}},
 ]},
 {id:'animal',title:'猫狗的小秘密',trigger:/小猫|小狗|猫|狗|宠物|动物/,turns:[
  {ask:'猫睡那么多也不耽误抓老鼠，你猜猜为什么？说说你的理由。',observe:{dimension:'逻辑',lookFor:'给出的理由和"睡得多"之间有因果联系，哪怕只是猜测',notEvidence:'知不知道生物学答案不算'}},
  {ask:'有人说狗摇尾巴就一定是开心，你见过或者能想出不一样的例子吗？',observe:{dimension:'逻辑',lookFor:'试着举反例或指出"不一定"的理由',notEvidence:'例子是不是真事不算，编的例子只要自洽也行'}},
 ]},
 {id:'cooking',title:'煮一碗面',trigger:/做饭|烧菜|煮面|下厨|炒菜|下饺子/,turns:[
  {ask:'煮一碗面，先放什么后放什么？为什么要按这个顺序？',observe:{dimension:'理解',lookFor:'步骤的先后说得出道理，比如水开了才下锅',notEvidence:'会不会真的做饭、步骤是否和专业一样都不算'}},
  {ask:'要是面煮出来总粘成一坨，你会先检查哪一步？为什么先查它？',observe:{dimension:'逻辑',lookFor:'排查顺序有理由，比如"最可能出问题的先查"',notEvidence:'知不知道正确答案不算'}},
 ]},
 {id:'money',title:'零花钱怎么花',trigger:/零花钱|攒钱|花钱|存钱|零用钱/,turns:[
  {ask:'这个月零花钱就五十块，一杯奶茶十五，你怎么决定喝几杯？',observe:{dimension:'逻辑',lookFor:'能说出取舍的考虑，比如留多少、值得不值',notEvidence:'决定本身抠不抠都不算'}},
  {ask:'你觉得一个东西"值不值"是怎么算出来的？用你买过的东西举例。',observe:{dimension:'理解',lookFor:'能说清自己衡量"值"的标准并落到例子上',notEvidence:'买的东西贵不便宜不算'}},
 ]},
 {id:'weather',title:'下雨之前',trigger:/下雨|台风|打雷|天气预报|变天/,turns:[
  {ask:'下大雨前蚂蚁为什么要搬家？你怎么验证这个说法靠不靠谱？',observe:{dimension:'逻辑',lookFor:'想到去观察或查证的办法，而不是直接信或不信',notEvidence:'知不知道科学解释不算'}},
  {ask:'天气预报说降水概率百分之七十，你觉得这句话是什么意思？',observe:{dimension:'理解',lookFor:'能用自己的话解释"概率"大概指什么，不用很精确',notEvidence:'说不出准确数学定义不算'}},
 ]},
];
/** 学生明确不想继续这个话题时中止场景；和 DECLINE/REST 不同，那只关于学习。 */
export const LIFE_REFUSAL=/不想说|不想聊|别问|不聊这个|换个话题|没什么好说的|不想回答|不想聊这个/;
/** 学习关键词兜底：阶段机已把学习话题分去 probe，这里再防一手触发词撞上学习句。 */
const STUDY_HINT=/考试|考砸|成绩|分数|错题|作业|题目|数学|复习|测验|期中|期末/;
export function matchLifeScene(text:string):LifeScene|null{
 if(STUDY_HINT.test(text))return null;
 return LIFE_SCENES.find(s=>s.trigger.test(text))??null;
}
/** 本轮注入：先像平时一样回应，再用模型自己的话问出写好的问题。 */
export const lifeAskBlock=(ask:string)=>[
 '【本轮程序允许顺着生活话题轻轻追问一句】',
 '先像平时一样回应学生说的话，然后用你自己的话自然地问出下面这个问题（保持原意，口语化，一次只问这一个）：',
 `「${ask}」`,
 '学生答不上或不想答都没关系，不催。这是聊天不是测试：不说"观察""考察""考考你"这类词。taskIds必须是[]。',
].join('\n');
/** 回答轮注入：按写好的观察点判断，quote 只能逐字抄学生这一句。nextAsk 存在时同一句里问下一问。 */
export const lifeObserveBlock=(spec:LifeSceneObserve,nextAsk:string|null)=>[
 '【上一句是生活话题的追问，学生这一句多半是回答】',
 nextAsk?`先自然接住学生的回答，再用你自己的话问下一个问题（保持原意，一次只问这一个）：「${nextAsk}」`:'自然接住学生的回答，这个话题就到这里，不再追问。',
 `如果学生的回答能看出${spec.dimension}的情况，可以输出一条observation：{"dimension":"${spec.dimension}","signal":"clear|partial|confused","quote":"只能逐字抄学生这一句里的原话","note":"一句话写你看到了什么"}。`,
 `看的是：${spec.lookFor}；${spec.notEvidence}。`,
 '观察只是"待核实"，不是评分；看不出来就不输出。计算、建模、空间想象不记观察。',
].join('\n');
