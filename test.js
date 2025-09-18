// test.js
const pigpio = require("pigpio-client").pigpio;
const Gpio = pigpio().gpio;

// Connect to local pigpiod
const pi = pigpio();
pi.once("connected", () => {
  console.log("[TEST] Connected to pigpiod");

  const button = Gpio(24);

  // Set as input with pull-down (0 = off, 1 = pull-down, 2 = pull-up)
  button.modeSet("input");
  button.pullUpDown(1);

  // Watch for changes
  button.notify((level, tick) => {
    console.log(`[TEST] GPIO24 changed to ${level} at ${tick}`);

    if (level === 1) {
      console.log("➡️ BUTTON PRESSED");
    } else {
      console.log("⬅️ BUTTON RELEASED");
    }
  });
});
