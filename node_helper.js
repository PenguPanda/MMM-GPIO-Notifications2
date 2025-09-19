/* MagicMirror Module: MMM-GPIO-Notifications2
 * Node Helper
 */

const NodeHelper = require("node_helper");
const pigpio = require("pigpio-client");

module.exports = NodeHelper.create({
  start: function () {
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

    this.log("[MMM-GPIO-Notifications2] Connecting to pigpiodâ€¦");
    this.client = pigpio.pigpio({ host, port });

    this.client.once("connected", (info) => {
      this.log("[MMM-GPIO-Notifications2] Connected to pigpiod:", info);

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

    // Pull-up/down
    if (pinConfig.pull === "up") gpio.pullUpDown(2);
    else if (pinConfig.pull === "down") gpio.pullUpDown(1);
    else gpio.pullUpDown(0);

    const debounceMicros = (pinConfig.debounce || 50) * 1000;

    if (pinConfig.type === "BUTTON") {
      this.log(`[MMM-GPIO-Notifications2] Setup BUTTON GPIO ${pinConfig.pin}`);

      let pressStart = null;
      let pressCount = 0;
      let multiPressTimer = null;
      let released = true;

      let checkTimer = null;

      gpio.notify((level) => {
        if (level === 1) {
          // Button pressed
          if (!released) return; // ignore spurious press while already pressed

          pressStart = Date.now();
          released = false;

          // start monitoring
          checkTimer = setInterval(() => {
            if (released || !pressStart) return;
            const elapsed = Date.now() - pressStart;

            if (pinConfig.veryLongPress && elapsed >= pinConfig.veryLongPress) {
              // Fire veryLong once, cancel everything else
              this.fireNotification(pinConfig, "veryLongPress");
              this.log(`[MMM-GPIO-Notifications2] pin ${pinConfig.pin} â†’ veryLongPress fired`);
              clearInterval(checkTimer);
              checkTimer = null;
              pressStart = null;
              released = true; // lock out release
            }
          }, 100);

        } else if (level === 0) {
          // Button released
          if (released) return; // ignore bounce

          released = true;
          const ms = Date.now() - pressStart;
          pressStart = null;

          if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
          }

          this.log(`[MMM-GPIO-Notifications2] pin ${pinConfig.pin} released after ${ms} ms`);

          if (ms < 30) {
            this.log(`[MMM-GPIO-Notifications2] Ignored bounce on pin ${pinConfig.pin}`);
            return;
          }

          // Decide which press type
          if (pinConfig.veryLongPress && ms >= pinConfig.veryLongPress) {
            // already fired inside interval
            return;
          } else if (pinConfig.longPress && ms >= pinConfig.longPress) {
            this.fireNotification(pinConfig, "longPress");
            this.log(`[MMM-GPIO-Notifications2] pin ${pinConfig.pin} â†’ longPress fired`);
          } else {
            // multi press logic
            pressCount++;
            if (multiPressTimer) clearTimeout(multiPressTimer);

            multiPressTimer = setTimeout(() => {
              if (pressCount === 1) {
                this.fireNotification(pinConfig, "shortPress");
                this.log(`[MMM-GPIO-Notifications2] pin ${pinConfig.pin} â†’ decided shortPress`);
              } else if (pressCount === 2) {
                this.fireNotification(pinConfig, "doublePress");
                this.log(`[MMM-GPIO-Notifications2] pin ${pinConfig.pin} â†’ decided doublePress`);
              } else if (pressCount >= 3) {
                this.fireNotification(pinConfig, "triplePress");
                this.log(`[MMM-GPIO-Notifications2] pin ${pinConfig.pin} â†’ decided triplePress`);
              }
              pressCount = 0;
            }, pinConfig.multiPressTimeout || 400);
          }
        }
      }, pigpio.EITHER_EDGE, debounceMicros);
    }

    if (pinConfig.type === "PIR") {
      this.log(`[MMM-GPIO-Notifications2] Setup PIR GPIO ${pinConfig.pin}`);

      gpio.notify((level) => {
        const notif = level === 1 ? pinConfig.notifications.motionOn : pinConfig.notifications.motionOff;
        if (notif) {
          this.sendOut(pinConfig, notif, "motion");
        }
      }, pigpio.EITHER_EDGE, debounceMicros);
    }
  },

  fireNotification: function (pinConfig, type) {
    const notif = pinConfig.notifications?.[type];
    if (!notif) return;

    if (Array.isArray(notif)) {
      notif.forEach((n) => this.sendOut(pinConfig, n, type));
    } else {
      this.sendOut(pinConfig, notif, type);
    }
  },

  // í ½í´§ FIXED: properly handle primitive payloads (numbers, strings, booleans, etc.)
  sendOut: function (pinConfig, notif, type) {
    if (!notif) return;

    let notification, payload;

    if (typeof notif === "string") {
      notification = notif;
      payload = pinConfig.payload || {};
    } else if (typeof notif === "object" && notif.notification) {
      notification = notif.notification;

      if (typeof notif.payload === "object" && notif.payload !== null) {
        // Merge objects
        payload = Object.assign({}, pinConfig.payload || {}, notif.payload);
      } else if (notif.payload !== undefined) {
        // Primitive payload (number, string, boolean, etc.)
        payload = notif.payload;
      } else {
        payload = pinConfig.payload || {};
      }
    }

    this.sendSocketNotification("GPIO_NOTIFICATION", {
      pin: pinConfig.pin,
      type,
      notification,
      payload,
    });

    this.log(`[MMM-GPIO-Notifications2] Button ${pinConfig.pin} â†’ ${type}, sent: ${notification}`, payload);
  },

  log: function (...args) {
    console.log(...args);
  },

  error: function (...args) {
    console.error(...args);
  }
});
