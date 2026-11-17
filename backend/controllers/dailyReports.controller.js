const { Op } = require("sequelize");
const { DailyReport, User, Role } = require("../models");

const LONDON_TIMEZONE = "Europe/London";

function isAdmin(req) {
  return req.user?.Role?.role_name === "Super Admin";
}

function getUKNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long"
  }).formatToParts(date);
  const pick = (type) => parts.find((p) => p.type === type)?.value;
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = pick("hour");
  const minute = pick("minute");
  const second = pick("second");
  const weekday = pick("weekday");
  const isoDate = `${year}-${month}-${day}`;
  return {
    isoDate,
    weekday,
    time: `${hour}:${minute}:${second}`,
    monthLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON_TIMEZONE,
      month: "long",
      year: "numeric"
    }).format(date)
  };
}

function isoWeekNumberFromDateString(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function buildPeriodWhere(period, value) {
  if (!period || !value) return {};
  if (period === "day") return { date: value };
  if (period === "week") return { week_number: Number(value) || 0 };
  if (period === "month") return { month: value };
  return {};
}

exports.create = async (req, res) => {
  try {
    const payload = req.body || {};
    const now = getUKNow();
    const date = now.isoDate;
    const day = now.weekday;
    const week_number = isoWeekNumberFromDateString(date);
    const month = now.monthLabel;

    const row = await DailyReport.create({
      user_id: req.user.id,
      day,
      date,
      task_description: payload.task_description || "",
      start_time: payload.start_time || now.time,
      end_time: payload.end_time || null,
      status: payload.status === "completed" ? "completed" : "pending",
      notes: payload.notes || null,
      week_number,
      month
    });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.listMy = async (req, res) => {
  try {
    const periodWhere = buildPeriodWhere(req.query.period, req.query.value);
    const rows = await DailyReport.findAll({
      where: { user_id: req.user.id, ...periodWhere },
      order: [["date", "DESC"], ["start_time", "ASC"]]
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.listAll = async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
  try {
    const periodWhere = buildPeriodWhere(req.query.period, req.query.value);
    const where = { ...periodWhere };
    if (req.query.user_id) where.user_id = Number(req.query.user_id);
    const rows = await DailyReport.findAll({
      where,
      include: [{ model: User, as: "user", attributes: ["id", "full_name", "email", "profile_pic"], include: [{ model: Role }] }],
      order: [["date", "DESC"], ["user_id", "ASC"], ["start_time", "ASC"]]
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.listByUser = async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
  try {
    const periodWhere = buildPeriodWhere(req.query.period, req.query.value);
    const rows = await DailyReport.findAll({
      where: { user_id: Number(req.params.userId), ...periodWhere },
      include: [{ model: User, as: "user", attributes: ["id", "full_name", "email", "profile_pic"] }],
      order: [["date", "DESC"], ["start_time", "ASC"]]
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const row = await DailyReport.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Daily report entry not found" });
    if (!isAdmin(req) && Number(row.user_id) !== Number(req.user.id)) return res.status(403).json({ message: "Forbidden" });
    const nextStatus = req.body?.status === "completed" ? "completed" : "pending";
    const now = getUKNow();
    await row.update({
      status: nextStatus,
      end_time: nextStatus === "completed" ? (row.end_time || now.time) : row.end_time
    });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await DailyReport.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Daily report entry not found" });
    if (!isAdmin(req) && Number(row.user_id) !== Number(req.user.id)) return res.status(403).json({ message: "Forbidden" });

    const payload = req.body || {};
    await row.update({
      task_description: payload.task_description ?? row.task_description,
      start_time: payload.start_time ?? row.start_time,
      end_time: payload.end_time ?? row.end_time,
      status: payload.status === "completed" ? "completed" : payload.status === "pending" ? "pending" : row.status,
      notes: payload.notes ?? row.notes
    });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await DailyReport.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Daily report entry not found" });
    if (!isAdmin(req) && Number(row.user_id) !== Number(req.user.id)) return res.status(403).json({ message: "Forbidden" });
    await row.destroy();
    return res.json({ message: "Daily report entry deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.bulkUpsertToday = async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const now = getUKNow();
    const date = now.isoDate;
    const day = now.weekday;
    const week_number = isoWeekNumberFromDateString(date);
    const month = now.monthLabel;

    const existing = await DailyReport.findAll({
      where: { user_id: req.user.id, date },
      order: [["id", "ASC"]]
    });

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i] || {};
      const current = existing[i];
      const payload = {
        user_id: req.user.id,
        day,
        date,
        task_description: entry.task_description || "",
        start_time: entry.start_time || now.time,
        end_time: entry.end_time || null,
        status: entry.status === "completed" ? "completed" : "pending",
        notes: entry.notes || null,
        week_number,
        month
      };
      if (current) await current.update(payload);
      else await DailyReport.create(payload);
    }

    if (existing.length > entries.length) {
      const idsToDelete = existing.slice(entries.length).map((r) => r.id);
      if (idsToDelete.length) await DailyReport.destroy({ where: { id: { [Op.in]: idsToDelete } } });
    }

    const rows = await DailyReport.findAll({
      where: { user_id: req.user.id, date },
      order: [["start_time", "ASC"], ["id", "ASC"]]
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
