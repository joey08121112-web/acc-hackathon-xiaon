import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
// G0 首页改版: one stylesheet per owner (home → ChatGPT, problem → zCode, progress → Claude).
import "./styles/home.css";
import "./styles/problem.css";
import "./styles/progress.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
