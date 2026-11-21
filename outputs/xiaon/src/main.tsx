import React from "react";
import ReactDOM from "react-dom/client";
import { AuthGate } from "./auth/AuthGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./style.css";
// G0 首页改版: one stylesheet per owner (home → ChatGPT, problem → zCode, progress → Claude).
import "./styles/home.css";
import "./styles/problem.css";
import "./styles/progress.css";
import "./styles/guardian.css";
import "./components/game/StarbrookGame.css";
import "./components/game/LogicBridgeGame.css";
import "./components/game/CalcWorkshopGame.css";
import "./components/game/MarketModelGame.css";
import "./components/game/SpatialHillGame.css";
import "./styles/polish.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 根级兜底：渲染出错时给一句能懂的话和能按的按钮，而不是白屏。 */}
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  </React.StrictMode>,
);
