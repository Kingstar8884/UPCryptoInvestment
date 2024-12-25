require("dotenv").config();
const express = require("express");
const { Telegraf, Scenes } = require("telegraf");
const botSession = require("telegraf").session;
const { Stage, BaseScene, WizardScene } = Scenes;
const axios = require("axios");
const crypto = require("crypto");
const cors = require("cors");
const session = require("express-session");
const { check, validationResult } = require("express-validator");
const flash = require("connect-flash");
const Bottleneck = require("bottleneck");
const path = require("path");
const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);
const stage = new Stage();
const admin = process.env.ADMINS;
const weburl = process.env.WEB_URL;

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

bot.use(botSession());
bot.use(stage.middleware());

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
  ctx.reply("Oops, something went wrong! Please try again later");
});

const {
  connectToDatabase,
  addUser,
  getUser,
  updateUser,
  allUser,
  topReferrals,
  completedTask,
  pendingTask,
  findTask,
  updateTask,
  totalUsers,
  starkNilX,
  addTasks,
} = require("./src/db/db");
let adSessions = {};

function generateToken() {
  return Math.random().toString(36).substr(2);
}

async function generateWallet(u) {
  try {
    const res = await axios.post(
      "https://api.oxapay.com/merchants/request/staticaddress",
      {
        merchant: process.env.MERCHANT_KEY,
        currency: "USDT",
        network: "TRC20",
        callbackUrl: `${weburl}/paidio?userId=${u}`,
      }
    );

    let generatedAddress = res.data.address;
    let stat = res.data.result;

    console.log(res.data);

    if (stat == "100") {
      return generatedAddress;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error generating address:", error);
    return null;
  }
}

const corsOptions = {
  methods: "GET,HEAD,PUT,PATCH,POST",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

connectToDatabase()
  .then(() => {})
  .catch(async (err) => {
    console.log("Error connecting to database");
    console.log(err);
  });

app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", __dirname + "/src/views");

app.use(
  session({
    secret: process.env.SESSION_SECRET_KEY,
    resave: false,
    saveUninitialized: true,
  })
);

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const newUser = await getUser(userId);

  if (!newUser) {
    let upline = null;
    let claimRef = ctx.message.text.split(" ")[1];

    const add = await generateWallet(userId);

    if (!add) {
      return ctx.reply(
        "Oops! Sorry, An error occured while try to create an account for you please, try again later."
      );
    }

    if (
      claimRef &&
      !isNaN(claimRef) &&
      claimRef.length == 10 &&
      claimRef != userId
    ) {
      upline = claimRef;

      await updateUser(parseFloat(upline), {
        $inc: {
          referral: 1
        },
        $push: {
          downlines: userId,
        },
      });

      ctx.telegram.sendMessage(
        upline,
        "➕ New user just joined through your link!"
      );
    }

    await addUser({
      tg_id: userId,
      balance: 0,
      deposits: 0,
      earnings: 0,
      referral: 0,
      referEarning: 0,
      ghs: 1,
      address: add,
      upline: upline,
      downlines: [],
      max_mining: 0.1,
      last_mined_time: Date.now(),
      canWithdraw: true,
      ban: false,
    });
  }

  if (newUser && newUser.ban) {
    return;
  }

  const pl = 'https://i.ibb.co/Jxq9MQK/IMG-5231.jpg';

  ctx.replyWithPhoto(pl, {
    caption: `
<b>💎 Earn 10% profit on all your deposits in just 1 hour! 💎</b>

🔐 Your investments are safe, and profits are <b>instantly withdrawable.</b>

<b>💰 How it works:</b>
1️⃣ Deposit USDT into your account.
2️⃣ Earn a guaranteed 10% profit within 1 hour.
3️⃣ Withdraw your funds instantly—no delays!

Start your journey to fast and reliable earnings today! 🌟
`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Earn now",
              web_app: {
                url: weburl,
              },
            }
          ],
          [
            {
              text: "Join community",
              url: process.env.CHANNEL_URL,
            }
          ]
        ],
      },
    }
  );
});

const renderHome = async (userdata, res) => {
  const {
    tg_id,
    balance,
    max_mining,
    last_mined_time,
    address,
    deposits,
    earnings,
    ghs,
    u,
  } = userdata;

  const user = u;

  const un = user.first_name || user.last_name;

  const bLink = `https://t.me/${process.env.BOT_LINK}?start=${tg_id}`;

  return res.render("home", {
    balance: balance,
    address,
    deposits,
    earnings,
    ghs,
    max_mining,
    last_mined_time,
    un,
    bLink,
  });
};

app.get("/", async (req, res) => {
  res.render("index");
});

