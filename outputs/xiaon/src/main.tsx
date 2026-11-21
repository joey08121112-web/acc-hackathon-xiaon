import React from "react";
import ReactDOM from "react-dom/client";
import { AuthGate } from "./auth/AuthGate";
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
    <AuthGate />
  </React.StrictMode>,
);
