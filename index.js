require("dotenv").config();
const express = require("express");
const { Client } = require("@line/bot-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// 验证环境变量
if (!process.env.LINE_ACCESS_TOKEN || !process.env.LINE_CHANNEL_SECRET) {
  console.error("❌ 错误：缺少 LINE 凭证环境变量");
  process.exit(1);
}

// LINE 配置
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(config);

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查路由
app.get("/", (req, res) => {
  res.status(200).json({ 
    status: "running",
    timestamp: new Date().toISOString()
  });
});

// Webhook 路由 (优化版)
app.post("/webhook", async (req, res) => {
  try {
    console.log("📩 收到 LINE 请求:", JSON.stringify(req.body, null, 2));
    
    if (!req.body.events) {
      return res.status(400).json({ error: "无效的请求格式" });
    }

    // 并行处理所有事件
    await Promise.all(req.body.events.map(async (event) => {
      try {
        if (event.type !== "message" || event.message.type !== "text") return;
        
        console.log(`💬 收到用户消息: ${event.message.text}`);
        
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `机器人已收到：${event.message.text}`
        });
      } catch (err) {
        console.error("⚠️ 处理单条事件时出错:", err);
      }
    }));

    res.status(200).end();
  } catch (err) {
    console.error("❌ Webhook 处理失败:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 服务器已启动，监听端口: ${PORT}`);
  console.log(`🔗 本地访问: http://localhost:${PORT}`);
  console.log(`📝 环境变量检查:`);
  console.log(`   - LINE_ACCESS_TOKEN: ${process.env.LINE_ACCESS_TOKEN ? '已设置' : '未设置'}`);
  console.log(`   - LINE_CHANNEL_SECRET: ${process.env.LINE_CHANNEL_SECRET ? '已设置' : '未设置'}\n`);
});

// 捕获未处理的Promise错误
process.on("unhandledRejection", (err) => {
  console.error("⚠️ 未处理的Promise拒绝:", err);
});