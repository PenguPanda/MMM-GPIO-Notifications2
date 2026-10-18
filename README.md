# MMM-GPIO-Notifications2

A MagicMirror² module for Raspberry Pi GPIO inputs. It supports physical
buttons and PIR motion sensors and sends MagicMirror notifications.

Supported button events:

- Short press
- Long press
- Very long press
- Double press
- Triple press

## Raspberry Pi 4 and Pi 5 support

The active `node_helper.js` selects the GPIO backend automatically.

| Platform | Backend | Requirements |
|---|---|---|
| Raspberry Pi 4 | `pigpio-client` | `pigpiod` running and accessible |
| Raspberry Pi 5 | Local libgpiod adapter | `gpiodetect` and `gpiomon` |

On Pi 5, the helper detects the Raspberry Pi model and selects the local
GPIO adapter. If model detection is unavailable, it checks for the RP1
GPIO controller reported by `gpiodetect`.

**You do not need to change your MagicMirror configuration to select a
backend.**

### Raspberry Pi 4 requirements

Ensure `pigpio` and its daemon are installed. Enable and start the daemon:

```bash
sudo systemctl enable --now pigpiod
systemctl is-active pigpiod
```

The default connection settings in the example below use `127.0.0.1:8888`.
The configured host and port apply to the Pi 4 backend.

### Raspberry Pi 5 requirements

Install the GPIO command-line utilities:

```bash
sudo apt update
sudo apt install gpiod
```

Verify the GPIO controller and tool version:

```bash
gpiodetect
gpiomon --version
```

The adapter expects the libgpiod v1 command-line syntax; it was tested
with libgpiod 1.6.3. Compatibility with the different libgpiod v2 CLI
syntax has not been verified.

The MagicMirror process must have permission to access the GPIO devices.
Check your groups and device permissions:

```bash
id
ls -l /dev/gpiochip*
```

If necessary, add the MagicMirror user to the `gpio` group, then log out
and back in so the new group membership takes effect:

```bash
sudo usermod -aG gpio "$USER"
```

The Pi 5 adapter uses `gpiodetect` and `gpiomon` directly. It does not
require `pigpiod`; the Pi 4 daemon is not used by the Pi 5 backend.

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/PenguPanda/MMM-GPIO-Notifications2.git
cd MMM-GPIO-Notifications2
npm install
```

If the module is already installed, do not clone it again. Update the
existing checkout using your normal Git workflow.

## Configuration

Add the module to `config/config.js` if it is not already configured.
The following is an example; retain your existing pin assignments,
debounce values, notification names and payloads as required.

```javascript
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
        multiPressTimeout: 400,
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
```

`multiPressTimeout` controls the time window for grouping successive
button presses; it defaults to 400 milliseconds. The notification
names `doublePress` and `triplePress` identify the resulting events.

## Wiring and input behavior

- GPIO pin numbers are Broadcom (BCM) GPIO numbers.
- `pull: "down"` selects a pull-down bias where supported.
- Button presses are detected on a rising edge; releases are detected
  on a falling edge.
- PIR motion-on and motion-off events follow rising and falling edges.
- Raspberry Pi GPIO inputs are **3.3 V only**. Never apply 5 V to a GPIO
  input.

Choose pull settings and wiring appropriate for the connected hardware.

## Notifications

Button notification types:

- `shortPress`
- `longPress`
- `veryLongPress`
- `doublePress`
- `triplePress`

Each notification can be a string or an object containing a
`notification` name and an optional `payload`. Per-notification object
payloads are merged with the pin-wide payload.

## Troubleshooting

1. Check the MagicMirror logs for the selected backend and GPIO setup.
2. On Pi 4, confirm `pigpiod` is active and the configured host and port
   are reachable.
3. On Pi 5, confirm `gpiodetect` identifies the RP1 GPIO controller.
4. Check GPIO device permissions and ensure another process is not
   holding the requested lines.

## License

MIT © PenguPanda
