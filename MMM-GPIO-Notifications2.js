/* global Module */

/* MagicMirrorÂ² Module: MMM-GPIO-Notifications2
 *
 * Forwards notifications received from the node_helper to the rest of MagicMirror.
 * - Accepts notification payloads as:
 *   - string
 *   - object: { notification: "NAME", payload: any }
 *   - array of the above
 *
 * Merges pin-wide payload with per-notification payloads.
 */

Module.register("MMM-GPIO-Notifications2", {
  defaults: {
    host: "127.0.0.1",
    port: 8888,
    pins: []
  },

  start: function () {
    this.sendSocketNotification("CONFIG", this.config);
    Log.log("Starting module: " + this.name);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GPIO_NOTIFICATION") {
      this._handleNotification(payload);
    }
  },

  _handleNotification: function (incoming) {
    if (!incoming) {
      Log.warn("[MMM-GPIO-Notifications2] _handleNotification called with empty payload");
      return;
    }

    // í ½í´§ FIX: Donâ€™t discard primitive payloads (numbers, strings, booleans)
    const basePinPayload =
      incoming.payload !== undefined ? incoming.payload : {};

    const notif = incoming.notification;

    const hasProperties = (obj) => obj && typeof obj === "object" && Object.keys(obj).length > 0;

    const dispatchEntry = (entry) => {
      if (typeof entry === "string") {
        if (typeof basePinPayload !== "object" || hasProperties(basePinPayload)) {
          Log.log(`[MMM-GPIO-Notifications2] Dispatching notification: ${entry} with payload`, basePinPayload);
          this.sendNotification(entry, basePinPayload);
        } else {
          Log.log(`[MMM-GPIO-Notifications2] Dispatching notification: ${entry} (no payload)`);
          this.sendNotification(entry);
        }
      } else if (entry && typeof entry === "object" && typeof entry.notification === "string") {
        let merged;

        if (entry.payload !== undefined) {
          if (typeof entry.payload === "object" && entry.payload !== null) {
            merged = Object.assign(
              {},
              typeof basePinPayload === "object" ? basePinPayload : {},
              entry.payload
            );
          } else {
            // non-object payload (number, string, boolean, etc.)
            merged = entry.payload;
          }
        } else {
          merged = basePinPayload;
        }

        if (merged !== undefined && (typeof merged !== "object" || hasProperties(merged))) {
          Log.log(`[MMM-GPIO-Notifications2] Dispatching notification: ${entry.notification} with payload`, merged);
          this.sendNotification(entry.notification, merged);
        } else {
          Log.log(`[MMM-GPIO-Notifications2] Dispatching notification: ${entry.notification} (no payload)`);
          this.sendNotification(entry.notification);
        }
      } else {
        Log.warn("[MMM-GPIO-Notifications2] Unknown notification entry, skipping:", entry);
      }
    };

    if (Array.isArray(notif)) {
      notif.forEach((n) => dispatchEntry(n));
    } else {
      dispatchEntry(notif);
    }
  }
});
