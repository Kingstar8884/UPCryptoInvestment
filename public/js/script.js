document.addEventListener(
  "touchstart",
  function (event) {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  },
  { passive: false }
);
document.addEventListener("gesturestart", function (e) {
  e.preventDefault();
});

function notify(n, t) {
  setTimeout(() => {
    nn.classList.remove("animate");
  }, 2000);

  const nn = document.querySelector("#notifications");

  if (!n) {
    nn.style.backgroundColor = "red";
  } else {
    nn.style.backgroundColor = "rgb(11, 97, 11)";
  }

  nn.textContent = t;

  nn.classList.add("animate");

  Telegram.WebApp.HapticFeedback.notificationOccurred(
    n == true ? "success" : "error"
  );
}

function toggleWithdrawPopup() {
  Telegram.WebApp.HapticFeedback.impactOccurred("light");
  const popup = document.getElementById("withdraw-popup");
  popup.classList.toggle("hidden");
}

function toggleDepositPopup() {
  Telegram.WebApp.HapticFeedback.impactOccurred("light");
  const popup = document.getElementById("deposit-popup");
  popup.classList.toggle("hidden");
}

function toggleReferPopup() {
  Telegram.WebApp.HapticFeedback.impactOccurred("light");
  const popup = document.getElementById("refer-popup");
  popup.classList.toggle("hidden");
}

function copyIt(i) {
  if (i === "link") {
    const referralInput = document.querySelector(".refer-box input");
    referralInput.select();
    document.execCommand("copy");
    notify(true, "Referral link copied!");
    return;
  }
  if (i === "address") {
    navigator.clipboard
      .writeText(address)
      .then(() => {
        notify(true, "Deposit wallet copied!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
        notify(false, "Failed to copy wallet address.");
      });
  }
}

function getTotal() {
  const currentTime = Date.now();
  let elapsedTimeInHours = (currentTime - lastTimeMined) / (1000 * 60 * 60);

  elapsedTimeInHours = Math.min(elapsedTimeInHours, 1);

  const t = elapsedTimeInHours * earningsPerHour;
  return t;
}

async function claimEarnings() {
  if (earningsPerHour == 0) {
    notify(false, "Please deposit to activate a miner!");
    return;
  }
  const n = getTotal();

  if (n >= earningsPerHour) {
    try {
      notify(true, "Claiming...");
      const gg = await axios.get("/claim");
      const r = gg.data;

      if (r.suc) {
        lastTimeMined = r.ll;
        document.querySelector("#ee2").textContent = `$${r.tt}`;
        document.querySelector("#bal").textContent = `${r.bb}`;
        document.querySelector("#ghs").textContent = "0 GH/s ⚡️";
        notify(true, "Claimed Successfully!");
      } else {
        notify(false, "You cant claim less than " + earningsPerHour + " USDT!");
      }
    } catch (e) {
      console.log(e);
      notify(false, "Oops! Sorry, An error occured, please try again later!");
    }
  } else {
    notify(false, "You cant claim less than " + earningsPerHour + " USDT!");
  }
}

const intId = setInterval(() => {
  const newMine = getTotal();
  let p = (newMine / earningsPerHour) * 100;
  p = Math.min(p);

  document.querySelector(".mining-value").textContent =
    newMine.toFixed(10) + " USDT";

  document.querySelector("#progress-fill").style.width = `${
    p >= 100 ? 100 : p
  }%`;

  if (p >= 100) {
    document.querySelector("#progress-fill").style.backgroundColor =
      "rgb(140, 9, 9)";
  }

  if (newMine >= earningsPerHour) {
    clearInterval(intId);
  }
}, 100);

document.querySelector("#with").addEventListener("submit", async (e) => {
  e.preventDefault();
  toggleWithdrawPopup();

  console.log(e);

  const am = document.querySelector("#withdraw-amount").value.trim();
  const ad = document.querySelector("#wallet-address").value.trim();

  if (!ad || ad.length < 30) {
    notify(false, "Please enter a valid wallet address!");
    return;
  }

  if (!am || isNaN(am) || Number(am) <= 0) {
    notify(false, "Please enter a valid amount!");
    return;
  }

  try {
    notify(true, "Processing withdrawal...");
    const response = await axios.post("/www", {
      address: ad,
      amount: am,
    });

    if (response.status === 200) {
      notify(true, "Withdrawal successful!");
    } else {
      notify(false, "Withdrawal failed. Please try again!");
    }
  } catch (error) {
    notify(false, error.response?.data?.message || error.message);
  }
});
