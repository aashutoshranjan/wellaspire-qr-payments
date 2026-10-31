import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const submissionSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  utr: z.string().regex(/^\d{12}$/, "UTR must be exactly 12 digits"),
  payerPhone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  qrSlot: z.string().min(1).max(100),
});

export type SubmitResult =
  | { ok: true; referenceId: string }
  | { ok: false; error: string };

export const submitPaymentConfirmation = createServerFn({ method: "POST" })
  .inputValidator((input) => submissionSchema.parse(input))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) {
      return { ok: false, error: "Payment service is not configured. Please try again later." };
    }

    const supabasePublic = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      // Opaque sb_ keys are not JWTs: send only apikey, no Authorization bearer.
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    // The id is created here so the insert needs no RETURNING/SELECT
    // (the table grants anon INSERT only, never SELECT).
    const id = crypto.randomUUID();

    const { error } = await supabasePublic.from("payment_submissions").insert({
      id,
      amount_inr: data.amount,
      utr: data.utr,
      payer_phone: data.payerPhone,
      qr_slot: data.qrSlot,
    });

    if (error) {
      console.error("payment_submissions insert failed:", error.message);
      return { ok: false, error: "We couldn't record your confirmation. Please try again." };
    }

    return { ok: true, referenceId: id };
  });
