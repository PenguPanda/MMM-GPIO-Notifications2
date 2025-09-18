# MMM-GPIO-Notifications2

A [MagicMirror²](https://magicmirror.builders) module for Raspberry Pi that listens to GPIO pins and sends configurable notifications.  
Supports **buttons** (short/long/very long/double/triple presses) and **PIR motion sensors**, with flexible debounce, suppression, and custom payloads.

---

## ✨ Features
- Button press detection with:
  - **ShortPress**
  - **LongPress**
  - **VeryLongPress**
  - **DoublePress**
  - **TriplePress**
- PIR motion sensor support:
  - `motionStart`
  - `motionEnd`
- Per-pin configuration
- Built-in support for pull-up / pull-down resistors
- Configurable debounce time
- Suppression rules (e.g., skip shortPress if longPress triggered)
- Send notifications with **custom payloads**

---

## 📦 Installation

1. Navigate to your MagicMirror `modules` folder:
   ```bash
   cd ~/MagicMirror/modules

    Clone this repository:

git clone https://github.com/PenguPanda/MMM-GPIO-Notifications2.git

Install dependencies:

cd MMM-GPIO-Notifications2
npm install

Make sure pigpiod is running:

    sudo systemctl enable pigpiod
    sudo systemctl start pigpiod

⚙️ Configuration

Add this to your config.js:

{
  module: "MMM-GPIO-Notifications2",
  config: {
    pins: [
      {
        pin: 24,
        mode: "button",            // "button" or "pir"
        pull: "down",              // "up" or "down"
        activeLow: false,          // true if button/sensor pulls LOW
        debounce: 80,              // ms debounce
        longPressDuration: 2000,   // ms
        veryLongPressDuration: 10000,
        multiPressTimeout: 400,    // ms for double/triple
        suppressShortOnLong: true,
        suppressReleaseOnLong: true,
        suppressReleaseOnVeryLong: true,

        notifications: {
          press: ["PRESS"],
          release: ["RELEASE"],
          shortPress: [
            "SHORT_PRESS",
            { name: "SCREEN_TOGGLE", payload: { target: "hdmi" } }
          ],
          longPress: [
            "LONG_PRESS",
            { name: "FRAMELIGHT_OFF", payload: { action: "off" } }
          ],
          veryLongPress: [
            { name: "SHUTDOWN", payload: { confirm: true } }
          ],
          doublePress: [
            "DOUBLE_PRESS",
            { name: "NEXT_PAGE" }
          ],
          triplePress: [
            { name: "RESET_VIEW" }
          ]
        }
      },
      {
        pin: 17,
        mode: "pir",                // motion sensor
        pull: "down",               // most PIRs idle HIGH
        activeLow: false,           // true if PIR pulls LOW when triggered
        debounce: 200,              // PIRs often need longer debounce

        notifications: {
          motionStart: [
            "MOTION_DETECTED",
            { name: "SCREEN_ON", payload: { forced: false } }
          ],
          motionEnd: [
            "MOTION_ENDED",
            { name: "SCREEN_OFF", payload: { room: "livingroom" } }
          ]
        }
      }
    ]
  }
}

🔌 Wiring
Button Example

Simple push button connected to GPIO24 with pull-down resistor.

 Raspberry Pi GPIO (BCM)
 ┌─────────────┐
 │ 3.3V    (1) │───┐
 │             │   │
 │ GPIO24 (18) │───┴─── Button ─── GND (6)
 │             │
 └─────────────┘

    Configure pull: "down" in config

    Pressing the button connects 3.3V → GPIO24, reading as HIGH

PIR Motion Sensor Example (HC-SR501 style)

  PIR Sensor         Raspberry Pi
 ┌─────────────┐    ┌─────────────┐
 │ VCC   ──────┼───▶ 5V (Pin 2)   │
 │ GND   ──────┼───▶ GND (Pin 6)  │
 │ OUT   ──────┼───▶ GPIO17 (Pin 11)
 └─────────────┘    └─────────────┘

    Most PIRs idle HIGH and go LOW on motion (set activeLow accordingly)

    Use debounce: 200 or higher to reduce false triggers

    Adjust hardware dials (time_high, sensitivity) for your needs

🔧 Notes

    GPIO permissions: If you get errors, run MagicMirror with sudo or ensure the pigpiod daemon is active.

    PIR sensors: Some PIRs have hardware dials for time_high and sensitivity — adjust them if motion triggers only once.

    Debounce: Increase debounce for noisy sensors (e.g., PIRs) to avoid false triggers.

🤝 Contributing

Pull requests are welcome!
If you add new features (e.g., analog sensors or advanced press combos), please open an issue or PR.
📜 License

MIT License.