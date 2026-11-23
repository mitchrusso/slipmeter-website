# AppSumo Redemption

The dedicated activation page is served at `/appsumo/`. It creates or updates a
SlipMeter Network workspace, claims one to ten AppSumo codes, displays the
confirmed lifetime tier, and prepares the current secure Mac installer.

## Backend Contract

`POST https://network.slipmeter.app/api/appsumo/redeem` accepts the owner name,
organization name, email, password, and an array of AppSumo codes. The Network
worker atomically creates or updates the owner account, claims every new code,
stores the lifetime entitlement, and sends the standard Network email-verification
link. Existing owners may stack codes by entering their current account password.

Tier thresholds are 1/3/6/10 codes for 1/5/15/30 named users and 2/10/30/60
Macs. Intermediate code counts retain the preceding tier. Each named user may
connect two Macs. AppSumo entitlements include lifetime Network access.

The page never stores passwords, codes, session tokens, or email-verification
credentials. Installer delivery uses the existing short-lived
`POST https://network.slipmeter.app/api/download/register` flow.

## Deployment And Verification

1. Apply the Network D1 migrations.
2. Seed the hashed AppSumo code inventory.
3. Deploy the Network worker and verify CORS from `https://slipmeter.app`.
4. Deploy this static site.
5. Run the automated tests and a full QA redemption using a code deliberately
   excluded from the AppSumo inventory offered for sale.

`npm test` runs static validation plus focused parsing, request, UI-state,
failure, and installer-link tests. This repository has no build step.
