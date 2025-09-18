// test-monitor.js - run from module dir: node test-monitor.js
const pigpio = require("pigpio-client");
const client = pigpio.pigpio();
const PIN = 24;

client.once("connected", () => {
  console.log("[TEST] Connected to pigpiod");
  const g = client.gpio(PIN);
  try { g.modeSet("input"); } catch(e) {}
  try { g.pullUpDown(1); } catch(e) {} // try pull-down

  console.log(`[TEST] watching pin ${PIN} (pull-up)`);
  try {
    g.notify((level, tick) => {
      console.log(`[TEST] notify: level=${level} tick=${tick}`);
    });
  } catch (e) {
    console.warn("[TEST] notify() failed:", e);
  }

  // Poll also
  setInterval(() => {
    if (typeof g.read === "function") {
      g.read((err, v) => {
        if (err) return;
        console.log(`[TEST] poll read => ${v}`);
      });
    } else if (typeof g.level !== "undefined") {
      console.log(`[TEST] poll level => ${g.level}`);
    }
  }, 500);
});

client.on("error", (e) => console.error("[TEST] client error:", e));
try {
  if (typeof client.connect === "function") client.connect();
} catch (e) {
  console.warn("[TEST] client.connect threw:", e);
}
