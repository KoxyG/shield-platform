import {
  ArrowRightIcon,
  EyeSlashIcon,
  FingerprintIcon,
  LockKeyIcon,
  ScalesIcon,
} from "@phosphor-icons/react"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Link } from "react-router"

export function meta() {
  return [
    { title: "ShieldZK · Confidential disbursements on Stellar" },
    {
      name: "description",
      content:
        "A privacy module for the Stellar Disbursement Platform: private amounts, provable totals.",
    },
  ]
}

const GUARANTEES = [
  {
    icon: EyeSlashIcon,
    title: "Amounts stay private",
    body: "Each allocation is sealed in a commitment with its own secret. A batch shows its total, never who gets what.",
    kind: "Private",
  },
  {
    icon: LockKeyIcon,
    title: "No link to the disburser",
    body: "Payouts come from a shared vault, and recipients prove that an allocation is theirs without revealing which one.",
    kind: "Private",
  },
  {
    icon: ScalesIcon,
    title: "Totals add up",
    body: "A zero-knowledge proof shows that the hidden amounts sum to the deposit, each within range. The vault checks it before it accepts the funds.",
    kind: "Provable",
  },
  {
    icon: FingerprintIcon,
    title: "Each allocation is claimed once",
    body: "Every claim publishes a nullifier, and the vault rejects a second claim of the same allocation.",
    kind: "Provable",
  },
]

const STEPS = [
  {
    title: "Create",
    body: "Add recipients and amounts. Each allocation gets a secret and a Poseidon commitment, and the commitments form the batch's Merkle tree.",
  },
  {
    title: "Prove",
    body: "A Groth16 proof shows that the committed amounts add up to the batch total, each one in range.",
  },
  {
    title: "Fund",
    body: "The disburser deposits the total into the ShieldVault contract on Soroban, which verifies the proof first.",
  },
  {
    title: "Claim",
    body: "Each recipient proves they own an allocation and withdraws it, once, without revealing which one is theirs.",
  },
]

const STACK = [
  "Groth16 over BN254",
  "Poseidon commitments",
  "Soroban smart contracts",
  "Stellar Disbursement Platform",
]

// Leaves of the depth-3 batch in shield-contracts' circuits/test-vectors/batch.json
const COMMITMENTS = ["0x0e67…e12b", "0x1d29…4ca8", "0x095b…c2d4"]

const pill = "h-12 rounded-full px-6 text-headline"

export default function Home() {
  return (
    // data-smooth-scroll: "How it works" scrolls smoothly (see globals.css)
    <main data-smooth-scroll>
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-accent),transparent_60%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:py-28">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="secondary">
              For the Stellar Disbursement Platform
            </Badge>
            <h1 className="font-heading text-display-3 font-medium tracking-tight md:text-display-1">
              Private payouts.
              <br />
              Provable totals.
            </h1>
            <p className="max-w-xl text-headline text-muted-foreground">
              ShieldZK is a privacy module for the Stellar Disbursement
              Platform. It hides what each recipient gets and who pays whom,
              while anyone can verify that a batch adds up.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/batches/new"
                className={cn(buttonVariants({ size: "lg" }), pill)}
              >
                Create a batch
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
              <Link
                to="/batches"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  pill
                )}
              >
                View batches
              </Link>
            </div>
            <p className="text-caption text-muted-foreground">
              Prototype on Stellar testnet. Not production-grade.
            </p>
          </div>
          <BatchPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-title-1 font-semibold tracking-tight">
            What stays private, and what stays provable
          </h2>
          <p className="mt-3 text-headline text-muted-foreground">
            Disbursements on a public ledger expose every amount and every
            recipient. ShieldZK keeps those private and still lets anyone check
            the totals.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {GUARANTEES.map(({ icon: Icon, title, body, kind }) => (
            <Card key={title}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Icon className="size-5" />
                  </span>
                  <Badge variant={kind === "Private" ? "secondary" : "outline"}>
                    {kind}
                  </Badge>
                </div>
                <h3 className="text-headline font-semibold">{title}</h3>
                <p className="text-label text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-caption text-muted-foreground">
          A claim is paid as a regular token transfer from the vault, so each
          payout's amount and destination are visible once it's withdrawn.
        </p>
      </section>

      <section id="how-it-works" className="scroll-mt-16 border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-title-1 font-semibold tracking-tight">
            How it works
          </h2>
          <p className="mt-3 text-headline text-muted-foreground">
            From a list of recipients to private claims, in four steps.
          </p>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-label font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="text-headline font-semibold">{step.title}</h3>
                <p className="text-label text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-caption text-muted-foreground">
              Built with
            </span>
            {STACK.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-20">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-primary px-8 py-12 text-primary-foreground md:flex-row md:items-center md:justify-between md:px-12">
          <div>
            <h2 className="text-title-1 font-semibold tracking-tight">
              Run a confidential batch
            </h2>
            <p className="mt-2 text-headline text-primary-foreground/80">
              Create it, prove it, and fund it from your wallet.
            </p>
          </div>
          <Link
            to="/batches/new"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              pill
            )}
          >
            Create a batch
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
      </section>
    </main>
  )
}

/** An illustration of what a batch looks like from the outside. */
function BatchPreview() {
  return (
    <Card className="shadow-elevation-2">
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-caption text-muted-foreground">Batch</p>
            <p className="text-headline font-semibold">October stipends</p>
          </div>
          <Badge>Funded</Badge>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <p className="text-caption text-muted-foreground">
            Total, public and proven
          </p>
          <p className="text-title-1 font-semibold tabular-nums">
            100{" "}
            <span className="text-label font-normal text-muted-foreground">
              tokens
            </span>
          </p>
        </div>
        <ul className="flex flex-col divide-y">
          {COMMITMENTS.map((commitment, i) => (
            <li
              key={commitment}
              className="flex items-center justify-between py-3"
            >
              <span className="flex items-center gap-2 text-label">
                <LockKeyIcon className="size-4 text-muted-foreground" />
                Recipient {i + 1}
              </span>
              <span className="font-mono text-caption text-muted-foreground">
                {commitment}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-muted-foreground">
          Only the commitments and the total are public.
        </p>
      </CardContent>
    </Card>
  )
}
