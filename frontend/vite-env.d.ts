/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_TARGET?: string
  readonly VITE_ENCORE_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
