import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import moment from "moment-timezone";
import qrcode from "qrcode-terminal";
import pino from "pino";
import fs from "fs";

const signature = "\n\n⌁ 𝐕𝐔 𝐍𝐞𝐱𝐆𝐞𝐧 🚀";

const DEVELOPER_LID      = "124842233843944";
const DATA_DIR           = process.env.DATA_DIR || "./";
const LOCKED_USERS_FILE  = `${DATA_DIR}locked_users.json`;
const SETTINGS_FILE      = `${DATA_DIR}group_settings.json`;

const GOOD_NIGHT_HOUR    = 22;
const GOOD_NIGHT_MINUTE  = 0;
const GOOD_MORNING_HOUR  = 8;
const GOOD_MORNING_MINUTE = 0;

const GOOD_NIGHT_MSGS = [
  `🌙 *Good Night VU NextGen!*\n"Dream big, work hard, sleep well" ✨`,
  `🌟 *Sweet Dreams Everyone!*\n"Rest now, rise stronger tomorrow" 😴`,
  `🌜 *Night VU NextGen!*\n"Every expert was once a beginner" 🌱`,
  `🌙 *Sleep Well!*\n"Small steps lead to big results" 📈`,
  `✨ *Good Night!*\n"Tomorrow is a new opportunity" 🌅`,
  `🌃 *Night Everyone!*\n"Learning never stops" 📚`,
  `💫 *Sweet Dreams!*\n"Your potential is unlimited" 🚀`,
  `🌙 *Night Night!*\n"Rest, recharge, return stronger" 💪`,
  `🌌 *Good Night!*\n"Success is a journey, not a destination" 🛤️`,
  `🌠 *Dream Big!*\n"Sleep well, achieve more" 🎯`,
  `🌙 *Night VU NextGen!*\n"Hard work pays off" 💎`,
  `✨ *Sweet Dreams!*\n"Believe in yourself" 🌟`,
  `🌜 *Good Night!*\n"Keep learning, keep growing" 🌿`,
  `🌃 *Night Everyone!*\n"Tomorrow brings new chances" 🌄`,
  `💤 *Sleep Tight!*\n"You're capable of amazing things" 🎆`,
];

const GOOD_MORNING_MSGS = [
  `☀️ *Good Morning VU NextGen!*\n"Today is a new beginning" ✨`,
  `🌅 *Rise & Shine Everyone!*\n"Make today amazing" 🎯`,
  `🌞 *Morning VU NextGen!*\n"New day, new goals" 💪`,
  `✨ *Good Morning!*\n"Every sunrise brings opportunities" 🌄`,
  `🌄 *Morning Motivation!*\n"Success starts today" 🚀`,
  `🌅 *Hello VU NextGen!*\n"Wake up with determination" 🌟`,
  `☀️ *Good Morning!*\n"Great things await you" 💎`,
  `🌞 *Morning Everyone!*\n"You're capable of amazing things" 🎆`,
  `✨ *Rise & Grind!*\n"Education changes everything" 📚`,
  `🌅 *Morning VU NextGen!*\n"Step out of comfort zones" 🦅`,
  `☀️ *Good Morning!*\n"Focus on your goals" 🎯`,
  `🌞 *Hello Everyone!*\n"Challenge your limits" 🌟`,
  `✨ *Morning Motivation!*\n"Start today, succeed tomorrow" 🏆`,
  `🌅 *Good Morning VU NextGen!*\n"Be so good they can't ignore you" 💫`,
  `☀️ *Rise & Shine!*\n"Your future starts now" ⏰`,
];

const spamCount       = new Map();
const promotionCount  = new Map();
const lockedUsers     = new Map();
const lockedCounters  = new Map();
const botRemovedUsers = new Map();
const dailyStats      = new Map();
const groupSettings   = new Map();

let nightMsgIndex   = 0;
let morningMsgIndex = 0;

function loadLockedUsers() {
  try {
    if (fs.existsSync(LOCKED_USERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCKED_USERS_FILE, "utf8"));
      for (const [g, arr] of Object.entries(parsed.lockedUsers    || {})) lockedUsers.set(g, new Set(arr));
      for (const [g, obj] of Object.entries(parsed.lockedCounters || {})) lockedCounters.set(g, obj);
      console.log("✅ Locked users loaded");
    }
  } catch (e) { console.log("❌ Load error:", e.message); }
}

function saveLockedUsers() {
  try {
    const out = { lockedUsers: {}, lockedCounters: {} };
    for (const [g, s] of lockedUsers)    out.lockedUsers[g]    = Array.from(s);
    for (const [g, o] of lockedCounters) out.lockedCounters[g] = o;
    fs.writeFileSync(LOCKED_USERS_FILE, JSON.stringify(out, null, 2));
  } catch (e) { console.log("❌ Save error:", e.message); }
}

function loadGroupSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      for (const [g, s] of Object.entries(parsed)) groupSettings.set(g, s);
      console.log("✅ Group settings loaded");
    }
  } catch (e) { console.log("❌ Settings load error:", e.message); }
}

