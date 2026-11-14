# Patela

**Get paid at the handoff, not 90 days later.**

## The problem

Picture a truck driver like Sipho. *(Sipho is an example.)* He loads 30 tonnes of maize at a
farm in the Free State and drives it to a mill in Gauteng. He hands it over at the gate and drives
home. His company won't see that money for two or three months, so for now it is paying for the
fuel, the tolls and Sipho's salary itself.

Across South African freight, 60- to 90-day payment terms are normal. *[VERIFY: industry source]*

## Why is it still like this?

There are two reasons.

1. **Nobody can prove who had the goods.** Cargo passes from the supplier to a driver to a
   warehouse to the buyer. Each handoff is a signature on paper, so every invoice can be disputed.
2. **Paying up front is a risk for the buyer.** If the goods never arrive, the money is gone.
   So the buyer waits, and the carrier ends up funding the trip.

## The insight

Payment isn't slow because it's hard to send money. It's slow because the proof turns up last.
**If the proof is created at the handoff, the money can move at the handoff too.**

## What Patela does

- **The buyer locks the money first.** It goes into escrow in ZARm, a stablecoin worth one rand.
  The supplier can see it's there, and the buyer isn't exposed.
- **Both sides sign every handoff.** The person handing over shows a QR code and the person
  receiving scans it. Each signs with a wallet created from their email address, so there's no
  app to install, no seed phrase and no gas to pay.
- **That handoff's share is paid out straight away.** At pickup the driver gets 10% and the
  supplier 40%. At delivery the supplier gets the remaining 50%. The split is fixed when the order
  is made, and the smart contract won't accept one that doesn't add up to the total.

**What it proves:** that two named parties confirmed a handover at a given time and place.
**What it doesn't prove:** the condition of the goods. Patela says so in the app.

## How it scales

Each new route is just more handoffs. There's no new integration and no new hardware: a driver
needs only a phone browser and an email address. Suppliers invite their drivers, so every order
brings the next users with it.

## Status

This is a working **demo**. Escrow runs on Celo, or on a local Hardhat chain for development. The
Lambda backend sends branded email invites with ZARm invoices. Everything simulated is labelled
*Demo* in the app.

## Run it

```bash
npm run demo:install   # once
npm run demo           # buyer → supplier → driver flow on a local chain
```

For the personas, the step-by-step walkthrough and how to switch on real services, see
[docs/demo-guide.md](docs/demo-guide.md).

**Stack:** Next.js · Fastify on AWS Lambda · Solidity on Celo · Postgres

---

Sipho shouldn't have to wait three months for work he finished today. With Patela, the moment he
hands over the load is the moment he's paid.
