/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BIOALERT_API_URL: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_SCHOOL_NIT: string;
  readonly VITE_SCHOOL_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
