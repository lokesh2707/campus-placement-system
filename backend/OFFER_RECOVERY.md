# Offer operation recovery

Offer resolution work is persisted in `Application.offerResolution` and `Offer.resolutionState`.
The application recovery scan selects records with `offerResolution.durableState: "PENDING"`.
Offer finalization reconciliation selects records with `resolutionState: "PENDING"` (bounded to
200 per invocation). Offer creation uses `Application.offerCreationClaim`. A `CREATING` claim expires
after five minutes so a process crash before Offer insertion does not block the Application
indefinitely. Once inserted, a persistent `COMPLETED` fence is linked to that Offer; only its
matching Offer resolution can pass the Application compare-and-set through the fence.

## Authorized operator procedure

1. Confirm the target environment and explicitly set its `MONGODB_URI`. The recovery script refuses
   to use the application's localhost development-database fallback.
2. Stop all application server workers before recovering expired Offer creation claims. This avoids
   a paused process resuming while an operator is clearing an expired claim.
3. Run from the repository root in PowerShell:

   ```powershell
   $env:MONGODB_URI = '<approved environment connection string>'
   node backend/scripts/recoverOfferOperations.js
   Remove-Item Env:MONGODB_URI
   ```

   Do not paste the connection string into logs or tickets. The command prints only aggregate
   scan/completion counts. It inspects interrupted Offer creation markers, safely promotes a
   surviving draft to a completed fence when its Application remains Selected, clears only claims
   that are expired at the time of their conditional update, resumes pending application resolution
   steps, then reconciles pending Offer finalization. A creation draft is retained only when its
   Application remains Selected; a draft attached to a terminal or missing Application is removed
   conditionally.
4. Review the safe summary and application/offer state through approved operational access. If any
   operation remains pending, inspect it using authorized database tooling and re-run this command
   after correcting its underlying failure. No public recovery endpoint is exposed.

The recovery functions are idempotent: vacancy release uses `$pull`, operation IDs protect the
resolution/audit path, and Offer finalization uses a compare-and-set on the pending operation ID.
They do not provide cross-document transaction atomicity. A process crash after a side effect and
before its step marker can cause the step to be attempted again; handlers and recovery side effects
must remain idempotent.

The five-minute creation claim is a lease, not a transaction. A post-insert fence and conditional
cleanup prevent a stale claimant from leaving a retained Offer attached to a terminal Application.
Operational recovery should be run only after workers are stopped. This procedure does not establish real MongoDB concurrency or
crash-recovery guarantees; those require database-backed tests against a disposable deployment
with production-equivalent MongoDB topology.
