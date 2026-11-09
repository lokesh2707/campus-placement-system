const mongoose = require("mongoose");
const Notification = require("../models/Notification");

const dto = (n) => ({ id: n._id, type: n.type, title: n.title, message: n.message, entityType: n.entityType, entityId: n.entityId, actionPath: n.actionPath, readAt: n.readAt, createdAt: n.createdAt });
const owner = (req) => ({ recipientUser: req.user._id });

exports.listNotifications = async (req, res, next) => {
  try {
    const parsePositive = (value, fallback, field) => {
      if (value === undefined) return fallback;
      if (!/^\d+$/.test(String(value)) || Number(value) < 1) throw Object.assign(new Error(`Invalid ${field}`), { status: 400 });
      return Number(value);
    };
    const page = parsePositive(req.query.page, 1, "page");
    const limit = Math.min(50, parsePositive(req.query.limit, 20, "limit"));
    if (req.query.unreadOnly !== undefined && !["true", "false"].includes(req.query.unreadOnly)) return res.status(400).json({ message: "Invalid unreadOnly filter" });
    const filter = owner(req);
    if (req.query.unreadOnly === "true") filter.readAt = null;
    const [rows, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);
    res.json({ notifications: rows.map(dto), page, limit, total, pages: Math.ceil(total / limit) });
  } catch (e) { if (e.status === 400) return res.status(400).json({ message: e.message }); next(e); }
};

exports.unreadCount = async (req, res, next) => {
  try { res.json({ count: await Notification.countDocuments({ ...owner(req), readAt: null }) }); } catch (e) { next(e); }
};

exports.markRead = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Notification not found" });
    let item = await Notification.findOneAndUpdate({ _id: req.params.id, ...owner(req), readAt: null }, { $set: { readAt: new Date() } }, { new: true }).lean();
    if (!item) item = await Notification.findOne({ _id: req.params.id, ...owner(req) }).lean();
    if (!item) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification: dto(item) });
  } catch (e) { next(e); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany({ ...owner(req), readAt: null }, { $set: { readAt: new Date() } });
    res.json({ updated: result.modifiedCount || 0 });
  } catch (e) { next(e); }
};
