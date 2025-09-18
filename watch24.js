// watch24.js
const pigpio = require("pigpio-client");

const client = pigpio.pigpio();

client.once("connected", () => {
  console.log("[watch24] Connected to pigpiod");

  const gpio = client.gpio(24);

  // Ensure input mode
  gpio.modeSet("input");

  // Explicitly disable pull-up/down (let pigs handle it)
  // gpio.pullUpDown(0); // not needed if pigs pud already set

  // Subscribe to notifications
  gpio.notify((level, tick) => {
    console.log(`[GPIO24 notify] level=${level} at tick=${tick}`);
  });

  // Poll current state every second for debugging
  setInterval(() => {
    gpio.read((err, value) => {
      if (err) {
        console.error("Read error:", err);
      } else {
        console.log(`[GPIO24 poll] value=${value}`);
      }
    });
  }, 1000);
});

client.on("error", (err) => {
  console.error("[watch24] Error:", err);
});

client.on("disconnected", () => {
  console.log("[watch24] Disconnected from pigpiod");
});
