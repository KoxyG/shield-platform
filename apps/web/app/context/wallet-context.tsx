import React, { createContext, useContext, useState, useEffect } from "react"
import freighterPkg from "@stellar/freighter-api"


const freighter: any = (freighterPkg as any)?.default || freighterPkg
const freighterIsConnected = freighter?.isConnected
const freighterRequestAccess = freighter?.requestAccess
const freighterGetAddress = freighter?.getAddress
const getNetworkDetails = freighter?.getNetworkDetails
const freighterSignTx = freighter?.signTransaction

interface WalletContextType {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  hasFreighter: boolean | null
  network: string | null
  error: string | null
  connect: () => Promise<string | null>
  disconnect: () => void
  signTx: (xdr: string) => Promise<string>
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  hasFreighter: null,
  network: null,
  error: null,
  connect: async () => null,
  disconnect: () => {},
  signTx: async () => "",
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    let isMounted = true

    async function initWallet() {
      try {
        const connRes = await freighterIsConnected()
        if (!isMounted) return

        if (connRes && connRes.isConnected) {
          setHasFreighter(true)
          // Check if previously authorized
          const storedAddr = localStorage.getItem("shield_stellar_wallet")
          if (storedAddr) {
            const addrRes = await freighterGetAddress()
            if (addrRes && addrRes.address && !addrRes.error) {
              setAddress(addrRes.address)
            } else {
              localStorage.removeItem("shield_stellar_wallet")
            }
          }
          try {
            const net = await getNetworkDetails()
            if (net && net.network) setNetwork(net.network)
          } catch {}
        } else {
          setHasFreighter(false)
        }
      } catch (err) {
        if (isMounted) setHasFreighter(false)
      }
    }

    initWallet()
    return () => {
      isMounted = false
    }
  }, [])

  async function connect(): Promise<string | null> {
    setError(null)
    setIsConnecting(true)
    try {
      const conn = await freighterIsConnected()
      if (!conn || !conn.isConnected) {
        setHasFreighter(false)
        setError("Freighter wallet extension not found. Please install Freighter from freighter.app.")
        setIsConnecting(false)
        return null
      }

      setHasFreighter(true)
      const accessRes = await freighterRequestAccess()
      if (accessRes.error) {
        throw new Error(
          typeof accessRes.error === "string"
            ? accessRes.error
            : accessRes.error?.message || "User rejected wallet connection"
        )
      }

      if (accessRes.address) {
        setAddress(accessRes.address)
        localStorage.setItem("shield_stellar_wallet", accessRes.address)
        try {
          const net = await getNetworkDetails()
          if (net && net.network) setNetwork(net.network)
        } catch {}
        return accessRes.address
      }
      return null
    } catch (err: any) {
      console.error("Wallet connection error:", err)
      const msg = err?.message || "Failed to connect Stellar wallet"
      setError(msg)
      return null
    } finally {
      setIsConnecting(false)
    }
  }

  function disconnect() {
    setAddress(null)
    localStorage.removeItem("shield_stellar_wallet")
  }

  async function signTx(xdr: string): Promise<string> {
    const res = await freighterSignTx(xdr, {
      networkPassphrase: "Test SDF Network ; September 2015",
    })
    if (typeof res === "string") return res
    if (res.signedTxXdr) return res.signedTxXdr
    if (res.error) throw new Error(res.error.message || "Signing failed")
    throw new Error("Failed to sign transaction")
  }

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        hasFreighter,
        network,
        error,
        connect,
        disconnect,
        signTx,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
