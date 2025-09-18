/* MagicMirror Module: MMM-GPIO-Notifications2
 * Node Helper
 */

const NodeHelper = require("node_helper");
const pigpio = require("pigpio-client");

module.exports = NodeHelper.create({
  start: function () {
    this.clients = {};
    this.log("Starting node_helper for module [" + this.name + "]");
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "CONFIG") {
      this.config = payload;
      this.setupGPIO();
    }
  },

  setupGPIO: function () {
    const { host, port, pins } = this.config;

    this.log("[MMM-GPIO-Notifications2] Attempting to connect to pigpiod…");
    this.client = pigpio.pigpio({ host, port });

    this.client.once("connected", (info) => {
      this.log("[MMM-GPIO-Notifications2] Connected to pigpiod:", info);
      this.log("[MMM-GPIO-Notifications2] Setting up pins…");

      pins.forEach((pinConfig) => {
        this.setupPin(pinConfig);
      });
    });

    this.client.once("error", (err) => {
      this.error("Unable to connect to pigpiod:", err);
    });
  },

  setupPin: function (pinConfig) {
    const gpio = this.client.gpio(pinConfig.pin);

    // Apply pull-up/down (0=OFF, 1=DOWN, 2=UP)
    if (pinConfig.pull === "up") {
      gpio.pullUpDown(2);
    } else if (pinConfig.pull === "down") {
      gpio.pullUpDown(1);
    } else {
      gpio.pullUpDown(0);
    }

    // Debounce (in microseconds)
    const debounceMicros = (pinConfig.debounce || 50) * 1000;

    if (pinConfig.type === "BUTTON") {
      this.log(`[MMM-GPIO-Notifications2] Setting up BUTTON on GPIO ${pinConfig.pin}`);

      let pressStart = null;
      let longPressTimer = null;
      let veryLongPressTimer = null;
      let pressType = null; // which type has already fired
      let multiPressCount = 0;
      let multiPressTimer = null;

      const multiPressTimeout = pinConfig.multiPressTimeout || 400; // ms

      gpio.notify((level, tick) => {
        if (level === 1) {
          // Rising edge → button pressed
          pressStart = tick;
          pressType = null;

          // Schedule longPress
          if (pinConfig.notifications?.longPress) {
            longPressTimer = setTimeout(() => {
              if (!pressType) {
                pressType = "longPress";
                this.sendSocketNotification("GPIO_NOTIFICATION", {
                  pin: pinConfig.pin,
                  type: "longPress",
                  notification: pinConfig.notifications.longPress,
                  payload: pinConfig.payload || {}
                });
                this.log(`[MMM-GPIO-Notifications2] Button ${pinConfig.pin} → longPress, sent: ${pinConfig.notifications.longPress}`);
              }
            }, pinConfig.longPress || 2500);
          }

          // Schedule veryLongPress
          if (pinConfig.notifications?.veryLongPress) {
            veryLongPressTimer = setTimeout(() => {
              clearTimeout(longPressTimer);
              if (pressType !== "veryLongPress") {
                pressType = "veryLongPress";
                this.sendSocketNotification("GPIO_NOTIFICATION", {
                  pin: pinConfig.pin,
                  type: "veryLongPress",
                  notification: pinConfig.notifications.veryLongPress,
                  payload: pinConfig.payload || {}
                });
                this.log(`[MMM-GPIO-Notifications2] Button ${pinConfig.pin} → veryLongPress, sent: ${pinConfig.notifications.veryLongPress}`);
              }
            }, pinConfig.veryLongPress || 6000);
          }

        } else if (level === 0 && pressStart !== null) {
          // Falling edge → button released
          const durationMs = ((tick >>> 0) - (pressStart >>> 0)) / 1000;
          pressStart = null;

          clearTimeout(longPressTimer);
          clearTimeout(veryLongPressTimer);

          // If nothing triggered yet → handle short/double/triple press
          if (!pressType && durationMs >= 50) {
            multiPressCount++;
            clearTimeout(multiPressTimer);
            multiPressTimer = setTimeout(() => {
              if (multiPressCount === 1 && pinConfig.notifications?.shortPress) {
                this.sendSocketNotification("GPIO_NOTIFICATION", {
                  pin: pinConfig.pin,
                  type: "shortPress",
                  notification: pinConfig.notifications.shortPress,
                  payload: pinConfig.payload || {}
                });
                this.log(`[MMM-GPIO-Notifications2] Button ${pinConfig.pin} → shortPress, sent: ${pinConfig.notifications.shortPress}`);
              } else if (multiPressCount === 2 && pinConfig.notifications?.doublePress) {
                this.sendSocketNotification("GPIO_NOTIFICATION", {
                  pin: pinConfig.pin,
                  type: "doublePress",
                  notification: pinConfig.notifications.doublePress,
                  payload: pinConfig.payload || {}
                });
                this.log(`[MMM-GPIO-Notifications2] Button ${pinConfig.pin} → doublePress, sent: ${pinConfig.notifications.doublePress}`);
              } else if (multiPressCount >= 3 && pinConfig.notifications?.triplePress) {
                this.sendSocketNotification("GPIO_NOTIFICATION", {
                  pin: pinConfig.pin,
                  type: "triplePress",
                  notification: pinConfig.notifications.triplePress,
                  payload: pinConfig.payload || {}
                });
                this.log(`[MMM-GPIO-Notifications2] Button ${pinConfig.pin} → triplePress, sent: ${pinConfig.notifications.triplePress}`);
              }
              multiPressCount = 0;
            }, multiPressTimeout);
          }
        }
      }, pigpio.EITHER_EDGE, debounceMicros);
    }

    if (pinConfig.type === "PIR") {
      this.log(`[MMM-GPIO-Notifications2] Setting up PIR on GPIO ${pinConfig.pin}`);

      gpio.notify((level) => {
        const notif = level === 1 ? pinConfig.notifications.motionOn : pinConfig.notifications.motionOff;
        if (notif) {
          this.sendSocketNotification("GPIO_NOTIFICATION", {
            pin: pinConfig.pin,
            type: "motion",
            notification: notif,
            payload: pinConfig.payload || {}
          });
          this.log(`[MMM-GPIO-Notifications2] PIR ${pinConfig.pin} → ${notif}`);
        }
      }, pigpio.EITHER_EDGE, debounceMicros);
    }
  },

  log: function (...args) {
    console.log(...args);
  },

  error: function (...args) {
    console.error(...args);
  }
});
