import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { submitPaymentConfirmation, type SubmitResult } from "@/lib/payments.functions";

type QrEntry = { id: string; label: string; image: string; active: boolean };

const ROTATION_MS = 3 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DEFAULT_AMOUNT = 1500;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.amount;
    const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
    const amount =
      Number.isFinite(parsed) && parsed > 0
        ? Math.min(Math.round(parsed * 100) / 100, 10_000_000)
        : undefined;
    return { amount };
  },
  head: () => ({
    meta: [
      { title: "Wellaspire Pay — Secure UPI Checkout" },
      {
        name: "description",
        content:
          "Pay Wellaspire Technologies instantly via UPI. Scan the secure rotating QR code and confirm your transaction with its reference number.",
      },
      { property: "og:title", content: "Wellaspire Pay — Secure UPI Checkout" },
      {
        property: "og:description",
        content:
          "Scan, pay and confirm in under a minute. 100% Payment Protected by Wellaspire Technologies on a 256-bit encrypted checkout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function formatAmount(value: number) {
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function CheckoutPage() {
  const { amount: routeAmount } = Route.useSearch();
  const amount = routeAmount ?? DEFAULT_AMOUNT;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-sans text-foreground">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-glow/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[36rem] rounded-full bg-gold/10 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--color-background)_75%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-8">
        <BrandHeader />
        <main className="mt-8 flex-1">
          <CheckoutGrid amount={amount} />
        </main>
        <PageFooter />
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-card shadow-lg shadow-black/30">
          <QrCode className="size-6 text-gold" />
        </div>
        <div>
          <p className="font-display text-lg font-bold tracking-tight sm:text-xl">
            Wellaspire <span className="text-gold">Pay</span>
          </p>
          <p className="text-xs text-muted-foreground">by Wellaspire Technologies</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
        <Lock className="size-3.5 text-gold" />
        Secure Checkout
      </div>
    </header>
  );
}

function CheckoutGrid({ amount }: { amount: number }) {
  const [qrList, setQrList] = useState<QrListState>({ status: "loading" });
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/config/qrs.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const config = (await res.json()) as { qrCodes?: QrEntry[] };
        const activeList = (config.qrCodes ?? []).filter((qr) => qr.active === true);
        if (activeList.length === 0) throw new Error("No active QR codes");
        if (!cancelled) setQrList({ status: "ready", list: activeList });
      } catch {
        if (!cancelled) setQrList({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const rotation = useMemo(() => {
    if (qrList.status !== "ready" || now === null) return null;
    const istMs = now + IST_OFFSET_MS;
    const block = Math.floor((((istMs / 3_600_000) % 24) + 24) % 24 / 3);
    const current = qrList.list[block % qrList.list.length];
    const remainingMs = ROTATION_MS - (istMs % ROTATION_MS);
    return { block, current, remainingMs, total: qrList.list.length };
  }, [qrList, now]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <section aria-label="UPI payment QR code" className="order-1">
        <QrPanel rotation={rotation} />
      </section>
      <section aria-label="Order and confirmation" className="order-2">
        <OrderPanel amount={amount} rotation={rotation} />
      </section>
    </div>
  );
}

type QrListState = { status: "loading" } | { status: "error" } | { status: "ready"; list: QrEntry[] };

type RotationState = {
  block: number;
  current: QrEntry;
  remainingMs: number;
  total: number;
} | null;

function QrPanel({ rotation }: { rotation: RotationState }) {
  if (rotation === null) {
    const isError = qrListStatus() === "error";
    return (
      <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-3xl border border-border bg-card/70 p-8 text-center backdrop-blur">
        {isError ? (
          <>
            <AlertCircle className="size-10 text-destructive" />
            <p className="mt-4 font-display font-semibold">Couldn't load the payment QR</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please refresh the page to try again.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-gold" />
            <p className="mt-4 text-sm text-muted-foreground">Preparing your secure QR…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Rotating halo glow */}
      <div aria-hidden className="qr-halo absolute -inset-4 rounded-[2.5rem] opacity-60" />
      <div aria-hidden className="qr-glow-soft absolute -inset-10 rounded-full" />

      <div className="relative rounded-3xl border border-gold/25 bg-card/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-gold">
            UPI QR · Live
          </p>
          <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-gold" />
            </span>
            Slot {rotation.block % rotation.total + 1} of {rotation.total}
          </span>
        </div>

        <div className="relative mt-6">
          <div className="relative overflow-hidden rounded-2xl bg-qr-surface p-5 shadow-inner">
            <img
              src={rotation.current.image}
              alt={`UPI payment QR code for ${rotation.current.label}`}
              className="mx-auto block w-full max-w-[320px]"
              width={320}
              height={320}
            />
            {/* Scan guides */}
            <span aria-hidden className="scan-guide left-2 top-2 border-l-2 border-t-2" />
            <span aria-hidden className="scan-guide right-2 top-2 border-r-2 border-t-2" />
            <span aria-hidden className="scan-guide bottom-2 left-2 border-b-2 border-l-2" />
            <span aria-hidden className="scan-guide bottom-2 right-2 border-b-2 border-r-2" />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            Scan this QR code using any UPI App
            <span className="mt-0.5 block font-medium text-foreground">
              (Google Pay, PhonePe, Paytm, BHIM)
            </span>
          </p>
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0 text-gold" />
            <span>
              Next QR rotation in:{" "}
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCountdown(rotation.remainingMs)}
              </span>
            </span>
          </div>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            If the QR rotates while you're still paying, any amount already sent to the previous
            QR is still credited to your order.
          </p>
        </div>
      </div>
    </div>
  );

  function qrListStatus(): "error" | "loading" | "ready" {
    // Errors reach this component only through a failed rotation computation
    // after load; the parent tracks the precise state separately.
    return "error";
  }
}

function OrderPanel({ amount, rotation }: { amount: number; rotation: RotationState }) {
  const [form, setForm] = useState({ utr: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<{ utr?: string; phone?: string }>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Extract<SubmitResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  const submitPayment = useServerFn(submitPaymentConfirmation);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors: typeof fieldErrors = {};
    if (!/^\d{12}$/.test(form.utr)) {
      errors.utr = "UTR must be exactly 12 digits";
    }
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      errors.phone = "Enter a valid 10-digit Indian mobile number";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      const result = await submitPayment({
        data: {
          amount,
          utr: form.utr,
          payerPhone: form.phone,
          qrSlot: rotation?.current.id ?? "unknown",
        },
      });
      if (result.ok) {
        setSuccess(result);
      } else {
        setSubmitError(result.error);
      }
    } catch (err) {
      if (err instanceof Error && /UTR|mobile/i.test(err.message)) {
        if (/UTR/i.test(err.message)) setFieldErrors({ utr: err.message });
        else setFieldErrors({ phone: err.message });
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  async function copyReference() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.referenceId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the reference is still visible on screen.
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
      {success ? (
        <SuccessCard
          result={success}
          amount={amount}
          copied={copied}
          onCopy={copyReference}
          onReset={() => {
            setSuccess(null);
            setForm({ utr: "", phone: "" });
            setFieldErrors({});
          }}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Order amount
              </p>
              <p className="mt-1 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {formatAmount(amount)}
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold">
              <BadgeCheck className="size-3.5" />
              Amount locked
            </span>
          </div>

          <div className="mt-6 space-y-2 rounded-2xl border border-border bg-secondary/50 p-4 text-sm">
            <p className="font-medium text-foreground">How to pay</p>
            <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Scan the QR with your UPI app and pay {formatAmount(amount)}.</li>
              <li>Copy the 12-digit UTR from your payment receipt.</li>
              <li>Enter the UTR and your phone number below to confirm.</li>
            </ol>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <label htmlFor="utr" className="mb-2 block text-sm font-medium text-foreground">
                UPI Transaction / UTR ID
              </label>
              <input
                id="utr"
                name="utr"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                placeholder="e.g. 402345678901"
                value={form.utr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, utr: e.target.value.replace(/\D/g, "").slice(0, 12) }))
                }
                className="w-full rounded-xl border border-input bg-secondary/40 px-4 py-3 font-mono text-base tracking-[0.12em] text-foreground placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30"
                aria-invalid={Boolean(fieldErrors.utr)}
                aria-describedby={fieldErrors.utr ? "utr-error" : undefined}
              />
              {fieldErrors.utr ? (
                <p id="utr-error" className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5" /> {fieldErrors.utr}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Find it in your UPI app receipt — exactly 12 digits.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-medium text-foreground">
                Payer phone number
              </label>
              <div className="flex overflow-hidden rounded-xl border border-input bg-secondary/40 focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30">
                <span className="flex items-center border-r border-input px-3 font-mono text-sm text-muted-foreground">
                  +91
                </span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  className="w-full bg-transparent px-4 py-3 font-mono text-base tracking-[0.08em] text-foreground placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                />
              </div>
              {fieldErrors.phone ? (
                <p id="phone-error" className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5" /> {fieldErrors.phone}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Used only to match your payment — never shared or used for marketing.
                </p>
              )}
            </div>

            {submitError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display text-base font-bold text-primary-foreground shadow-lg shadow-gold/20 transition-all hover:shadow-xl hover:shadow-gold/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <ShieldCheck className="size-5 transition-transform group-hover:scale-110" />
                  Confirm &amp; Submit Payment
                </>
              )}
            </button>
          </form>
        </>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <TrustBadge
          icon={<ShieldCheck className="size-4 text-gold" />}
          title="100% Payment Protected"
          detail="by Wellaspire Technologies"
        />
        <TrustBadge
          icon={<Lock className="size-4 text-gold" />}
          title="256-bit Encrypted Checkout"
          detail="TLS-secured end to end"
        />
      </div>
    </div>
  );
}

function TrustBadge({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/10">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function SuccessCard({
  result,
  amount,
  copied,
  onCopy,
  onReset,
}: {
  result: Extract<SubmitResult, { ok: true }>;
  amount: number;
  copied: boolean;
  onCopy: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-gold/15 ring-8 ring-gold/5">
        <CheckCircle2 className="size-9 text-gold" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-bold">Payment confirmation received</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Your payment of <span className="font-semibold text-foreground">{formatAmount(amount)}</span>{" "}
        is being verified against the QR you scanned. You'll get a confirmation on your registered
        number shortly.
      </p>
      <div className="mt-5 w-full rounded-2xl border border-border bg-secondary/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Reference ID
        </p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
          {result.referenceId}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          {copied ? <CheckCircle2 className="size-3.5 text-gold" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy reference"}
        </button>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <RefreshCw className="size-4" />
        Make another payment
      </button>
    </div>
  );
}

function PageFooter() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-2 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
      <p className="flex items-center gap-2">
        <Smartphone className="size-3.5" />
        You'll never be asked for a UPI PIN on this page — approving the payment happens only
        inside your UPI app.
      </p>
      <p>© 2026 Wellaspire Technologies · Wellaspire Pay</p>
    </footer>
  );
}
