// keywords.js
const KEYWORDS = {
  "上班打卡": ["備車", "出勤", "報到", "上課"],
  "下班打卡": ["下課", "下山", "回家"],
  "誤餐（早）": ["早"],
  "誤餐（中）": ["中"],
  "誤餐（晚）": ["晚"],
  "誤餐（宵）": ["宵", "宵夜"]
};

function classifyMessage(text) {
  for (const [type, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return type;
    }
  }
  return null;
}

function getBusinessDate() {
  const now = new Date();
  if (now.getHours() < 5) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().split("T")[0];
}

module.exports = {
  classifyMessage,
  getBusinessDate,
};
