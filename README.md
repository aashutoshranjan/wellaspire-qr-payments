# Wellaspire Qr Payments

Build a premium, high-converting payment checkout page for "Wellaspire Technologies" (Wellaspire Pay).

Theme & Aesthetic:

- Clean luxury FinTech theme (deep navy/slate dark mode or elegant clean white with subtle glassmorphic accents).

- High-trust badges: "100% Payment Protected by Wellaspire Technologies", "256-bit Encrypted Checkout".

Core QR-Only Rotation Logic:

1. On mount, fetch `/config/qrs.json`.

2. Filter the list to only include items where `active === true`.

3. Rotate strictly by time (every 3 hours 24/7):

   - Calculate active index using Indian Standard Time (UTC + 5:30):

     const block = Math.floor(istHours / 3);

     const currentQR = activeList[block % activeList.length];

4. Render the current QR image (`currentQR.image`) in a sleek, high-visibility card with a subtle glowing border and scan guides.

5. Display a live countdown timer: "Next QR rotation in: [HH:MM:SS]".

Page Controls & Actions:

- Display Order Amount (e.g. ₹1,500, or dynamic if ?amount= query param is in URL).

- Instruction text: "Scan this QR code using any UPI App (Google Pay, PhonePe, Paytm, BHIM)".

- UTR / Reference confirmation form:

  - Input: 12-digit UPI Transaction / UTR ID.

  - Input: Payer Phone number.

  - Button: "Confirm & Submit Payment".

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wellaspire-qr-payments.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f2fdb90b-da2c-4ad0-9d91-b6a2c2f760e3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
