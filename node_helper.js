/* MagicMirror Module: MMM-GPIO-Notifications2
 * Node Helper
 */

const NodeHelper = require("node_helper");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function detectPi5() {
  try {
    const model = fs.readFileSync(
      "/proc/device-tree/model", "utf8"
    ).replace(/\0/g, "");
    if (/Raspberry Pi 5/i.test(model)) return true;
  } catch {}

  try {
    const chips = execFileSync("gpiodetect", {
      encoding: "utf8", timeout: 2000
    });
    return /^\S+\s+\[pinctrl-rp1\]/m.test(chips);
  } catch {}

  return false;
}

const isPi5 = detectPi5();
const pigpio = isPi5
  ? require("./pi5-gpio-adapter")
  : require("pigpio-client");

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

    this.log("[MMM-GPIO-Notifications2] Starting " + (isPi5 ? "Pi 5 GPIO (libgpiod)" : "Pi 4 GPIO (pigpio-client/pigpiod)") + "â€¦");
    this.client = pigpio.pigpio({ host, port });

    this.client.once("connected", (info) => {
      this.log("[MMM-GPIO-Notifications2] Connected to " + (isPi5 ? "Pi 5 GPIO" : "pigpiod") + ":", info);

      pins.forEach((pinConfig) => {
        this.setupPin(pinConfig);
      });

      // Wake the display on startup only when a PIR is configured for SCREEN_ON.
      const findScreenOn = (notif) => {
        if (notif === "SCREEN_ON") return notif;
        if (Array.isArray(notif)) {
          return notif.find((entry) =>
            entry === "SCREEN_ON" ||
            (entry && typeof entry === "object" && entry.notification === "SCREEN_ON")
          ) || null;
        }
        if (notif && typeof notif === "object" && notif.notification === "SCREEN_ON") {
          return notif;
        }
        return null;
      };

      const startupScreenPin = pins.find((pinConfig) =>
        pinConfig.type === "PIR" &&
        findScreenOn(pinConfig.notifications?.motionOn)
      );

      if (startupScreenPin) {
        const startupNotif = findScreenOn(
          startupScreenPin.notifications.motionOn
        );
        setTimeout(() => {
          this.log("[MMM-GPIO-Notifications2] Sending startup SCREEN_ON via PIR GPIO " + startupScreenPin.pin);
          this.sendOut(startupScreenPin, startupNotif, "startup");
        }, 500);
      }
    });

    this.client.once("error", (err) => {
      this.error(isPi5 ? "Pi 5 GPIO error:" : "Unable to connect to pigpiod:", err);
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

      const repeatMs = 10000;
      const edgeDebounceMs = 50;
      let active = false;
      let repeatTimer = null;
      let edgeTimer = null;
      let pendingLevel = null;
      let lastMotionOnAt = 0;

      const sendMotion = (notif) => {
        if (!notif) return;
        if (Array.isArray(notif)) {
          notif.forEach((entry) => this.sendOut(pinConfig, entry, "motion"));
        } else {
          this.sendOut(pinConfig, notif, "motion");
        }
      };

      const scheduleRepeat = () => {
        if (repeatTimer) clearTimeout(repeatTimer);
        if (!active || !pinConfig.notifications?.motionOn) return;
        const remaining = Math.max(0, repeatMs - (Date.now() - lastMotionOnAt));
        repeatTimer = setTimeout(() => {
          repeatTimer = null;
          if (!active) return;
          sendMotion(pinConfig.notifications.motionOn);
          lastMotionOnAt = Date.now();
          scheduleRepeat();
        }, remaining);
      };

      const handleLevel = (level) => {
        if (level === 1) {
          if (active) return;
          active = true;
          if (lastMotionOnAt === 0 || Date.now() - lastMotionOnAt >= repeatMs) {
            sendMotion(pinConfig.notifications?.motionOn);
            lastMotionOnAt = Date.now();
          }
          scheduleRepeat();
        } else if (level === 0) {
          const wasActive = active;
          active = false;
          if (repeatTimer) clearTimeout(repeatTimer);
          repeatTimer = null;
          if (wasActive) sendMotion(pinConfig.notifications?.motionOff);
        }
      };

      gpio.notify((level) => {
        if (level !== 0 && level !== 1) return;
        pendingLevel = level;
        if (edgeTimer) clearTimeout(edgeTimer);
        edgeTimer = setTimeout(() => {
          edgeTimer = null;
          handleLevel(pendingLevel);
        }, edgeDebounceMs);
      }, pigpio.EITHER_EDGE, 0);
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