function saveGroupSettings() {
  try {
    const out = {};
    for (const [g, s] of groupSettings) out[g] = s;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(out, null, 2));
  } catch (e) { console.log("❌ Settings save error:", e.message); }
}

function getGroupSettings(groupJid) {
  if (!groupSettings.has(groupJid)) {
    groupSettings.set(groupJid, { antilink: true, antisticker: true });
  }
  return groupSettings.get(groupJid);
}

function isDeveloper(userId) {
  if (!userId) return false;
  return userId.replace(/[^0-9]/g, "") === DEVELOPER_LID;
}

function getPKTDate() {
  return moment().tz("Asia/Karachi").format("ddd, D MMM YYYY");
}

function initDailyStats(groupJid) {
  if (!dailyStats.has(groupJid)) dailyStats.set(groupJid, { userMsgCount: {}, filesShared: 0 });
}

function trackMessage(groupJid, userId) {
  initDailyStats(groupJid);
  const s = dailyStats.get(groupJid);
  s.userMsgCount[userId] = (s.userMsgCount[userId] || 0) + 1;
}

function trackFile(groupJid) {
  initDailyStats(groupJid);
  dailyStats.get(groupJid).filesShared++;
}

function buildStatsMessage(groupJid) {
  initDailyStats(groupJid);
  const stats  = dailyStats.get(groupJid);
  const sorted = Object.entries(stats.userMsgCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const top    = sorted.length
    ? sorted.map(([uid, cnt], i) => `${medals[i]} @${uid.split("@")[0]} ➟ *${cnt}* msgs`).join("\n")
    : "📊 𝐍𝐨 𝐦𝐞𝐬𝐬𝐚𝐠𝐞𝐬 𝐫𝐞𝐜𝐨𝐫𝐝𝐞𝐝 𝐭𝐨𝐝𝐚𝐲";

  return (
    `📊 *𝐃𝐚𝐢𝐥𝐲 𝐑𝐞𝐩𝐨𝐫𝐭*

> 𝐓𝐨𝐩 𝐀𝐜𝐭𝐢𝐯𝐞 𝐔𝐬𝐞𝐫𝐬:
${top}

> 𝐅𝐢𝐥𝐞𝐬 𝐒𝐡𝐚𝐫𝐞𝐝: ${stats.filesShared} 🗂️`
  );
}

function getStatsMentions(groupJid) {
  initDailyStats(groupJid);
  return Object.keys(dailyStats.get(groupJid).userMsgCount)
    .sort((a, b) => dailyStats.get(groupJid).userMsgCount[b] - dailyStats.get(groupJid).userMsgCount[a])
    .slice(0, 5);
}

function resetDailyStats(groupJid) {
  dailyStats.set(groupJid, { userMsgCount: {}, filesShared: 0 });
}

const isFileMessage = (msg) => {
  const m = msg?.message;
  if (!m) return false;
  return !!(m.imageMessage || m.videoMessage || m.documentMessage || m.audioMessage || m.stickerMessage);
};

const extractText = (msg) => {
  if (!msg?.message) return "";
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.documentMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  );
};

async function snoozeGroup(sock, groupJid, minutes = 5) {
  try {
    await sock.groupSettingUpdate(groupJid, "announcement");
    await sock.sendMessage(groupJid, {
      text: `⏸️ *𝐆𝐫𝐨𝐮𝐩 𝐏𝐚𝐮𝐬𝐞𝐝*\n\n𝐕𝐢𝐨𝐥𝐚𝐭𝐢𝐨𝐧𝐬 𝐝𝐞𝐭𝐞𝐜𝐭𝐞𝐝. 𝐑𝐞𝐨𝐩𝐞𝐧𝐬 𝐢𝐧 ${minutes}𝐦\n\n𝐑𝐞𝐯𝐢𝐞𝐰 𝐫𝐮𝐥𝐞𝐬 📋${signature}`,
    });
    setTimeout(async () => {
      try {
        await sock.groupSettingUpdate(groupJid, "not_announcement");
        await sock.sendMessage(groupJid, {
          text: `▶️ *𝐆𝐫𝐨𝐮𝐩 𝐑𝐞𝐨𝐩𝐞𝐧𝐞𝐝*\n\n𝐏𝐚𝐮𝐬𝐞 𝐞𝐧𝐝𝐞𝐝. 𝐄𝐯𝐞𝐫𝐲𝐨𝐧𝐞 𝐜𝐚𝐧 𝐬𝐞𝐧𝐝 𝐦𝐞𝐬𝐬𝐚𝐠𝐞𝐬\n\n𝐊𝐞𝐞𝐩 𝐢𝐭 𝐫𝐞𝐬𝐩𝐞𝐜𝐭𝐟𝐮𝐥 🙏${signature}`,
        });
      } catch (_) {}
    }, minutes * 60 * 1000);
  } catch (_) {}
}

