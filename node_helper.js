/* MagicMirror²
 * Module: MMM-GPIO-Notifications2
 */

const NodeHelper = require("node_helper");
const pigpio = require("pigpio-client").pigpio();

module.exports = NodeHelper.create({
  start: function () {
    this.logPrefix = "[MMM-GPIO-Notifications2]";
    console.log(this.logPrefix, "node_helper started");
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "CONFIG") {
      console.log(this.logPrefix, "Received config", payload);

      payload.pins.forEach((pinConfig) => {
        const mergedConfig = this.applyDefaults(pinConfig);
        if (mergedConfig.mode === "pir") {
          this.setupPir(mergedConfig);
        } else {
          this.setupButton(mergedConfig);
        }
      });
    }
  },

  applyDefaults: function (pinConfig) {
    const defaults = {
      mode: "button",
      pull: "down",
      activeLow: false,
      debounce: 80,
      longPressDuration: 1500,
      veryLongPressDuration: 5000,
      multiPressTimeout: 400,
      suppressShortOnLong: true,
      suppressReleaseOnLong: false,
      suppressReleaseOnVeryLong: false,
      repeat: false, // PIR only: send motionStart on every HIGH?
      notifications: {}
    };
    return Object.assign({}, defaults, pinConfig);
  },

  setupButton: function (pinConfig) {
    const gpio = pigpio.gpio(pinConfig.pin);
    gpio.modeSet("input");

    if (pinConfig.pull === "up") {
      gpio.pullUpDown(2);
      console.log(`[GPIO${pinConfig.pin}] pull-up enabled`);
    } else {
      gpio.pullUpDown(1);
      console.log(`[GPIO${pinConfig.pin}] pull-down enabled`);
    }

    let pressStart = null;
    let longTimer = null;
    let veryLongTimer = null;
    let multiPressCount = 0;
    let multiPressTimer = null;
    let lastEventTime = 0;

    const debounce = pinConfig.debounce;
    const longDur = pinConfig.longPressDuration;
    const veryLongDur = pinConfig.veryLongPressDuration;
    const multiTimeout = pinConfig.multiPressTimeout;

    gpio.notify((level, tick) => {
      const now = Date.now();
      if (now - lastEventTime < debounce) return;
      lastEventTime = now;

      const active = pinConfig.activeLow ? level === 0 : level === 1;

      if (active) {
        pressStart = now;
        this.sendAll(pinConfig, "press", { tick });

        longTimer = setTimeout(() => {
          this.sendAll(pinConfig, "longPress", { tick });
          if (pinConfig.suppressShortOnLong) multiPressCount = 0;
        }, longDur);

        veryLongTimer = setTimeout(() => {
          this.sendAll(pinConfig, "veryLongPress", { tick });
          if (pinConfig.suppressShortOnLong) multiPressCount = 0;
        }, veryLongDur);

      } else {
        const duration = now - (pressStart || now);
        clearTimeout(longTimer);
        clearTimeout(veryLongTimer);

        let longFired = duration >= longDur && duration < veryLongDur;
        let veryLongFired = duration >= veryLongDur;

        if (longFired) {
          if (!pinConfig.suppressReleaseOnLong) {
            this.sendAll(pinConfig, "release", { tick });
          }
        } else if (veryLongFired) {
          if (!pinConfig.suppressReleaseOnVeryLong) {
            this.sendAll(pinConfig, "release", { tick });
          }
        } else {
          multiPressCount++;
          if (multiPressTimer) clearTimeout(multiPressTimer);

          multiPressTimer = setTimeout(() => {
            if (multiPressCount === 1) {
              this.sendAll(pinConfig, "shortPress", { tick });
            } else if (multiPressCount === 2) {
              this.sendAll(pinConfig, "doublePress", { tick });
            } else if (multiPressCount === 3) {
              this.sendAll(pinConfig, "triplePress", { tick });
            }
            this.sendAll(pinConfig, "release", { tick });
            multiPressCount = 0;
          }, multiTimeout);
        }
      }
    });

    console.log(this.logPrefix, `Watching BUTTON GPIO${pinConfig.pin}`);
  },

  setupPir: function (pinConfig) {
    const gpio = pigpio.gpio(pinConfig.pin);
    gpio.modeSet("input");

    if (pinConfig.pull === "up") {
      gpio.pullUpDown(2);
      console.log(`[GPIO${pinConfig.pin}] pull-up enabled`);
    } else {
      gpio.pullUpDown(1);
      console.log(`[GPIO${pinConfig.pin}] pull-down enabled`);
    }

    let lastActive = null;
    let lastEventTime = 0;

    gpio.notify((level, tick) => {
      const now = Date.now();
      if (now - lastEventTime < pinConfig.debounce) return;
      lastEventTime = now;

      const active = pinConfig.activeLow ? level === 0 : level === 1;
      console.log(`[GPIO${pinConfig.pin} PIR RAW] level=${level} active=${active}`);

      if (pinConfig.repeat) {
        // always send motionStart for every HIGH
        if (active) {
          this.sendAll(pinConfig, "motionStart", { tick });
        } else {
          this.sendAll(pinConfig, "motionEnd", { tick });
        }
      } else {
        // only on state change
        if (active !== lastActive) {
          lastActive = active;
          if (active) {
            this.sendAll(pinConfig, "motionStart", { tick });
          } else {
            this.sendAll(pinConfig, "motionEnd", { tick });
          }
        }
      }
    });

    console.log(this.logPrefix, `Watching PIR GPIO${pinConfig.pin}`);
  },

  sendAll: function (pinConfig, type, extra = {}) {
    const list = pinConfig.notifications?.[type];
    if (list && Array.isArray(list)) {
      list.forEach((n) => {
        let name, payload;
        if (typeof n === "string") {
          name = n;
          payload = {};
        } else if (typeof n === "object" && n.name) {
          name = n.name;
          payload = n.payload || {};
        }
        const out = Object.assign({}, payload, {
          pin: pinConfig.pin,
          type,
          timestamp: Date.now(),
          ...extra
        });
        console.log(this.logPrefix, `GPIO${pinConfig.pin} -> sending "${name}" with`, out);
        this.sendSocketNotification(name, out);
      });
    }
  }
});