app.post("/validate-user", async (req, res) => {
  try {
    const { initData, initDataUnsafe } = req.body.data;

    if (
      !initDataUnsafe ||
      Object.keys(initDataUnsafe).length === 0 ||
      !initData
    ) {
      console.log("Invalid request 1");
      return res.redirect("failed");
    }

    const { query_id, user, auth_date, hash } = initDataUnsafe;

    if (!query_id || !user || !auth_date || !hash) {
      console.log("Invalid request 2");
      return res.redirect("failed");
    }

    const init = new URLSearchParams(initData);
    const hashh = init.get("hash");
    init.delete("hash");

    const dataToCheck = [...init.entries()]
      .map(([key, value]) => `${key}=${decodeURIComponent(value)}`)
      .sort()
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secret)
      .update(dataToCheck)
      .digest("hex");

    if (calculatedHash === hashh) {
      console.log("User validated successfully.");
      req.session.user = user.id;
      return res.redirect("/home");
    } else {
      console.log("Invalid user data.");
      return res.redirect("failed");
    }
  } catch (err) {
    console.log("An error occurred " + err);
    return res.redirect("failed");
  }
});

app.get("/failed", async (req, res) => {
  return res.render("error");
});

app.get("/home", async (req, res) => {
  const userId = parseFloat(req.session.user);

  if (isNaN(userId)) {
    console.log("Invalid user id");
    return res.render("error");
  }
  const userdata = await getUser(userId);

  if (!userdata) {
    console.log("User not in database");
    res.render("error");
    return;
  }

  if (userdata.ban) {
    res.render("error");
    return;
  }

  const user = await bot.telegram.getChat(userdata.tg_id);

  userdata.u = user;

  renderHome(userdata, res);
});

app.get("/claim", async (req, res) => {
  const userId = parseFloat(req.session.user);

  if (isNaN(userId)) {
    console.log("Invalid user id");
    return res.json({
      suc: false,
    });
  }
  const userdata = await getUser(userId);

  //console.log(userdata)
  if (!userdata) {
    console.log("User not in database");
    return res.json({
      suc: false,
    });
    return;
  }

  if (userdata.ghs == 0 || userdata.max_mining == 0) {
    console.log("No ghs or mining");
    return res.json({
      suc: false,
    });
    return;
  }

  const { last_mined_time, max_mining, upline } = userdata;
  const currentTime = Date.now();
  const earningsPerHour = max_mining;
  const elapsedTimeInHours = (currentTime - last_mined_time) / (1000 * 60 * 60);

  const totalEarnings = elapsedTimeInHours * earningsPerHour;

  if (totalEarnings < max_mining) {
    console.log("Not yet time to claim for " + userId);
    return res.json({
      suc: false,
    });
    return;
  }

  await updateUser(userdata.tg_id, {
    $set: {
      last_mined_time: Date.now(),
      max_mining: 0,
      ghs: 0,
    },
    $inc: {
      balance: max_mining,
      earnings: max_mining,
    },
  });

  console.log("claim " + totalEarnings + " for " + userId);

  res.json({
    suc: true,
    bb: parseFloat(
      (userdata.balance + totalEarnings).toFixed(1)
    ).toLocaleString(),
    ll: Date.now(),
    tt: (userdata.earnings + totalEarnings).toFixed(3),
  });

  if (max_mining === 0.1 || !upline || (max_mining / (1.1)) < 20) {
    return;
  }

  const uplineUser = await getUser(parseFloat(upline));

  if (!uplineUser) {
    console.log("Invalid upline");
    console.log(uplineUser);
    return;
  }

  let amm = (max_mining - max_mining / (1 + 0.1)) * 0.05;

  await updateUser(parseFloat(upline), {
    $inc: {
      balance: amm,
      referEarning: amm,
    },
  });

  bot.telegram.sendMessage(
    upline,
    "<b>🎉 Congratulations!</b> You Just Got " +
      amm +
      " USDT from a Referral earnings.",
    { parse_mode: "HTML" }
  );

  return;
});

