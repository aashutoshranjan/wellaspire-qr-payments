import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react";
import { submitPaymentConfirmation, type SubmitResult } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";

type QrEntry = { id: string; label: string; image: string; active: boolean };

const ROTATION_MS = 3 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wellaspire Pay — Internship Enrollment" },
      {
        name: "description",
        content:
          "Complete your internship enrollment. Scan the secure UPI QR to pay the enrollment fee from your Welcome Letter, then confirm your participation with your enrollment details.",
      },
      { property: "og:title", content: "Wellaspire Pay — Internship Enrollment" },
      {
        property: "og:description",
        content:
          "Confirm your participation: pay via UPI, share your enrollment details and payment screenshot, and receive your receipt, confirmation email and login credentials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
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
          <CheckoutGrid />
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

function CheckoutGrid() {
  const [qrList, setQrList] = useState<QrListState>({ status: "loading" });

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

  const rotation = useMemo(() => {
    if (qrList.status !== "ready") return null;
    const istMs = Date.now() + IST_OFFSET_MS;
    const block = Math.floor(((((istMs / 3_600_000) % 24) + 24) % 24) / 3);
    const current = qrList.list[block % qrList.list.length];
    if (!current) return null;
    return { block, current, total: qrList.list.length };
  }, [qrList]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <section aria-label="UPI payment QR code" className="order-1">
        <EnrollmentIntro rotation={rotation} listState={qrList} />
      </section>
      <section aria-label="Enrollment confirmation" className="order-2">
        <OrderPanel rotation={rotation} />
      </section>
    </div>
  );
}

type QrListState = { status: "loading" } | { status: "error" } | { status: "ready"; list: QrEntry[] };

type RotationState = {
  block: number;
  current: QrEntry;
  total: number;
} | null;

function EnrollmentIntro({
  rotation,
  listState,
}: {
  rotation: RotationState;
  listState: QrListState;
}) {
  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Confirm Your Participation
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Complete Your Internship Enrollment
        </h1>
      </div>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        To secure your place in the internship program, kindly complete your enrollment by paying
        the one-time Internship Enrollment Fee mentioned in your{" "}
        <span className="font-semibold text-foreground">Welcome Letter</span>. Please verify the
        amount in your Welcome Letter before making the payment.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <TrustBadge
          icon={<ShieldCheck className="size-4 text-gold" />}
          title="Secure UPI"
          detail="100% Payment Protected"
        />
        <TrustBadge
          icon={<BadgeCheck className="size-4 text-gold" />}
          title="Verified Process"
          detail="Verified within 1 hour"
        />
      </div>

      <div className="relative mt-8">
        {/* Rotating halo glow */}
        <div aria-hidden className="qr-halo absolute -inset-4 rounded-[2.5rem] opacity-60" />
        <div aria-hidden className="qr-glow-soft absolute -inset-10 rounded-full" />

        <div className="relative rounded-3xl border border-gold/25 bg-card/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          <p className="text-center font-display text-sm font-semibold uppercase tracking-[0.18em] text-gold">
            Pay via UPI · Scan to Pay
          </p>

          <div className="relative mt-6">
            <div className="relative overflow-hidden rounded-2xl bg-qr-surface p-5 shadow-inner">
              {listState.status === "error" ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <AlertCircle className="size-8 text-destructive" />
                  <p className="text-sm font-medium">Couldn't load the payment QR</p>
                  <p className="text-xs text-muted-foreground">
                    Please refresh the page to try again.
                  </p>
                </div>
              ) : listState.status === "loading" || rotation === null ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Loader2 className="size-7 animate-spin text-gold" />
                  <p className="text-xs text-muted-foreground">Preparing your secure QR…</p>
                </div>
              ) : (
                <>
                  <img
                    src={rotation.current.image}
                    alt={`Internship enrollment payment QR code for ${rotation.current.label}`}
                    className="mx-auto block w-full max-w-[320px]"
                    width={320}
                    height={320}
                  />
                  {/* Scan guides */}
                  <span aria-hidden className="scan-guide left-2 top-2 border-l-2 border-t-2" />
                  <span aria-hidden className="scan-guide right-2 top-2 border-r-2 border-t-2" />
                  <span aria-hidden className="scan-guide bottom-2 left-2 border-b-2 border-l-2" />
                  <span aria-hidden className="scan-guide bottom-2 right-2 border-b-2 border-r-2" />
                </>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-center text-sm font-semibold text-foreground">
              Internship Enrollment Payment QR Code
            </p>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Scan the QR code using any UPI payment app. Works with Paytm, PhonePe, BHIM &amp; all
              UPI apps <span className="font-medium text-foreground">except Google Pay</span> — we
              do not accept payments via Google Pay.
            </p>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 shrink-0 text-gold" />
              <span>Refer to your Welcome Letter for the exact amount</span>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Note: If you pay via any UPI app, the payment receiver may appear as either our
              company name or an authorized person's name. Both are valid. Always verify the
              recipient details before confirming your payment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderPanel({ rotation }: { rotation: RotationState }) {
  type FieldKey =
    | "fullName"
    | "email"
    | "contactNumber"
    | "position"
    | "cohortDate"
    | "batchCode"
    | "screenshot";
  type FieldErrors = { [K in FieldKey]?: string };

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    contactNumber: "",
    position: "",
    cohortDate: "",
    batchCode: "",
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Extract<SubmitResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  const submitPayment = useServerFn(submitPaymentConfirmation);

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors: FieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = "Enter a valid email address";
    if (!/^[6-9]\d{9}$/.test(form.contactNumber))
      errors.contactNumber = "Enter a valid 10-digit Indian mobile number";
    if (form.position.trim().length < 2)
      errors.position = "Enter the internship position you applied for";
    if (!form.cohortDate.trim()) errors.cohortDate = "Enter your cohort date";
    if (!form.batchCode.trim()) errors.batchCode = "Enter the batch code from your Welcome Letter";
    if (screenshot && screenshot.size > MAX_SCREENSHOT_BYTES)
      errors.screenshot = "Screenshot must be under 10 MB";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      let screenshotPath: string | undefined;
      if (screenshot) {
        const ext = (screenshot.name.split(".").pop() ?? "png").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "pdf"].includes(ext) ? ext : "png";
        screenshotPath = `${crypto.randomUUID()}.${safeExt}`;
        const { error: uploadError } = await supabase.storage
          .from("enrollment-screenshots")
          .upload(screenshotPath, screenshot);
        if (uploadError) {
          setSubmitError("Your screenshot couldn't be uploaded. Please try again.");
          return;
        }
      }

      const result = await submitPayment({
        data: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          contactNumber: form.contactNumber,
          position: form.position.trim(),
          cohortDate: form.cohortDate.trim(),
          batchCode: form.batchCode.trim(),
          screenshotPath,
          qrSlot: rotation?.current.id ?? "unknown",
        },
      });
      if (result.ok) {
        setSuccess(result);
      } else {
        setSubmitError(result.error);
      }
    } catch (err) {
      if (err instanceof Error && /mobile/i.test(err.message)) {
        setFieldErrors({ contactNumber: err.message });
      } else if (err instanceof Error && /email/i.test(err.message)) {
        setFieldErrors({ email: err.message });
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
          copied={copied}
          onCopy={copyReference}
          onReset={() => {
            setSuccess(null);
            setForm({
              fullName: "",
              email: "",
              contactNumber: "",
              position: "",
              cohortDate: "",
              batchCode: "",
            });
            setScreenshot(null);
            setFieldErrors({});
          }}
        />
      ) : (
        <>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Share your enrollment details
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            After paying, fill in the details below. Sending these details with your payment
            screenshot via <span className="font-semibold text-foreground">Email and WhatsApp</span>{" "}
            is mandatory — the button below records your confirmation first.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <Field
              id="fullName"
              label="Full Name"
              error={fieldErrors.fullName}
              input={
                <TextInput
                  id="fullName"
                  placeholder="e.g. Aarav Sharma"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(v) => updateField("fullName", v)}
                />
              }
            />

            <Field
              id="email"
              label="Email ID"
              error={fieldErrors.email}
              input={
                <TextInput
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(v) => updateField("email", v)}
                />
              }
            />

            <Field
              id="contactNumber"
              label="Contact Number"
              error={fieldErrors.contactNumber}
              hint="Used only to confirm your enrollment — never shared or used for marketing."
              input={
                <div className="flex overflow-hidden rounded-xl border border-input bg-secondary/40 focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30">
                  <span className="flex items-center border-r border-input px-3 font-mono text-sm text-muted-foreground">
                    +91
                  </span>
                  <input
                    id="contactNumber"
                    name="contactNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={form.contactNumber}
                    onChange={(e) =>
                      updateField(
                        "contactNumber",
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    className="w-full bg-transparent px-4 py-3 font-mono text-base tracking-[0.08em] text-foreground placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none"
                    aria-invalid={Boolean(fieldErrors.contactNumber)}
                    aria-describedby={
                      fieldErrors.contactNumber ? "contactNumber-error" : undefined
                    }
                  />
                </div>
              }
            />

            <Field
              id="position"
              label="Internship Position Applied For"
              error={fieldErrors.position}
              input={
                <TextInput
                  id="position"
                  placeholder="e.g. Full Stack Development Intern"
                  value={form.position}
                  onChange={(v) => updateField("position", v)}
                />
              }
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="cohortDate"
                label="Cohort Date"
                error={fieldErrors.cohortDate}
                input={
                  <TextInput
                    id="cohortDate"
                    placeholder="e.g. 15 Nov 2026"
                    value={form.cohortDate}
                    onChange={(v) => updateField("cohortDate", v)}
                  />
                }
              />
              <Field
                id="batchCode"
                label="Batch Code"
                hint="Mentioned in Welcome Letter"
                error={fieldErrors.batchCode}
                input={
                  <TextInput
                    id="batchCode"
                    placeholder="e.g. WLB-2026-11"
                    value={form.batchCode}
                    onChange={(v) => updateField("batchCode", v)}
                  />
                }
              />
            </div>

            <Field
              id="screenshot"
              label="Payment Screenshot"
              error={fieldErrors.screenshot}
              hint="JPG, PNG or PDF up to 10 MB. Also send it via Email and WhatsApp after submitting."
              input={
                <label
                  htmlFor="screenshot"
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-secondary/40 px-4 py-3 transition-colors hover:border-gold/50"
                >
                  <Upload className="size-4 shrink-0 text-gold" />
                  <span className="min-w-0 truncate text-sm text-muted-foreground">
                    {screenshot ? screenshot.name : "Upload your payment screenshot"}
                  </span>
                  <input
                    id="screenshot"
                    name="screenshot"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="sr-only"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                  />
                </label>
              }
            />

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

      <ImportantNotice />
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  input,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </label>
      {input}
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function TextInput({
  id,
  placeholder,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      name={id}
      type={type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-input bg-secondary/40 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30"
      aria-invalid={undefined}
    />
  );
}

function ImportantNotice() {
  return (
    <div className="mt-8 rounded-2xl border border-gold/25 bg-secondary/50 p-5">
      <p className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.14em] text-gold">
        <AlertCircle className="size-4" />
        Important Notice — Enrollment Confirmation
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        After completing your enrollment, please share the required details and send your payment
        screenshot to our support team via{" "}
        <span className="font-semibold text-foreground">both Email and WhatsApp</span>. Once we
        receive your details, we will send your confirmation email, login credentials and the
        WhatsApp number of your dedicated mentor.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href="mailto:support@wellbridge.in"
          className="flex items-center gap-2.5 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Mail className="size-4 shrink-0 text-gold" />
          support@wellbridge.in
        </a>
        <a
          href="https://wa.me/919236642525"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <MessageCircle className="size-4 shrink-0 text-gold" />
          WhatsApp +91 92366 42525
        </a>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Note: Complete your enrollment and confirm your seat as soon as possible — limited seats
        are available. After payment you will receive a Payment Receipt, Confirmation Email and
        Login Credentials to start your internship. Please ensure all information is accurate and
        your payment screenshot is clearly visible to avoid delays.
      </p>
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
  copied,
  onCopy,
  onReset,
}: {
  result: Extract<SubmitResult, { ok: true }>;
  copied: boolean;
  onCopy: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-gold/15 ring-8 ring-gold/5">
        <CheckCircle2 className="size-9 text-gold" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-bold">Enrollment details received</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Now send these details with your payment screenshot to{" "}
        <span className="font-semibold text-foreground">support@wellbridge.in</span> and WhatsApp{" "}
        <span className="font-semibold text-foreground">+91 92366 42525</span> — sending via both is
        mandatory. You'll then receive your Payment Receipt, Confirmation Email and Login
        Credentials.
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
        Submit another enrollment
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
      <p className="flex items-center gap-2">
        <FileText className="size-3.5" />
        For any queries, write to us at support@wellbridge.in
      </p>
      <p>© 2026 Wellaspire Technologies · Wellaspire Pay</p>
    </footer>
  );
}
