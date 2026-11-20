/** 所有者：zCode。星溪镇小游戏（队友的 Godot 作品）入口：挂在专业模式地图下方。
 * 独立于五维测评契约：不写 interviews、不进报告，只是把 /starbrook/ 的静态 Web 导出嵌进全屏播放器。
 * 章节完成时游戏 postMessage('starbrook-eval') 过来：全文评价显示在播放器底部，
 * 60 字摘要经 free-chat/profile/item 记入「我的档案 · 近况」（kind:'recent'，14 天过期，不影响测评）。
 * 文件未部署时入口给说明，不影响测评流程；pushState 让系统返回手势先关游戏再退页面。 */
import { useEffect, useRef, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { apiRequest } from '../../agent-client';
import './StarbrookGame.css';

const GAME_INDEX = '/starbrook/index.html';
type DeployState = 'unknown' | 'checking' | 'ready' | 'missing';
/** 游戏章节完成时 postMessage 过来的数据（main.gd post_to_host）：只取展示与摘要要用的字段。 */
type StarbrookEval = { achievements: string[]; assessment: string; record: { weight_attempts: { correct: boolean }[] } };

export function StarbrookGame() {
  const [deploy, setDeploy] = useState<DeployState>('unknown'), [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false), [report, setReport] = useState<StarbrookEval | null>(null), [saved, setSaved] = useState<'saving' | 'saved' | 'error'>('saving');
  const pushed = useRef(false);
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  useEffect(() => {
    const onPop = () => { if (pushed.current) { pushed.current = false; setOpen(false); } };
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('popstate', onPop); document.body.style.overflow = ''; };
  }, []);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  // 游戏在 iframe 里跑，章节完成时把整段评价 postMessage 给本页（同源，校验 origin 防别的页面伪造）。
  // 按组件头的定位：结果只进「我的档案」的近况（60 字摘要，shared/free-chat.ts ITEM_TEXT_MAX），不写测评。
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data.type !== 'string') return;
      if (e.data.type === 'starbrook-loaded') { setLoaded(true); return; }
      if (e.data.type !== 'starbrook-eval') return;
      const d = e.data as StarbrookEval;
      setReport(d); setSaved('saving');
      const tries = Array.isArray(d.record?.weight_attempts) ? d.record.weight_attempts.length : 0;
      const text = `星溪镇通关：${(d.achievements ?? []).join('、') || '完成章节'}${tries > 1 ? `；配重试了${tries}次` : '；配重一次配平'}`.slice(0, 60);
      try { await apiRequest('free-chat/profile/item', { action: 'add', kind: 'recent', text }); setSaved('saved'); }
      catch { setSaved('error'); }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  async function enter() {
    if (deploy !== 'ready') {
      setDeploy('checking');
      try {
        // 不能只看状态码：开发服务器的 SPA 回退会给任何地址回 200 的应用壳，必须看内容里有没有 Godot 导出特征。
        const r = await fetch(GAME_INDEX, { cache: 'no-store' });
        const body = r.ok ? await r.text() : '';
        if (!/godot|\.wasm/i.test(body)) { setDeploy('missing'); return; }
        setDeploy('ready');
      } catch { setDeploy('missing'); return; }
    }
    // 每次打开都压一条自己的历史（刷新会留下带 starbrook 标记的旧条目，不能靠它判断）：
    // App 的 popstate 见到没有 page 的 state 会直接返回，页面停在原地，返回手势就只用来关游戏。
    window.history.pushState({ ...window.history.state, page: undefined, starbrook: true }, '', '#starbrook');
    pushed.current = true;
    setOpen(true);
  }
  function close() { if (pushed.current) window.history.back(); else setOpen(false); }
  return <>
    {open && <div className="starbrook-overlay" role="dialog" aria-label="星溪镇小游戏">
      <div className="starbrook-bar">
        <button className="text-button starbrook-back" onClick={close}>← 回到专业模式</button>
        <strong>星溪镇：钟声响起之前</strong>
        <span className="starbrook-hint">{loaded ? (coarse ? '已加载 · 建议横屏玩：点住左下 ◀ ▶ 走动，右下按钮互动' : '游戏已加载，点一下画面即可用键盘操作') : '第一次加载约几十 MB，黑屏是在下载，请稍等'}</span>
      </div>
      <iframe src={GAME_INDEX} title="星溪镇：钟声响起之前" allow="autoplay; fullscreen" />
      {report && <div className="starbrook-report" role="status">
        <strong>本章完成 · 旅程回顾</strong>
        <p className="small">{saved === 'saving' ? '正在把探索摘要记入你的档案…' : saved === 'saved' ? '探索摘要已记入「成长 · 我的档案」，完整评价也可以在游戏右上角随时重看。' : '档案记录失败；完整评价仍在游戏里，点右上角「查看本章评价」可以重看。'}</p>
        <div className="starbrook-report-text">{report.assessment}</div>
      </div>}
    </div>}
    <section className="starbrook-card" aria-label="星溪镇小游戏">
      <div className="starbrook-head">
        <span className="starbrook-icon"><Gamepad2 size={22} /></span>
        <div>
          <h3>星溪镇：钟声响起之前</h3>
          <p>队友做的小游戏：在小镇里走一走，找箱子、给钟楼调配重、读窗边的信，结尾会按这次的做法给一段小评价。玩它不算测评，也不点亮上面的地图。</p>
        </div>
      </div>
      <div className="starbrook-actions">
        <button className="primary" disabled={deploy === 'checking'} onClick={() => void enter()}>{deploy === 'checking' ? '正在查看游戏文件…' : '进入星溪镇'}</button>
        <span className="small">{coarse ? '这版游戏用键盘玩（A/D 走动、E 交互、J 日志、Esc 关闭）；手机上建议接键盘，触屏版还要等队友适配。' : '键盘操作：A/D 或方向键走动、Shift 快走、E 交互、J 日志、Esc 关闭面板。'}</span>
      </div>
      {deploy === 'missing' && <p className="notice" role="status">游戏的网页版还没放到本站：现在拿到的是 Windows 版，浏览器跑不了。需要队友从 Godot 工程导出 Web 版（要内置中文字体，否则文字会变方块）放进 public/starbrook/，放好后这里自动变成可玩入口。<button className="text-button" onClick={() => void enter()}>再试一次</button></p>}
      {report && !open && <p className="small" style={{ marginTop: 8 }}>上次探索已完成，摘要在「成长 · 我的档案」的近况里。</p>}
    </section>
  </>;
}
