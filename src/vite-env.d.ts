/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full URL of the Cloudflare Worker's /explain endpoint. Unset = AI explanations off (template summary only). */
  readonly VITE_EXPLAIN_URL?: string
}
