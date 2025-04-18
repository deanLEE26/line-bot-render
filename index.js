const { classifyMessage, getBusinessDate } = require("./keywords");
require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const dailyLog = {};

app.use(express.json());

app.post("/webhook", line.middleware(config), async (req, res) => {
  console.log("🚨 收到 webhook 請求！");
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text;
      const userId = event.source.userId || "未知用戶";
      const groupId = event.source.groupId || process.env.DEFAULT_GROUP_ID;
      console.log("🆔 這是你群組的 ID：", event.source.groupId);

      try {
        const profile = await client.getProfile(userId);
        const userName = profile.displayName;
        const type = classifyMessage(text);
        const businessDate = getBusinessDate();

        if (type) {
          if (!dailyLog[businessDate]) dailyLog[businessDate] = {};
          if (!dailyLog[businessDate][userName]) dailyLog[businessDate][userName] = [];
          dailyLog[businessDate][userName].push(type);

          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `${type}紀錄成功 ✅`,
          });
        } else {
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `你說了：「${text}」，尚未設定為打卡關鍵字喔！`,
          });
        }
      } catch (err) {
        console.error("❗️ 錯誤：", err);
      }
    }
  }

  res.sendStatus(200);
});

// 每天 23:30 自動推播打卡報表
cron.schedule("30 23 * * *", async () => {
  const today = getBusinessDate();
  const records = dailyLog[today];
  if (!records) return;

  let summary = `📅 ${today} 打卡紀錄\n`;
  let issues = `\n⚠️ 打卡異常檢查\n`;

  for (const [user, logs] of Object.entries(records)) {
    const uniqueLogs = [...new Set(logs)];
    summary += `👤 ${user}：${uniqueLogs.join("、")}\n`;

    if (uniqueLogs.includes("上班打卡") && !uniqueLogs.includes("下班打卡")) {
      issues += `- ${user}：❌ 上班已打，下班未打\n`;
    }
    if (!uniqueLogs.includes("上班打卡") && uniqueLogs.includes("下班打卡")) {
      issues += `- ${user}：❌ 下班已打，上班未打\n`;
    }

    const mealTags = ["誤餐（早）", "誤餐（中）", "誤餐（晚）", "誤餐（宵）"];
    const missed = mealTags.filter(tag => !uniqueLogs.includes(tag));
    if (missed.length > 0 && mealTags.some(tag => uniqueLogs.includes(tag))) {
      issues += `- ${user}：❌ 誤餐缺少 ${missed.join("、")}\n`;
    }
  }

  const finalMsg = summary + issues;
  await client.pushMessage(process.env.DEFAULT_GROUP_ID, {
    type: "text",
    text: finalMsg,
  });

  delete dailyLog[today];
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器已啟動，監聽埠：${PORT}`);
});