app.post("/paidio", async (req, res) => {
  const u = Number(req.query.userId);
  const deals = req.body;

  console.log(deals);

  if (!u || !deals) {
    res.status(400).send("Missing userId or deals in request.");
    console.log("missing id or data");
    return;
  }

  if (isNaN(u)) {
    res.status(400).send("Thanks.");
    console.log("Invalid id");
    return;
  }

  res.status(200).send("Webhook received successfully.");
  console.log("Received data of " + u);

  const user = await getUser(u);

  if (!user) {
    console.log("Can't find user " + user);
    return;
  }

  const { status, txID, amount } = deals;

  if (!amount || !txID || !status) {
    console.log("Incorrect datas");
    return;
  }

  if (status === "Confirming") {
    bot.telegram.sendMessage(
      u,
      `📥<b> You have an incoming deposit of ${amount} USDT</b>\n\n⌛️ <i>Confirmed  1/3...</i>`,
      {
        parse_mode: "HTML",
      }
    );
    return;
  }

  if (status === "paid") {
    if (amount < 20) {
      bot.telegram.sendMessage(
        u,
        `📥 You have deposited ${amount} USDT which is less than the minimum deposit`
      );
      return;
    }

    bot.telegram.sendMessage(u, `📥 You have deposited ${amount} USDT`);

    bot.telegram.sendMessage(
      u,
      `
<b> ⭐️ USDT Deposit Confirmed

USERID:</b> ${u}
<b>DEPOSITED AMOUNT:</b> ${amount} USDT
Your USDT deposit is now active and earning! View your transaction here:
<a href="https://tronscan.org/transaction/#/${txID}">${txID}</a><i>

Maximize your earnings with USDT Investment! Deposit and start receiving hiurly commission <a href="t.me/LtcDragonInvestBot?start=${u}">here.</a></i>`,
      {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }
    );

    await updateUser(u, {
      $inc: {
        deposits: amount,
      },
      $set: {
        max_mining: amount * 1.1,
        ghs: amount * 10,
        last_mined_time: Date.now(),
      },
    });
    console.log("done");
  } else {
    console.log("Status != paid");
  }

});

app.post("/www", async (req, res) => {
  const { address, amount } = req.body;

  const userId = parseFloat(req.session.user);

  if (isNaN(userId)) {
    console.log("Invalid user id");
    return res.status(401).json({
      suc: false,
      message: "Invalid user ID",
    });
  }

  const userdata = await getUser(userId);

  if (!userdata) {
    console.log("User not found in the database");
    return res.status(401).json({
      suc: false,
      message: "User not found",
    });
  }

  if (!address || !amount) {
    return res.status(400).json({
      suc: false,
      message: "Address and amount are required.",
    });
  }

  if (amount <= 0) {
    return res.status(400).json({
      suc: false,
      message: "Invalid withdrawal amount.",
    });
  }

  if (amount > userdata.balance) {
    return res.status(400).json({
      suc: false,
      message: "Withdrawal amount exceeds balance.",
    });
  }

  const bott = await starkNilX.getBot();

  if (!bott) {
    return res.status(500).json({
      suc: false,
      message: "Something went wrong. Please try again later.",
    });
  }

  if (!bot.withdrawal || bott.withdrawal === "disabled") {
    return res.status(500).json({
      suc: false,
      message: "Withdrawal is currently disabled.",
    });
  }

  const url = "https://api.oxapay.com/api/send";
  const data = {
    key: process.env.PAYOUT_KEY,
    address: address,
    amount: amount,
    currency: "USDT",
    network: "TRC20",
    callbackUrl: "",
  };

  try {
    const response = await axios.post(url, data);
    console.log(response.data);

    if (response.data.result != "100") {
      return res.status(500).json({
        suc: false,
        message: "Withdrawal failed. Please try again later.",
      });
    }

    await updateUser(userId, {
      $inc: {
        balance: -parseFloat(amount),
      },
    });

    res.status(200).json({
      suc: true,
      message: "Withdrawal successful!",
    });

    bot.telegram.sendMessage(
      userId,
      `💰 <b>Withdrawal Successful</b>\n\n💰 <b>Withdrawal Amount:</b> ${amount.toFixed(
        8
      )} USDT\n\n⏳ <b>Withdrawal Status:</b> <i>sent</i>\n\n💰 <b>Please wait for the transaction to be confirmed</b>\n`,
      {
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    res.status(500).json({
      suc: false,
      message: "Withdrawal failed. Please try again later.",
    });

    console.error(error.response?.data || error.message);

    bot.telegram.sendMessage(
      userId,
      `💰 <b>Withdrawal Successful</b>\n\n💰 <b>Withdrawal Amount:</b> ${amount.toFixed(
        8
      )} USDT\n\n⏳ <b>Withdrawal Status:</b> <i>sent</i>\n\n💰 <b>Please wait for the transaction to be confirmed</b>\n`,
      {
        parse_mode: "HTML",
      }
    );

    return;
  }
});

const validAdmin = (ctx, next) => {
  if (admin && admin.includes(ctx.from.id)) {
    next();
    return;
  }
  ctx.reply("You are not authorized to use this command");
};


bot.hears("/Panel", validAdmin, async (ctx) => {
  const user_count = await starkNilX.totalUsers();
  const bott = await starkNilX.getBot();

  const txt = `
Welcome ${ctx.from.first_name} to Admin Panel!
  
Total Users : ${user_count} 
Withdrawal status: ${
    bott.withdrawal === "disabled" ? "⛔️ disabled" : "✅ enabled"
  }
  
Here you can edit most of settings of the Bot.
  `;

  ctx.replyWithHTML(txt, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🔊Send Broadcast",
            callback_data: "/broadcast",
          },
        ],
        [
          {
            text: "⛔️ Ban User",
            callback_data: "/ban",
          },
          {
            text: "✅ Unban User",
            callback_data: "/unban",
          },
        ],
        [
          {
            text: "💶 Add balance",
            callback_data: "/addbal",
          },
          {
            text: "➖ Remove Balance",
            callback_data: "/removebal",
          },
        ],
        [
          {
            text: "🧳 Check balance",
            callback_data: "/checkbal",
          },
          {
            text: "❌ Banned Users",
            callback_data: "/bannedUsers",
          },
        ],
        [
          {
            text: "✅ Enable Withdrawals",
            callback_data: "/activate_1",
          },
        ],
        [
          {
            text: "❌ Disable Withdrawals",
            callback_data: "/activate_0",
          },
        ],
      ],
    },
  });
});


