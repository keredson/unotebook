import { cleaveLastStatement, is_safe_to_assign_to_var, stripPythonComment, appendWithCR } from './repl.js'

export class Pybricks extends EventTarget {
  static NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  static NUS_RX      = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  static NUS_TX      = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  static PYB_SERVICE = 'c5f50001-8280-46da-89f4-6d8051e4aeef';   // Pybricks Service
  static PYB_CMD_EVT  = 'c5f50002-8280-46da-89f4-6d8051e4aeef';  // Command/Event characteristic

  constructor() {
    super();
    this.device = this.server = this.rxChar = this.txChar = null;
    this.connected = false;
    this._encoder = new TextEncoder();
    this._decoder = new TextDecoder();
    this.running = false
    this.ignore_bytes = 0
    this.status = null
    this.stdout = ''
    this._needsReplStart = false;
  }

  async connect() {
    if (this.connected) return;
    this.device = await navigator.bluetooth.requestDevice({
        //acceptAllDevices: true,
        filters: [{ services: [Pybricks.PYB_SERVICE] }],
        optionalServices: [Pybricks.PYB_SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnect());
    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(Pybricks.PYB_SERVICE);
    this.cmdEvt = await service.getCharacteristic(Pybricks.PYB_CMD_EVT);

    this.cmdEvt.addEventListener("characteristicvaluechanged", (ev) => {
      const v = new Uint8Array(ev.target.value.buffer);
      if (v[0] === 0x01) { // WRITE_STDOUT
        var text = new TextDecoder().decode(v.slice(1));
        console.log("STDOUT:", text);
        if (this.ignore_bytes) {
          if (text.length <= this.ignore_bytes) {
            this.ignore_bytes -= text.length
            return
          } else {
            text = text.substring(this.ignore_bytes)
            this.ignore_bytes = 0
          }
        }
        this.stdout = appendWithCR(this.stdout, text)

        if (this.stdout.endsWith('>>> ')) {
          clearTimeout(this.running_timer);
          this.running_timer = setTimeout(() => {
            if (this.stdout.endsWith('>>> ')) {
              this.running = false;
              this.stdout = this.stdout.replace(/>>> $/, '')
              this.dispatchEvent(new CustomEvent('stdout', { detail: this.stdout }));
              console.log("Timed out — REPL idle");
            }
          }, 500);
          return
        } else {
          clearTimeout(this.running_timer);
        }

        this.dispatchEvent(new CustomEvent('stdout', { detail: this.stdout }));
      } else if (v[0] === 0x00) { // STATUS_REPORT
        this.status = parsePybricksStatus(v)
        console.log("STATUS:", this.status);
      } else console.log('unknown event: ', v)
    });

    try {
      await this.cmdEvt.startNotifications();
    } catch (err) {
      if (err?.name === 'NotSupportedError') {
        console.warn('Pybricks: notifications already active; continuing', err);
      } else {
        throw err;
      }
    }
    this.connected = true;
    this._needsReplStart = true;
    this.dispatchEvent(new Event('connect'));
    return this.device.name
  }

  // helper to send a command frame (cmd byte + payload), chunking if needed
  async sendCmd(cmd, payloadBytes = []) {
    const MAX_CHUNK = 400; // keep well under 512-byte BLE write limit
    if (payloadBytes.length <= MAX_CHUNK) {
      await this._writeCmdFrame(cmd, payloadBytes);
      return;
    }
    for (let offset = 0; offset < payloadBytes.length; offset += MAX_CHUNK) {
      const chunk = payloadBytes.slice(offset, offset + MAX_CHUNK);
      await this._writeCmdFrame(cmd, chunk);
    }
  }

  async _writeCmdFrame(cmd, payloadBytes) {
    const frame = new Uint8Array(1 + payloadBytes.length);
    frame[0] = cmd;
    frame.set(payloadBytes, 1);
    await this.cmdEvt.writeValueWithResponse(frame);
  }

  async _send(code) {
    if (!this.connected) throw new Error('Not connected');

    const enc = new TextEncoder();

    code = code.replaceAll('\r\n','\n')
    const {head, tail} = cleaveLastStatement(code)
    this.running = true
    this.stdout = ''
    console.log({head, tail})

    const segments = []
    if (head) segments.push(head)
    if (tail) {
      if (is_safe_to_assign_to_var(tail)) {
        const expr = stripPythonComment(tail).trim()
        if (expr.length) {
          segments.push(`_ = (${expr})`)
          segments.push('if _ is not None:\n    print(_)')
        } else {
          segments.push(tail)
        }
      } else {
        segments.push(tail)
      }
    }
    code = segments.join('\n')
    console.log({code})
    const bytes = enc.encode(code.endsWith('\n') ? code : code + '\n');
    this.ignore_bytes = bytes.length + 'paste mode; Ctrl-C to cancel, Ctrl-D to finish\n=== '.length + 5

    // Ctrl-E to enter paste mode
    await this.sendCmd(0x06, new Uint8Array([0x05]));
    // send the code bytes (end with newline if not present)
    await this.sendCmd(0x06, bytes);
    // Ctrl-D to execute
    await this.sendCmd(0x06, new Uint8Array([0x04]));
  }

  async run(code) {
    await this._ensureReplStarted();
    await this._send(code)
    while (this.running) await sleep(100);
  }

  async reset() {
    console.log('resetting ble')
    await this.sendCmd(0x00);
    await sleep(150)
    this._needsReplStart = true;
  }

  async abort() {
    await this.sendCmd(0x06, new Uint8Array([0x03]));
    return "Aborted"
  }

  disconnect() {
    if (this.device?.gatt.connected) this.device.gatt.disconnect();
  }

  _onDisconnect() {
    this.connected = false;
    this.rxChar = this.txChar = this.server = null;
    this._needsReplStart = false;
    this.dispatchEvent(new Event('disconnect'));
  }

  async _ensureReplStarted() {
    if (!this.connected) throw new Error('Not connected');
    if (!this._needsReplStart) return;
    await this.sendCmd(0x02); // START_REPL
    await sleep(100);
    this._needsReplStart = false;
  }
}


function parsePybricksStatus(v) {
  if (v[0] !== 0x00) return null; // not a STATUS_REPORT event

  // Combine bytes [1..4] into a 32-bit little-endian integer
  const flags =
    v[1] | (v[2] << 8) | (v[3] << 16) | (v[4] << 24);

  // All known flags (from Pybricks BLE spec)
  const FLAG_MAP = {
    BATTERY_LOW_VOLTAGE_WARNING:  0x00000001,
    BATTERY_LOW_VOLTAGE_SHUTDOWN: 0x00000002,
    BATTERY_HIGH_CURRENT:         0x00000004,
    BLE_ADVERTISING:              0x00000008,
    BLE_LOW_SIGNAL:               0x00000010,
    POWER_BUTTON_PRESSED:         0x00000020,
    USER_PROGRAM_RUNNING:         0x00000040,
    SHUTDOWN:                     0x00000080,
    SHUTDOWN_REQUESTED:           0x00000100,
    BLE_HOST_CONNECTED:           0x00000200,
  };

  // Build result object
  const result = { raw: flags, hex: flags.toString(16).padStart(8, '0') };

  for (const [name, mask] of Object.entries(FLAG_MAP)) {
    result[name] = !!(flags & mask);
  }

  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