function startScheduler(sock, getGroupJids) {
  let lastNightHour   = -1;
  let lastMorningHour = -1;

  setInterval(async () => {
    try {
      const now    = moment().tz("Asia/Karachi");
      const hour   = now.hour();
      const minute = now.minute();
      const groups = getGroupJids();
      if (!groups || groups.length === 0) return;

      if (hour === GOOD_NIGHT_HOUR && minute === GOOD_NIGHT_MINUTE && lastNightHour !== GOOD_NIGHT_HOUR) {
        lastNightHour   = GOOD_NIGHT_HOUR;
        lastMorningHour = -1;
        console.log("🌙 Good Night triggered");
        for (const jid of groups) {
          try {
            const nightMsg = GOOD_NIGHT_MSGS[nightMsgIndex % GOOD_NIGHT_MSGS.length];
            const statMsg  = buildStatsMessage(jid);
            const mentions = getStatsMentions(jid);
            nightMsgIndex++;
            await sock.groupSettingUpdate(jid, "announcement");
            await sock.sendMessage(jid, { text: `${nightMsg}\n\n${statMsg}${signature}`, mentions });
            resetDailyStats(jid);
          } catch (e) { console.error(`❌ Good Night error (${jid}):`, e.message); }
        }
      }

      if (hour === GOOD_MORNING_HOUR && minute === GOOD_MORNING_MINUTE && lastMorningHour !== GOOD_MORNING_HOUR) {
        lastMorningHour = GOOD_MORNING_HOUR;
        lastNightHour   = -1;
        console.log("☀️ Good Morning triggered");
        for (const jid of groups) {
          try {
            const morningMsg = GOOD_MORNING_MSGS[morningMsgIndex % GOOD_MORNING_MSGS.length];
            morningMsgIndex++;
            await sock.groupSettingUpdate(jid, "not_announcement");
            await sock.sendMessage(jid, { text: `${morningMsg}${signature}` });
          } catch (e) { console.error(`❌ Good Morning error (${jid}):`, e.message); }
        }
      }
    } catch (e) { console.error("❌ Scheduler error:", e.message); }
  }, 60 * 1000);
}

async function cleanupAuthFiles() {
  try {
    const authDir = `${DATA_DIR}baileys_auth`;
    if (fs.existsSync(authDir)) {
      for (const file of fs.readdirSync(authDir)) {
        if (file !== "creds.json") fs.unlinkSync(`${authDir}/${file}`);
      }
    }
    console.log("✅ Auth files cleaned");
  } catch (e) { console.log("⚠️  Auth cleanup failed:", e.message); }
}

async function sendWelcomeMessage(sock, groupJid, userId) {
  const userTag = userId.split("@")[0];
  const msgText = `╔═════════════╗\n ⚡ 𝐕𝐔 𝐍𝐞𝐱𝐆𝐞𝐧 ⚡\n╚═════════════╝\n 👋 Welcome @${userTag}\n To the next generation of learners & creators. 🚀\n 📚 Study smarter\n 💡 Think bigger\n 🤝 Connect stronger\n ⌁ 𝐕𝐔 𝐍𝐞𝐱𝐆𝐞𝐧 🚀`;
  await sock.sendMessage(groupJid, { text: msgText, mentions: [userId] });
}

