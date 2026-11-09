require("dotenv").config();
const mongoose = require("mongoose");
const Application = require("../models/Application");
const Offer = require("../models/Offer");
const { resumePendingOfferResolutions } = require("../utils/offerRecovery");
const { reconcilePendingOfferResolutions } = require("../services/offerResolutionReconciliation");

const recoverExpiredOfferCreationClaims = async () => {
  const expired = await Application.find({
    "offerCreationClaim.claimId": { $ne: null },
    "offerCreationClaim.state": "CREATING",
    "offerCreationClaim.expiresAt": { $lte: new Date() },
  }).select("_id status offerCreationClaim");
  let released = 0;
  for (const application of expired) {
    const claimId = application.offerCreationClaim?.claimId;
    if (!claimId) continue;
    // Never clear a live creation claim. Stopping all application server workers
    // before running this command prevents a stale process from resuming mid-recovery.
    const result = await Application.updateOne(
      {
        _id: application._id,
        "offerCreationClaim.claimId": claimId,
        "offerCreationClaim.state": "CREATING",
        "offerCreationClaim.expiresAt": { $lte: new Date() },
      },
      { $unset: { offerCreationClaim: 1 } }
    );
    if (result.modifiedCount) released += 1;
  }
  return { scanned: expired.length, released };
};

const recoverInterruptedOfferCreations = async () => {
  const pending = await Offer.find({ creationClaimId: { $ne: null } })
    .select("+creationClaimId application status");
  let draftsReleased = 0;
  let staleDraftsRemoved = 0;
  for (const offer of pending) {
    const application = await Application.findById(offer.application).select("status offerCreationClaim");
    if (application?.status === "Selected") {
      const currentClaimId = application.offerCreationClaim?.claimId;
      if (currentClaimId && currentClaimId !== offer.creationClaimId) continue;
      const completed = await Application.findOneAndUpdate(
        { _id: application._id, status: "Selected", $or: [
          { "offerCreationClaim.claimId": null },
          { offerCreationClaim: { $exists: false } },
          { "offerCreationClaim.claimId": offer.creationClaimId },
        ] },
        { $set: { offerCreationClaim: {
          claimId: offer.creationClaimId,
          claimedAt: application.offerCreationClaim?.claimedAt || new Date(),
          expiresAt: null,
          state: "COMPLETED",
          offerId: offer._id,
        } } },
        { new: true, returnDocument: "after" }
      );
      if (!completed) continue;
      const result = await Offer.updateOne(
        { _id: offer._id, status: "DRAFT", creationClaimId: offer.creationClaimId },
        { $unset: { creationClaimId: 1 } }
      );
      if (result.modifiedCount) draftsReleased += 1;
    } else {
      const result = await Offer.deleteOne(
        { _id: offer._id, status: "DRAFT", creationClaimId: offer.creationClaimId }
      );
      if (result.deletedCount) staleDraftsRemoved += 1;
    }
  }
  return { scanned: pending.length, draftsReleased, staleDraftsRemoved };
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("Set MONGODB_URI explicitly; this recovery command has no development-database fallback.");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const creations = await recoverInterruptedOfferCreations();
    const claims = await recoverExpiredOfferCreationClaims();
    const applications = await resumePendingOfferResolutions();
    const offers = await reconcilePendingOfferResolutions();
    console.log(JSON.stringify({
      expiredCreationClaims: claims,
      interruptedOfferCreations: creations,
      pendingApplicationResolutions: { scanned: applications.totalPending, completed: applications.recoveredCount },
      pendingOfferReconciliation: { scanned: offers.scanned, completed: offers.results.filter((x) => x.status === "COMPLETED").length },
    }));
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error(`Offer recovery failed (${error.name || "Error"}). Detailed diagnostics are not printed.`);
    process.exitCode = 1;
  });
}

module.exports = { recoverExpiredOfferCreationClaims, recoverInterruptedOfferCreations, run };
