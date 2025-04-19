console.log("✅ Loaded ENV:", {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  accessToken: process.env.LINE_ACCESS_TOKEN,
});

const { classifyMessage, getBusinessDate } = require("./keywords");
require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const cron = require("node-cron");

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const dailyLog = {};

app.use(express.json());

// 🔔 接收 LINE webhook
app.post("/webhook", line.middleware(config), async (req, res) => {
  console.log("🚨 收到 webhook 請求！");
  const events = req.body.events;

  try {
    for (const event of events) {
      // 防呆：略過非文字訊息 or 無效測試訊息
      if (
        event.type !== "message" ||
        event.message.type !== "text" ||
        !event.replyToken ||
        event.replyToken === "00000000000000000000000000000000"
      ) {
        console.log("⚠️ 略過非處理訊息或驗證訊息");
        continue;
      }

      const text = event.message.text;
      const userId = event.source.userId || "未知用戶";
      const groupId = event.source.groupId || process.env.DEFAULT_GROUP_ID;
      console.log("🆔 群組 ID：", groupId);

      let userName = "未知用戶";
      try {
        const profile = await client.getProfile(userId);
        userName = profile.displayName;
      } catch (e) {
        console.warn("⚠️ 無法取得使用者名稱，可能來自群組");
      }

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
    }

    res.sendStatus(200); // 回應成功
  } catch (err) {
    console.error("❗️ webhook 處理錯誤：", err);
    res.sendStatus(500); // 回應失敗
  }
});

// ⏰ 每天 23:30 自動推播打卡報表
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
  const groupId = process.env.DEFAULT_GROUP_ID;
  if (groupId && groupId !== "PLACEHOLDER_GROUP_ID") {
    await client.pushMessage(groupId, {
      type: "text",
      text: finalMsg,
    });
    console.log("✅ 已推播每日報表");
  } else {
    console.warn("⚠️ 無法推播，DEFAULT_GROUP_ID 尚未設定");
  }

  delete dailyLog[today];
});

// 🚀 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 伺服器已啟動，監聽埠：${PORT}`);
});
