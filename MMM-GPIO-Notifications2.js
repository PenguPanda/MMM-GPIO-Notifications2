/* MagicMirror²
 * Module: MMM-GPIO-Notifications2
 */

Module.register("MMM-GPIO-Notifications2", {
  defaults: {
    pins: []
  },

  start: function () {
    this.logPrefix = "[MMM-GPIO-Notifications2]";
    console.log(this.logPrefix, "starting...");
    this.sendSocketNotification("CONFIG", this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    console.log(this.logPrefix, "notification:", notification, payload);
    this.sendNotification(notification, payload);
  }
});
