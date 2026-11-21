/** 根级错误边界。
 *
 * 没有边界时，渲染出错会让整页变成白屏 —— 孩子看到的是「坏了」，家长看到的是「这软件不能用」。
 * 有了边界，出错时显示一句能懂的话 + 两个能用的动作（再试一次 / 回到首页），
 * 已有数据不受影响（数据在服务端 SQLite 和本地存储里，不在 React 树里）。
 *
 * 这是根级兜底：具体功能区的错误由各自的界面负责说清楚上下文，这里只保证「不会白屏」。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { describeError } from '../errors';
import { isDevMode } from '../agents/devMode';

type Props={children:ReactNode};
type State={error:unknown};

export class ErrorBoundary extends Component<Props,State>{
 state:State={error:null};

 static getDerivedStateFromError(error:unknown):State{
  return {error};
 }

 componentDidCatch(error:unknown,info:ErrorInfo){
  // 记在控制台里，方便开发时定位；不往服务器发 —— 没有遥测端点，也不要为了「收集数据」新建一个。
  console.error('[ui/error-boundary]',error,info.componentStack);
 }

 private retry=()=>this.setState({error:null});
 private goHome=()=>{window.location.href='/';};

 render(){
  const {error}=this.state;
  if(!error)return this.props.children;
  const view=describeError(error,{dev:isDevMode()});
  return (
   <div className="error-boundary" role="alert">
    <h1>出了点小状况</h1>
    <p className="error-boundary-message">{view.message}</p>
    {view.detail&&<pre className="error-boundary-detail">{view.detail}</pre>}
    <div className="error-boundary-actions">
     {view.retryable&&<button className="primary" onClick={this.retry}>再试一次</button>}
     <button className="secondary" onClick={this.goHome}>回到首页</button>
    </div>
   </div>
  );
 }
}
