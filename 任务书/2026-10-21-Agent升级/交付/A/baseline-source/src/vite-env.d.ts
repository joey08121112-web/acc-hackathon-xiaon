/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_XY_APP_ID?: string;
  readonly VITE_XY_APP_SECRET?: string;
  readonly VITE_LLM_BASE_URL?: string;
  readonly VITE_LLM_API_KEY?: string;
  readonly VITE_LLM_MODEL?: string;
}
