import type { VaultConnection } from "@workspace/sdk/chain"
import { Router, type Response } from "express"

export type ConfigResponse = { vault: VaultConnection | null }

/**
 * Settings the web app needs: the vault it builds fund_batch for, with Person 3's
 * ShieldVaultClient. Served here so it's always the vault the API checks funding
 * against. All of it is public.
 */
export function configRouter(vault: VaultConnection | undefined): Router {
  const router = Router()

  router.get("/config", (_req, res: Response<ConfigResponse>) => {
    res.json({ vault: vault ?? null })
  })

  return router
}
