/* MagicMirror²
 * Module: MMM-GPIO-Notifications2
 */

Module.register("MMM-GPIO-Notifications2", {
  defaults: {
    host: "127.0.0.1",
    port: 8888,
    pins: [],
  },

  start: function () {
    this.sendSocketNotification("CONFIG", this.config);
    Log.info("[MMM-GPIO-Notifications2] Started with config:", this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GPIO_NOTIFICATION") {
      Log.info("[MMM-GPIO-Notifications2] Sending Notification:", payload);
      this.sendNotification(payload.notification, payload.payload);
    }
  },
});
