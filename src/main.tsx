import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { TermProvider } from "./context/TermContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TermProvider>
        <App />
      </TermProvider>
    </BrowserRouter>
  </React.StrictMode>
);
