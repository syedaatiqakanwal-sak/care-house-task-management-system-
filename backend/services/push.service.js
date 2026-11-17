const webpush = require("web-push");
const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { PushSubscription, User } = require("../models");

const vapidStorePath = path.resolve(__dirname, "..", ".vapid.json");

function loadOrCreateVapid() {
  let publicKey = env.vapid.publicKey;
  let privateKey = env.vapid.privateKey;

  if (publicKey && privateKey) {
    return { publicKey, privateKey, subject: env.vapid.subject };
  }

  try {
    if (fs.existsSync(vapidStorePath)) {
      const stored = JSON.parse(fs.readFileSync(vapidStorePath, "utf8"));
      if (stored.publicKey && stored.privateKey) {
        return { ...stored, subject: env.vapid.subject };
      }
    }
  } catch {
    /* ignore */
  }

  const keys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(
      vapidStorePath,
      JSON.stringify({ publicKey: keys.publicKey, privateKey: keys.privateKey }, null, 2)
    );
  } catch {
    /* ignore write errors */
  }
  return { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: env.vapid.subject };
}

const vapid = loadOrCreateVapid();
webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

exports.getPublicVapidKey = () => vapid.publicKey;

exports.saveSubscription = async (userId, subscription, userAgent) => {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error("Invalid push subscription");
  }

  const [row] = await PushSubscription.findOrCreate({
    where: { endpoint: subscription.endpoint },
    defaults: {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent || null,
      last_used_at: new Date()
    }
  });

  await row.update({
    user_id: userId,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    user_agent: userAgent || row.user_agent,
    last_used_at: new Date()
  });

  return row;
};

exports.removeSubscription = async (userId, endpoint) => {
  if (!endpoint) {
    await PushSubscription.destroy({ where: { user_id: userId } });
    return;
  }
  await PushSubscription.destroy({ where: { user_id: userId, endpoint } });
};

exports.sendPushToUsers = async (userIds, payload) => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;

  const users = await User.findAll({
    where: { id: ids },
    attributes: [
      "id",
      "desktop_notifications_enabled",
      "notification_preview_enabled",
      "notify_direct_messages",
      "notify_group_messages"
    ]
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const subs = await PushSubscription.findAll({ where: { user_id: ids } });
  await Promise.all(
    subs.map(async (sub) => {
      const user = userMap.get(sub.user_id);
      if (!user || !user.desktop_notifications_enabled) return;

      const isGroup = Boolean(payload?.isGroup);
      if (isGroup && user.notify_group_messages === false) return;
      if (!isGroup && user.notify_direct_messages === false) return;

      const body = user.notification_preview_enabled
        ? payload.body
        : "You have a new message";

      const data = {
        title: payload.title || "New Message",
        body,
        url: payload.url || "/messages",
        conversationId: payload.conversationId || null,
        tag: payload.tag || `msg-${payload.conversationId || "general"}`
      };

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(data)
        );
        await sub.update({ last_used_at: new Date() });
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sub.destroy();
        }
      }
    })
  );
};