async function startBot() {
  console.log("🚀 Starting Nina Bot...");
  loadLockedUsers();
  loadGroupSettings();

  const { state, saveCreds } = await useMultiFileAuthState(`${DATA_DIR}baileys_auth`);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Nina Bot", "Chrome", "1.0.0"],
  });

  const knownGroups = new Set();

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") {
      console.log("✅ Nina Bot connected!");
      startScheduler(sock, () => Array.from(knownGroups));
    } else if (connection === "close") {
      saveLockedUsers();
      saveGroupSettings();
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`🔌 Disconnected — code: ${code}`);
      if (code === 401) {
        cleanupAuthFiles().then(() =>
          setTimeout(() => startBot().catch(console.error), 3000)
        );
      } else if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => startBot().catch(console.error), 5000);
      } else {
        console.log("👋 Logged out. Restart manually.");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;
    knownGroups.add(id);

    for (const user of participants) {
      if (action === "add") {
        await sendWelcomeMessage(sock, id, user);
      } else if (action === "remove") {
        const wasBot = botRemovedUsers.has(id) && botRemovedUsers.get(id).has(user);
        if (wasBot) {
          botRemovedUsers.get(id).delete(user);
          if (!botRemovedUsers.get(id).size) botRemovedUsers.delete(id);
          return;
        }
        await sock.sendMessage(id, {
          text: `⚡ 𝐍𝐞𝐱𝐆𝐞𝐧 𝐌𝐨𝐝𝐞𝐫𝐚𝐭𝐢𝐨𝐧\nAccess denied for @${user.split("@")[0]} 🚫\n\n⌁ 𝐕𝐔 𝐍𝐞𝐱𝐆𝐞𝐧 🚀`,
          mentions: [user],
        });
      }
    }
  });

  const isBotAdmin = async (groupJid) => {
    try {
      const g   = await sock.groupMetadata(groupJid);
      const bid = sock.user?.id;
      if (!bid) return false;
      const p = g.participants.find(
        (p) => p.id === bid || p.id.toLowerCase() === bid.toLowerCase()
      );
      return p ? p.admin === "admin" || p.admin === "superadmin" : true;
    } catch (_) { return false; }
  };

  sock.ev.on("messages.upsert", async (mUp) => {
    try {
      const msg = mUp.messages?.[0];
      if (!msg?.message || msg.key.fromMe) return;

      const from      = msg.key.remoteJid;
      const senderId  = msg.key.participant || msg.key.remoteJid;
      const text      = extractText(msg);

      if (!from.endsWith("@g.us")) return;

      knownGroups.add(from);

      const senderStr     = senderId.toString();
      const group         = await sock.groupMetadata(from);
      const admins        = group.participants
        .filter((p) => p.admin === "admin" || p.admin === "superadmin")
        .map((p) => p.id);
      const isAdmin       = admins.includes(senderStr);
      const botIsAdmin    = await isBotAdmin(from);
      const isDev         = isDeveloper(senderStr);
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const settings      = getGroupSettings(from);

      if (isDev && lockedUsers.has(from)) lockedUsers.get(from).delete(senderStr);

      trackMessage(from, senderStr);
      if (isFileMessage(msg)) trackFile(from);

      const cmd = text.trim().toLowerCase();

      // 1. .nina
      if (cmd === ".nina") {
        await sock.sendMessage(from, {
          text: `*Nina is here, Boss!* 🤖\n\n> 𝖨'𝗆 𝗋𝖾𝖺𝖽𝗒 𝗍𝗈 𝖺𝗌𝗌𝗂𝗌𝗍 𝗒𝗈𝗎.${signature}`,
        });
        return;
      }

      // ── Anti-link toggle ──
      if (isAdmin && cmd === ".antilinkon") {
        settings.antilink = true;
        saveGroupSettings();
        await sock.sendMessage(from, { text: `🔒 *𝐀𝐧𝐭𝐢-𝐋𝐢𝐧𝐤* 𝐄𝐧𝐚𝐛𝐥𝐞𝐝 ✅${signature}` });
        return;
      }
      if (isAdmin && cmd === ".antilinkoff") {
        settings.antilink = false;
        saveGroupSettings();
        await sock.sendMessage(from, { text: `🔓 *𝐀𝐧𝐭𝐢-𝐋𝐢𝐧𝐤* 𝐃𝐢𝐬𝐚𝐛𝐥𝐞𝐝 ❌${signature}` });
        return;
      }

      // ── Anti-sticker toggle ──
      if (isAdmin && cmd === ".antistickeron") {
        settings.antisticker = true;
        saveGroupSettings();
        await sock.sendMessage(from, { text: `🚫 *𝐀𝐧𝐭𝐢-𝐒𝐭𝐢𝐜𝐤𝐞𝐫* 𝐄𝐧𝐚𝐛𝐥𝐞𝐝 ✅${signature}` });
        return;
      }
      if (isAdmin && cmd === ".antistickeroff") {
        settings.antisticker = false;
        saveGroupSettings();
        await sock.sendMessage(from, { text: `✅ *𝐀𝐧𝐭𝐢-𝐒𝐭𝐢𝐜𝐤𝐞𝐫* 𝐃𝐢𝐬𝐚𝐛𝐥𝐞𝐝 ❌${signature}` });
        return;
      }

      // ── .tagall ──
      if (isAdmin && (cmd.startsWith(".tagall") || cmd.startsWith(".mentionall"))) {
        const participants = group.participants;
        const custom = text.split(" ").slice(1).join(" ") || "📢 𝐀𝐭𝐭𝐞𝐧𝐭𝐢𝐨𝐧 @everyone! 𝐏𝐥𝐞𝐚𝐬𝐞 𝐫𝐞𝐚𝐝 𝐭𝐡𝐢𝐬 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐜𝐚𝐫𝐞𝐟𝐮𝐥𝐥𝐲 🙏";
        const mentions = participants.map((p) => p.id);
        await sock.sendMessage(from, {
          text: `${custom}\n\n👥 𝐌𝐞𝐦𝐛𝐞𝐫𝐬: ${participants.length} · 📅 ${getPKTDate()}${signature}`,
          mentions,
        });
        return;
      }

      // ── .close ──
      if (isAdmin && /^\. ?close$/i.test(text.trim())) {
        if (!botIsAdmin)
          return sock.sendMessage(from, { text: `⚠️ *𝐍𝐞𝐞𝐝 𝐀𝐝𝐦𝐢𝐧* 𝐑𝐢𝐠𝐡𝐭𝐬 🛡️${signature}` });
        await sock.groupSettingUpdate(from, "announcement");
        await sock.sendMessage(from, { text: `🔒 *𝐆𝐫𝐨𝐮𝐩 𝐋𝐨𝐜𝐤𝐞𝐝*\n𝐂𝐡𝐚𝐭 𝐫𝐞𝐬𝐭𝐫𝐢𝐜𝐭𝐞𝐝 𝐭𝐨 𝐚𝐝𝐦𝐢𝐧𝐬 ✅${signature}` });
        return;
      }

      // ── .open ──
      if (isAdmin && /^\. ?open$/i.test(text.trim())) {
        if (!botIsAdmin)
          return sock.sendMessage(from, { text: `⚠️ *𝐍𝐞𝐞𝐝 𝐀𝐝𝐦𝐢𝐧* 𝐑𝐢𝐠𝐡𝐭𝐬 🛡️${signature}` });
        await sock.groupSettingUpdate(from, "not_announcement");
        await sock.sendMessage(from, { text: `🔓 *𝐆𝐫𝐨𝐮𝐩 𝐔𝐧𝐥𝐨𝐜𝐤𝐞𝐝*\n𝐂𝐡𝐚𝐭 𝐨𝐩𝐞𝐧 𝐟𝐨𝐫 𝐞𝐯𝐞𝐫𝐲𝐨𝐧𝐞 ✅${signature}` });
        return;
      }

      // 7. .add
      if (isAdmin && cmd.startsWith(".add")) {
        if (!botIsAdmin)
          return sock.sendMessage(from, {
            text: `⚠️ *𝐀𝐜𝐭𝐢𝐨𝐧 𝐅𝐚𝐢𝐥𝐞𝐝*\n𝐍𝐞𝐞𝐝 𝐚𝐝𝐦𝐢𝐧 𝐫𝐢𝐠𝐡𝐭𝐬 🛡️${signature}`,
          });
        const rawNum = text.trim().split(/\s+/)[1];
        if (!rawNum)
          return sock.sendMessage(from, {
            text: `⚠️ *𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐅𝐨𝐫𝐦𝐚𝐭*\n𝐔𝐬𝐞: *.add 923001234567* 📱${signature}`,
          });
        const clean = rawNum.replace(/[^0-9]/g, "");
        if (clean.length < 10)
          return sock.sendMessage(from, {
            text: `⚠️ *𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐍𝐮𝐦𝐛𝐞𝐫*\n𝐀𝐝𝐝 𝐜𝐨𝐮𝐧𝐭𝐫𝐲 𝐜𝐨𝐝𝐞 📞${signature}`,
          });
        const jid = `${clean}@s.whatsapp.net`;
        try {
          await sock.groupParticipantsUpdate(from, [jid], "add");
          await sock.sendMessage(from, {
            text: `✅ *𝐌𝐞𝐦𝐛𝐞𝐫 𝐀𝐝𝐝𝐞𝐝*\n+${clean} 𝐚𝐝𝐝𝐞𝐝. 𝐖𝐞𝐥𝐜𝐨𝐦𝐞! 🎉${signature}`,
          });
        } catch (e) {
          await sock.sendMessage(from, {
            text: `❌ *𝐂𝐨𝐮𝐥𝐝 𝐍𝐨𝐭 𝐀𝐝𝐝*\n+${clean} 𝐮𝐧𝐚𝐯𝐚𝐢𝐥𝐚𝐛𝐥𝐞 📵${signature}`,
          });
        }
        return;
      }

      // 8. .kick
      if (isAdmin && cmd.startsWith(".kick")) {
        let targets = [];
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (ctx?.quotedMessage) targets.push(ctx.participant);
        targets.push(...mentionedJids);

        if (targets.some((t) => isDeveloper(t))) {
          await sock.sendMessage(from, {
            text: `🛡️ *𝐃𝐞𝐯𝐞𝐥𝐨𝐩𝐞𝐫 𝐏𝐫𝐨𝐭𝐞𝐜𝐭𝐞𝐝*\n𝐔𝐬𝐞𝐫 𝐜𝐚𝐧𝐧𝐨𝐭 𝐛𝐞 𝐫𝐞𝐦𝐨𝐯𝐞𝐝 🚫${signature}`,
            mentions: [senderStr],
          });
          if (botIsAdmin) {
            try {
              botRemovedUsers.get(from)?.add(senderStr) ?? botRemovedUsers.set(from, new Set([senderStr]));
              await sock.groupParticipantsUpdate(from, [senderStr], "remove");
            } catch (_) {}
          }
          return;
        }

        if (!targets.length)
          return sock.sendMessage(from, {
            text: `⚠️ *𝐍𝐨 𝐓𝐚𝐫𝐠𝐞𝐭*\n𝐑𝐞𝐩𝐥𝐲 𝐭𝐨 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐨𝐫 𝐦𝐞𝐧𝐭𝐢𝐨𝐧 𝐮𝐬𝐞𝐫 🎯${signature}`,
          });
        if (!botIsAdmin)
          return sock.sendMessage(from, {
            text: `⚠️ *Action Failed*\n\nI need admin rights to remove members. Please promote me to admin first.${signature}`,
          });

        for (const id of targets) {
          if (admins.includes(id)) {
            await sock.sendMessage(from, {
              text: `❌ *𝐀𝐝𝐦𝐢𝐧 𝐏𝐫𝐨𝐭𝐞𝐜𝐭𝐞𝐝*\n@${id.split("@")[0]} 𝐜𝐚𝐧𝐧𝐨𝐭 𝐛𝐞 𝐤𝐢𝐜𝐤𝐞𝐝 🛡️${signature}`,
              mentions: [id],
            });
            continue;
          }
          try {
            if (!botRemovedUsers.has(from)) botRemovedUsers.set(from, new Set());
            botRemovedUsers.get(from).add(id);
            await sock.groupParticipantsUpdate(from, [id], "remove");
            await sock.sendMessage(from, {
              text: `⚡ 𝐍𝐞𝐱𝐆𝐞𝐧 𝐌𝐨𝐝𝐞𝐫𝐚𝐭𝐢𝐨𝐧\nAccess denied for @${id.split("@")[0]} 🚫\n\n⌁ 𝐕𝐔 𝐍𝐞𝐱𝐆𝐞𝐧 🚀`,
              mentions: [id],
            });
          } catch (_) {
            await sock.sendMessage(from, {
              text: `❌ *𝐅𝐚𝐢𝐥𝐞𝐝 𝐭𝐨 𝐑𝐞𝐦𝐨𝐯𝐞*\n𝐂𝐨𝐮𝐥𝐝𝐧'𝐭 𝐫𝐞𝐦𝐨𝐯𝐞 @${id.split("@")[0]} 🚫${signature}`,
              mentions: [id],
            });
          }
        }
        return;
      }

      // 9. Promotion/Service detection
      const promotionPatterns = [
        /paid.*services.*available/i,
        /assignment.*quiz.*gdb.*solution/i,
        /academic.*services/i,
        /lms.*handling.*services/i,
        /complete.*semester.*half.*semester/i,
        /guaranteed.*results/i,
        /contact.*us.*directly/i,
        /vu.*lms.*handling.*expert/i,
        /all.*subjects.*activities/i,
        /reliable.*affordable.*result.*oriented/i,
        /\+92\d{3}-?\d{7}/i,
        /sir.*ali/i,
        /packages.*available/i,
        /monthly.*plans/i,
        /easy.*installments/i,
        /lecture.*watching.*very.*low.*cost/i,
        /cs.*projects.*b\.ed.*psychology/i,
        /management.*math.*projects/i,
        /full.*semester.*half.*semester/i,
        /cisco.*assignments/i,
        /hard.*form.*books.*available/i,
        /contact.*number.*help.*guidelines/i
      ];
      
      const hasPromotion = promotionPatterns.some(pattern => pattern.test(text));
      
      // Check if it's a legitimate question vs promotion
      const isQuestion = /\b(help|solution|needed|required|anyone|please)\b/i.test(text);
      const hasContactInfo = /\+92\d{3}-?\d{7}|contact.*me|dm.*me/i.test(text);
      const hasPricing = /(paid|price|cost|rs\.?\s*\d|charges)/i.test(text);
      const hasMultipleServices = (text.match(/(assignment|quiz|gdb|project|lms)/gi) || []).length >= 3;
      
      const isDefinitePromotion = hasPromotion && (hasContactInfo || hasPricing || hasMultipleServices) && !isQuestion;
      
      if (!isAdmin && isDefinitePromotion && !isDev) {
        if (!promotionCount.has(from)) promotionCount.set(from, {});
        const pc = promotionCount.get(from);
        pc[senderStr] ??= { count: 0, timeout: null };
        pc[senderStr].count++;
        clearTimeout(pc[senderStr].timeout);
        pc[senderStr].timeout = setTimeout(() => (pc[senderStr].count = 0), 60000); // 1 minute timeout

        await sock.sendMessage(from, {
          text: `⚠️ 𝐏𝐫𝐨𝐦𝐨𝐭𝐢𝐨𝐧 𝐃𝐞𝐭𝐞𝐜𝐭𝐞𝐝 — @${senderStr.split("@")[0]}\n\nPromotional content is not allowed here.\nPlease take admin permission first.\n\n⚡ 𝐖𝐚𝐫𝐧𝐢𝐧𝐠 • ${pc[senderStr].count}/3${signature}`,
          mentions: [senderStr],
        });
        
        if (pc[senderStr].count >= 3) {
          await sock.sendMessage(from, {
            text: `🚫 @${senderStr.split("@")[0]} 𝐛𝐞 𝐰𝐚𝐫𝐧𝐞𝐝 𝐟𝐨𝐫 𝐫𝐞𝐩𝐞𝐚𝐭𝐞𝐝 𝐩𝐫𝐨𝐦𝐨𝐭𝐢𝐨𝐧!\n\n𝐀𝐝𝐦𝐢𝐧𝐬 𝐩𝐥𝐞𝐚𝐬𝐞 𝐭𝐚𝐤𝐞 𝐚𝐜𝐭𝐢𝐨𝐧${signature}`,
            mentions: [senderStr],
          });
        }
        return;
      }

      // 10. Anti-link / Anti-sticker enforcement
      const groupLinkRegex   = /https:\/\/chat\.whatsapp\.com\/\S+/i;
      const channelLinkRegex = /https:\/\/whatsapp\.com\/channel\/\S+/i;
      const isSticker        = !!msg.message?.stickerMessage;
      const hasLink          = groupLinkRegex.test(text) || channelLinkRegex.test(text);
      const blockSticker     = settings.antisticker && isSticker;
      const blockLink        = settings.antilink    && hasLink;

      if (!isAdmin && (blockSticker || blockLink) && !isDev) {
        if (!spamCount.has(from)) spamCount.set(from, {});
        const gd = spamCount.get(from);
        gd[senderStr] ??= { count: 0, timeout: null };
        gd[senderStr].count++;
        clearTimeout(gd[senderStr].timeout);
        gd[senderStr].timeout = setTimeout(() => (gd[senderStr].count = 0), 10000);

        const what = blockSticker && blockLink ? "stickers and links"
          : blockSticker ? "stickers" : "WhatsApp links";

        await sock.sendMessage(from, {
          text: `⚠️ 𝐕𝐢𝐨𝐥𝐚𝐭𝐢𝐨𝐧 — @${senderStr.split("@")[0]}\n\n${what.charAt(0).toUpperCase() + what.slice(1)} 𝐧𝐨𝐭 𝐚𝐥𝐥𝐨𝐰𝐞𝐝 🚫\n\n⚡ 𝐖𝐚𝐫𝐧𝐢𝐧𝐠 • ${gd[senderStr].count}/3${signature}`,
          mentions: [senderStr],
        });

        if (botIsAdmin) {
          try { await sock.sendMessage(from, { delete: msg.key }); } catch (_) {}
        }

        if (gd[senderStr].count >= 3 && botIsAdmin) {
          try {
            if (!botRemovedUsers.has(from)) botRemovedUsers.set(from, new Set());
            botRemovedUsers.get(from).add(senderStr);
            await sock.groupParticipantsUpdate(from, [senderStr], "remove");
            await sock.sendMessage(from, {
              text: `🚨 *𝐔𝐬𝐞𝐫 𝐑𝐞𝐦𝐨𝐯𝐞𝐝*\n\n@${senderStr.split("@")[0]} 𝐫𝐞𝐦𝐨𝐯𝐞𝐝 𝐚𝐟𝐭𝐞𝐫 3 𝐰𝐚𝐫𝐧𝐢𝐧𝐠𝐬\n\n𝐕𝐢𝐨𝐥𝐚𝐭𝐢𝐨𝐧𝐬 𝐧𝐨𝐭 𝐭𝐨𝐥𝐞𝐫𝐚𝐭𝐞𝐝${signature}`,
              mentions: [senderStr],
            });
            await snoozeGroup(sock, from, 5);
          } catch (_) {}
        }
      }

      // 10. .specialwelcome
      if (isAdmin && cmd.startsWith(".specialwelcome")) {
        if (!mentionedJids.length)
          return sock.sendMessage(from, {
            text: `⚠️ *𝐌𝐞𝐧𝐭𝐢𝐨𝐧 𝐔𝐬𝐞𝐫*\n𝐓𝐚𝐠 𝐬𝐨𝐦𝐞𝐨𝐧𝐞 𝐟𝐨𝐫 𝐬𝐩𝐞𝐜𝐢𝐚𝐥 𝐰𝐞𝐥𝐜𝐨𝐦𝐞 🎯${signature}`,
          });
        for (const id of mentionedJids) {
          await sock.sendMessage(from, {
            text:
              `💎 *𝐕𝐈𝐏 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 — 𝐕𝐔 𝐍𝐞𝐱𝐭𝐆𝐞𝐧*\n\n` +
              `𝐇𝐞𝐥𝐥𝐨 @${id.split("@")[0]}\n\n` +
              `𝐇𝐨𝐧𝐨𝐫𝐞𝐝 𝐭𝐨 𝐡𝐚𝐯𝐞 𝐲𝐨𝐮 𝐡𝐞𝐫𝐞\n` +
              `𝐘𝐨𝐮𝐫 𝐩𝐫𝐞𝐬𝐞𝐧𝐜𝐞 𝐚𝐝𝐝𝐬 𝐯𝐚𝐥𝐮𝐞 🌟\n\n` +
              `𝐒𝐡𝐚𝐫𝐞 𝐤𝐧𝐨𝐰𝐥𝐞𝐝𝐠𝐞, 𝐠𝐫𝐨𝐰 𝐭𝐨𝐠𝐞𝐭𝐡𝐞𝐫\n` +
              `𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐚𝐛𝐨𝐚𝐫𝐝! 🚀${signature}`,
            mentions: [id],
          });
        }
        return;
      }

      // 11. .lockchaton
      if (isAdmin && cmd.startsWith(".lockchaton")) {
        if (!mentionedJids.length)
          return sock.sendMessage(from, {
            text: `⚠️ *𝐌𝐞𝐧𝐭𝐢𝐨𝐧 𝐔𝐬𝐞𝐫*\n𝐓𝐚𝐠 𝐬𝐨𝐦𝐞𝐨𝐧𝐞 𝐭𝐨 𝐦𝐮𝐭𝐞 🎯${signature}`,
          });
        if (mentionedJids.some((id) => isDeveloper(id)))
          return sock.sendMessage(from, {
            text: `🛡️ *𝐏𝐫𝐨𝐭𝐞𝐜𝐭𝐞𝐝*\n𝐔𝐬𝐞𝐫 𝐜𝐚𝐧𝐧𝐨𝐭 𝐛𝐞 𝐦𝐮𝐭𝐞𝐝 🚫${signature}`,
          });

        if (!lockedUsers.has(from))    lockedUsers.set(from, new Set());
        if (!lockedCounters.has(from)) lockedCounters.set(from, {});
        for (const id of mentionedJids) {
          lockedUsers.get(from).add(id);
          lockedCounters.get(from)[id] = 0;
          await sock.sendMessage(from, {
            text: `🔇 *𝐔𝐬𝐞𝐫 𝐌𝐮𝐭𝐞𝐝*\n\n@${id.split("@")[0]} 𝐦𝐮𝐭𝐞𝐝\n𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬 𝐰𝐢𝐥𝐥 𝐛𝐞 𝐝𝐞𝐥𝐞𝐭𝐞𝐝${signature}`,
            mentions: [id],
          });
        }
        saveLockedUsers();
        return;
      }

      // 12. .lockchatoff
      if (isAdmin && cmd.startsWith(".lockchatoff")) {
        if (!mentionedJids.length)
          return sock.sendMessage(from, {
            text: `⚠️ *𝐌𝐞𝐧𝐭𝐢𝐨𝐧 𝐔𝐬𝐞𝐫*\n𝐓𝐚𝐠 𝐬𝐨𝐦𝐞𝐨𝐧𝐞 𝐭𝐨 𝐮𝐧𝐦𝐮𝐭𝐞 🎯${signature}`,
          });
        if (!lockedUsers.has(from))    lockedUsers.set(from, new Set());
        if (!lockedCounters.has(from)) lockedCounters.set(from, {});
        for (const id of mentionedJids) {
          lockedUsers.get(from).delete(id);
          lockedCounters.get(from)[id] = 0;
          await sock.sendMessage(from, {
            text: `🔊 *𝐔𝐬𝐞𝐫 𝐔𝐧𝐦𝐮𝐭𝐞𝐝*\n\n@${id.split("@")[0]} 𝐮𝐧𝐦𝐮𝐭𝐞𝐝\n𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐛𝐚𝐜𝐤! ✅${signature}`,
            mentions: [id],
          });
        }
        saveLockedUsers();
        return;
      }

      // 13. .lockedlist
      if (isAdmin && cmd.startsWith(".lockedlist")) {
        const list = lockedUsers.get(from);
        if (!list?.size)
          return sock.sendMessage(from, {
            text: `📋 *𝐍𝐨 𝐔𝐬𝐞𝐫𝐬 𝐌𝐮𝐭𝐞𝐝*\n𝐆𝐫𝐨𝐮𝐩 𝐢𝐬 𝐟𝐫𝐞𝐞 🆓${signature}`,
          });
        const mentions = Array.from(list);
        let out = "📋 *Muted Users List:*\n\n";
        for (const id of mentions) out += `🔇 @${id.split("@")[0]}\n`;
        await sock.sendMessage(from, { text: out + signature, mentions });
        return;
      }

      // 14. .unlockall
      if (isAdmin && cmd.startsWith(".unlockall")) {
        lockedUsers.set(from, new Set());
        lockedCounters.set(from, {});
        await sock.sendMessage(from, {
          text: `🔊 *𝐀𝐥𝐥 𝐔𝐧𝐦𝐮𝐭𝐞𝐝*\n𝐄𝐯𝐞𝐫𝐲𝐨𝐧𝐞 𝐜𝐚𝐧 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐭𝐞 ✅${signature}`,
        });
        saveLockedUsers();
        return;
      }

      // Locked user message deletion
      if (lockedUsers.has(from) && lockedUsers.get(from).has(senderStr)) {
        if (botIsAdmin) {
          try {
            await sock.sendMessage(from, { delete: msg.key });
            lockedCounters.get(from)[senderStr] = (lockedCounters.get(from)[senderStr] || 0) + 1;
            if (lockedCounters.get(from)[senderStr] >= 4) {
              if (!botRemovedUsers.has(from)) botRemovedUsers.set(from, new Set());
              botRemovedUsers.get(from).add(senderStr);
              await sock.groupParticipantsUpdate(from, [senderStr], "remove");
              await sock.sendMessage(from, {
                text: `🚫 *𝐔𝐬𝐞𝐫 𝐑𝐞𝐦𝐨𝐯𝐞𝐝*\n@${senderStr.split("@")[0]} 𝐫𝐞𝐦𝐨𝐯𝐞𝐝 𝐚𝐟𝐭𝐞𝐫 𝐢𝐠𝐧𝐨𝐫𝐢𝐧𝐠 𝐦𝐮𝐭𝐞 🚫${signature}`,
                mentions: [senderStr],
              });
              lockedUsers.get(from).delete(senderStr);
              lockedCounters.get(from)[senderStr] = 0;
              saveLockedUsers();
            }
          } catch (_) {}
        }
        return;
      }
    } catch (err) {
      console.error("Message handler error:", err);
    }
  });

  console.log("✅ Nina Bot started. Scan QR if needed.");
}

process.on("SIGINT",  () => { saveLockedUsers(); saveGroupSettings(); process.exit(); });
process.on("SIGTERM", () => { saveLockedUsers(); saveGroupSettings(); process.exit(); });

startBot().catch((err) => {
  console.error("💥 Bot failed to start:", err.message);
  process.exit(1);
});