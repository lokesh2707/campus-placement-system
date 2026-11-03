const mongoose = require("mongoose");

/**
 * Minimal append-only audit trail for administrator actions.
 * Does not store secrets (passwords, tokens, etc.).
 */
const AdminAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "user_status_change",
        "user_role_change",
        "create_privileged_user",
        "super_admin_bootstrap",
        "credential_reissue",
        "institute_created",
        "institute_updated",
        "institute_status_change",
        "institute_deleted",
        "company_created",
        "company_updated",
        "company_verified",
        "company_status_change",
        "company_authorized",
        "company_deauthorized",
        "recruiter_provisioned",
        "admin_security_alert",
        "student_academic_updated",
        "student_placement_override",
        "offer_resolution",
      ],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    targetInstitute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: false,
    },
    targetCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AdminAuditLogSchema.index(
  { "details.operationId": 1 },
  { unique: true, sparse: true }
);

/**
 * Safely ensures the unique sparse index on details.operationId exists in MongoDB.
 * If an old non-unique index exists, drops it first to prevent IndexKeySpecsConflict.
 */
AdminAuditLogSchema.statics.ensureIndexesSafe = async function () {
  try {
    const col = this.collection;
    const indexes = await col.indexes().catch(() => []);
    const existingIdx = indexes.find((i) => i.name === "details.operationId_1");
    if (existingIdx && !existingIdx.unique) {
      await col.dropIndex("details.operationId_1").catch(() => {});
    }
    await this.createIndexes();
  } catch (err) {
    console.warn("AdminAuditLog.ensureIndexesSafe warning:", err.message);
  }
};

module.exports = mongoose.model("AdminAuditLog", AdminAuditLogSchema);
