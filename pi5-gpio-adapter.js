const { EventEmitter } = require("node:events");
const { spawn, execFileSync } = require("node:child_process");

function detectChip() {
  const output = execFileSync("gpiodetect", {
    encoding: "utf8"
  });

  const match = output.match(
    /^(gpiochip\d+)\s+\[pinctrl-rp1\]/m
  );

  if (!match) {
    throw new Error("Pi 5 RP1 GPIO controller not found");
  }

  return match[1];
}

class Pi5GPIO extends EventEmitter {
  constructor() {
    super();

    try {
      this.chip = detectChip();
      setImmediate(() => {
        this.emit("connected", { chip: this.chip });
      });
    } catch (err) {
      setImmediate(() => this.emit("error", err));
    }
  }

  gpio(pin) {
    const chip = this.chip;
    let bias = "as-is";

    return {
      pullUpDown(value) {
        bias = {
          0: "disable",
          1: "pull-down",
          2: "pull-up"
        }[value] || "as-is";
      },

      notify(callback, edges, debounceMicros = 0) {
        const delay = Math.max(
          0,
          debounceMicros / 1000
        );

        const args = [
          "-b",
          "-B", bias,
          "-F", "%e",
          chip,
          String(pin)
        ];

        const child = spawn("gpiomon", args, {
          stdio: ["ignore", "pipe", "pipe"]
        });

        let buffer = "";
        let pending = null;

        child.stdout.setEncoding("utf8");

        child.stdout.on("data", (data) => {
          buffer += data;

          let newline;
          while ((newline = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);

            if (line !== "0" && line !== "1") continue;

            const level = Number(line);

            if (pending) clearTimeout(pending);

            if (delay === 0) {
              callback(level);
            } else {
              pending = setTimeout(() => {
                pending = null;
                callback(level);
              }, delay);
            }
          }
        });

        child.stderr.on("data", (data) => {
          console.error(
            `[Pi5 GPIO ${pin}] ${data.toString().trim()}`
          );
        });

        child.on("error", (err) => {
          console.error(`[Pi5 GPIO ${pin}]`, err.message);
        });

        child.on("exit", (code, signal) => {
          if (pending) clearTimeout(pending);
          if (code !== 0 && signal !== "SIGTERM") {
            console.error(
              `[Pi5 GPIO ${pin}] monitor exited: ${code}`
            );
          }
        });

        process.once("exit", () => child.kill());

        return child;
      }
    };
  }
}

module.exports = {
  EITHER_EDGE: 2,
  pigpio: () => new Pi5GPIO()
};
