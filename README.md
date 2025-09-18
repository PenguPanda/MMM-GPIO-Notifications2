# MMM-GPIO-Notifications2

A [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) module that listens to GPIO pins on a Raspberry Pi using [pigpio](https://abyz.me.uk/rpi/pigpio/) and triggers notifications.

Supports:
- PIR sensors
- Button presses (short, long, very long, double, triple)

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/YOURNAME/MMM-GPIO-Notifications2.git
cd MMM-GPIO-Notifications2
npm install

Make sure pigpiod is running:

sudo systemctl enable pigpiod
sudo systemctl start pigpiod

Configuration

{
  module: "MMM-GPIO-Notifications2",
  config: {
    host: "127.0.0.1",
    port: 8888,
    pins: [
      {
        pin: 24,
        type: "BUTTON",
        pull: "down",
        debounce: 80,
        longPress: 2500,
        veryLongPress: 6000,
        doublePress: 400,
        triplePress: 600,
        notifications: {
          shortPress: "BUTTON_SHORT",
          longPress: "BUTTON_LONG",
          veryLongPress: "BUTTON_VERYLONG",
          doublePress: "BUTTON_DOUBLE",
          triplePress: "BUTTON_TRIPLE"
        },
        payload: { name: "Button A" }
      },
      {
        pin: 17,
        type: "PIR",
        pull: "down",
        debounce: 10000,
        notifications: {
          motionOn: "MOTION_DETECTED",
          motionOff: "MOTION_ENDED"
        },
        payload: { location: "Living Room" }
      }
    ]
  }
}

Notifications

This module will send the following notifications:

    From Buttons:

        shortPress → BUTTON_SHORT

        longPress → BUTTON_LONG

        veryLongPress → BUTTON_VERYLONG

        doublePress → BUTTON_DOUBLE

        triplePress → BUTTON_TRIPLE

    From PIR Sensors:

        motionOn → MOTION_DETECTED

        motionOff → MOTION_ENDED

License

MIT © PenguPanda