const { reconcilePendingOfferResolutions } = require("../controllers/offer.controller");

// Invoke explicitly from an authorized maintenance context after the database is available.
// This is bounded, idempotent, and does not start a worker or modify unrelated records.
module.exports = { reconcilePendingOfferResolutions };
