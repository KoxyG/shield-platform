export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-caption text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          ShieldZK: confidential disbursements for the Stellar Disbursement
          Platform.
        </p>
        <p>Prototype on Stellar testnet. Not production-grade.</p>
      </div>
    </footer>
  )
}