bot.action("/broadcast", validAdmin, async (ctx) => {
  ctx.answerCbQuery();
  await ctx.reply("Wait fetching all user in the database...");

  const all_users = await starkNilX.aggregate([
    { $match: { status: "Active" } },
    { $project: { _id: 0, tg_id: 1 } },
    { $group: { _id: null, userIds: { $push: "$tg_id" } } },
    { $project: { _id: 0, userIds: 1 } },
  ]);

  let all_user = all_users.length > 0 ? all_users[0].userIds : [];

  const inactive_user = await starkNilX.aggregates([
    { $match: { status: "Inactive" } },
    { $count: "inactiveUserCount" },
  ]);
  let inactiveUser = 0;
  if (inactive_user) {
    inactiveUser = inactive_user.inactiveUserCount;
  } else {
    inactiveUser = 0;
  }

  await ctx.replyWithHTML(
    "<b>All User Fetched Successfully</b>\n" +
      (all_user.length + inactiveUser) +
      " Users\n" +
      all_user.length +
      " Active User(s)\n" +
      inactiveUser +
      " Inactive User(s)"
  );
  const broad = new BaseScene("broad");
  broad.enter((ctx) => {
    ctx.reply("Enter the message you want to send");
  });
  broad.use(async (ctx) => {
    await ctx.scene.leave();
    await ctx.reply("Broadcasting message to all users...");
    let sucs = 0;
    let failed = 0;
    const MESSAGE_RATE_LIMIT = 30;

    const sendMessage = async (chatId) => {
      try {
        await ctx.telegram.copyMessage(
          chatId,
          ctx.chat.id,
          ctx.message.message_id
        );
        sucs++;
        updateUser(chatId, {
          $set: {
            status: "Active",
          },
        });
      } catch (error) {
        updateUser(chatId, {
          $set: {
            status: "Active",
          },
        });
        failed++;
        console.error(`Error: ${error.message}`);
      }
    };

    const limiter = new Bottleneck({
      minTime: 1000 / MESSAGE_RATE_LIMIT,
      maxConcurrent: 1,
    });

    const processMessages = async (userIds) => {
      const promises = userIds.map((userId) =>
        limiter.schedule(() => sendMessage(userId))
      );
      await Promise.all(promises);
    };

    processMessages(all_user)
      .then(() => {
        ctx.replyWithHTML(
          `<b>🔊 Broadcast Completed Successfully\n\n✅ Successful:</b> ${sucs} User(s)\n<b>⛔️ Failed:</b> ${failed} User(s)`
        );
        console.log("All messages have been sent.");
      })
      .catch((error) => {
        console.error(`Failed to send messages: ${error.message}`);
      });
  });
  stage.register(broad);
  ctx.scene.enter("broad");
});

bot.action("/ban", validAdmin, async (ctx) => {
  ctx.answerCbQuery();
  const banScene = new BaseScene("ban");
  banScene.enter((ctx) => ctx.reply("Please send the user id to ban"));
  banScene.on("text", async (ctx) => {
    await ctx.scene.leave();
    const userId = ctx.message.text;

    const user = await getUser(parseFloat(userId));
    if (!user) {
      return ctx.reply("User not found");
    }
    await updateUser(parseFloat(userId), { $set: { ban: true } });
    ctx.reply("User banned successfully");
  });

  stage.register(banScene);
  ctx.scene.enter("ban");
});

