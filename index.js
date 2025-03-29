require("dotenv").config();
const express = require("express");
const { Client } = require("@line/bot-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("收到LINE訊息"); // 新增這行確認請求
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `你說了：${event.message.text}`,
      });
    }
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`伺服器運行中，監聽 ${PORT} 埠`); // 確保這行存在
});