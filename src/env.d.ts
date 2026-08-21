/// <reference types="vite/client" />

import type { PingAlertApi } from '@shared/types'

declare global {
  interface Window {
    pingAlert: PingAlertApi
  }
}

export {}