bot.action("/unban", validAdmin, async (ctx) => {
  ctx.answerCbQuery();
  const banScene = new BaseScene("unban");
  banScene.enter((ctx) => ctx.reply("Please send the user id to unban"));
  banScene.on("text", async (ctx) => {
    await ctx.scene.leave();
    const userId = ctx.message.text;

    const user = await getUser(parseFloat(userId));
    if (!user) {
      return ctx.reply("User not found");
    }
    await updateUser(parseFloat(userId), { $set: { ban: false } });
    ctx.reply("User unbanned successfully");
  });
  stage.register(banScene);
  ctx.scene.enter("unban");
});

bot.action("/addbal", validAdmin, async (ctx) => {
  ctx.answerCbQuery();
  let userId;

  const text = new WizardScene(
    "addbal",
    async (ctx) => {
      await ctx.reply("Send the user id to add balance");
      return ctx.wizard.next();
    },
    async (ctx) => {
      userId = ctx.message.text;
      const user = await getUser(parseFloat(userId));
      if (!user) {
        return ctx.reply("User not found");
      }
      await ctx.reply("Send the amount to add");
      return ctx.wizard.next();
    },
    async (ctx) => {
      const amount = parseFloat(ctx.message.text);

      await updateUser(parseFloat(userId), { $inc: { balance: amount } });
      ctx.telegram.sendMessage(
        userId,
        "Your balance has been credited with " + amount
      );

      ctx.reply("Balance added successfully");
      return ctx.scene.leave();
    }
  );

  stage.register(text);
  ctx.scene.enter("addbal");
});

bot.action("/removebal", validAdmin, async (ctx) => {
  ctx.answerCbQuery();
  let userId;
  const text = new WizardScene(
    "rembal",
    async (ctx) => {
      await ctx.reply("Send the user id to remove balance");
      return ctx.wizard.next();
    },
    async (ctx) => {
      userId = ctx.message.text;
      const user = await getUser(parseFloat(userId));
      if (!user) {
        return ctx.reply("User not found");
      }
      await ctx.reply("Send the amount to remove");
      return ctx.wizard.next();
    },
    async (ctx) => {
      const amount = parseFloat(ctx.message.text);

      await updateUser(parseFloat(userId), { $inc: { balance: -amount } });
      ctx.telegram.sendMessage(
        userId,
        "your balance has been deducted by " + amount
      );

      ctx.reply("Balance removed successfully");
      return ctx.scene.leave();
    }
  );

  stage.register(text);
  ctx.scene.enter("rembal");
});

bot.action("/checkbal", validAdmin, async (ctx) => {
  ctx.answerCbQuery();
  const text = new BaseScene("text");
  text.enter((ctx) => ctx.reply("Send the user id to check balance"));
  text.on("text", async (ctx) => {
    await ctx.scene.leave();
    const txt = ctx.message.text;
    const user = await getUser(parseFloat(txt));
    if (!user) {
      return ctx.reply("User not found");
    }
    ctx.reply("Balance of " + txt + "\n\n Balance: " + user.balance + " USDT");
  });
  stage.register(text);
  ctx.scene.enter("text");
});

bot.action("/bannedUsers", validAdmin, async (ctx) => {
  ctx.answerCbQuery();
  const banned = await starkNilX.find({ ban: true });
  if (banned.length == 0) {
    return ctx.reply("No banned users yet");
  }
  let txt =
    "<b>🚫 #BANNED_USERS\n🔢 Total banned</b>: " + banned.length + " Users\n\n";
  for (const user of banned) {
    const { tg_id } = user;
    txt += "<b>🆔 UserId:</b> <code>" + userId + "</code>\n";
  }
  await ctx.replyWithHTML(txt, {
    parse_mode: "HTML",
  });
});

bot.action(/\/activate_(.+)/, validAdmin, async (ctx) => {
  ctx.answerCbQuery();

  const type = ctx.match[1];
  if (type === "1") {
    await starkNilX.updateBot({
      $set: {
        withdrawal: "enabled",
      },
    });
    ctx.reply("✅ Withdrawal has been enabled successfully");
  } else {
    await starkNilX.updateBot({
      $set: {
        withdrawal: "disabled",
      },
    });
    ctx.reply("⛔️ Withdrawal has been disabled successfully");
  }
});

const port = process.env.PORT;

bot.launch({ dropPendingUpdates: true });

app
  .listen(port, () => {
    console.log(`Server is running on port ${port}`);
  })
  .on("error", (err) => {
    console.error("Server error:", err);
  });
