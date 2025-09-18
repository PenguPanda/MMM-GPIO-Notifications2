/* MagicMirror²
 * Module: MMM-GPIO-Notifications
 *
 * Node helper using pigpio-client with debug + polling
 */

const NodeHelper = require("node_helper");
const pigpio = require("pigpio-client").pigpio();

module.exports = NodeHelper.create({
  start: function () {
    console.log("[MMM-GPIO-Notifications] node_helper started at", __filename);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "CONFIG") {
      console.log("[MMM-GPIO-Notifications] Received config", payload);

      payload.pins.forEach((pinConfig) => {
        const gpio = pigpio.gpio(pinConfig.pin);

        // Setup input mode
        gpio.modeSet("input");

        // Configure pull-up/down
        if (pinConfig.pull === "up") {
          gpio.pullUpDown(2); // 2 = pull-up
          console.log(`[GPIO${pinConfig.pin}] pull-up enabled`);
        } else {
          gpio.pullUpDown(1); // 1 = pull-down
          console.log(`[GPIO${pinConfig.pin}] pull-down enabled`);
        }

        // Interrupt listener
        gpio.notify((level, tick) => {
          console.log(
            `[DEBUG GPIO${pinConfig.pin}] interrupt fired: level=${level}, tick=${tick}`
          );
          console.log(
            `[MMM-GPIO-Notifications] Watched pin ${pinConfig.pin} triggered with value ${level}`
          );

          // Send notification for both states
          this.sendSocketNotification(pinConfig.notification, {
            pin: pinConfig.pin,
            value: level,
          });
        });

        // Poll fallback (every 200ms)
        setInterval(() => {
          gpio.read((err, value) => {
            if (err) {
              console.error(
                `[ERROR GPIO${pinConfig.pin}] poll read error:`,
                err
              );
            } else {
              console.log(`[DEBUG GPIO${pinConfig.pin}] poll value=${value}`);
            }
          });
        }, 200);

        console.log(
          `[MMM-GPIO-Notifications] Watching GPIO${pinConfig.pin} for changes`
        );
      });
    }
  },
});
