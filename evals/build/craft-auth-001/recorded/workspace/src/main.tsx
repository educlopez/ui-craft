import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SignInPage from "./SignInPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SignInPage />
  </StrictMode>,
);
