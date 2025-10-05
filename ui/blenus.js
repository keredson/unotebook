export class BleNus extends EventTarget {
  static NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  static NUS_RX      = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  static NUS_TX      = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  constructor() {
    super();
    this.device = this.server = this.rxChar = this.txChar = null;
    this.connected = false;
    this._encoder = new TextEncoder();
    this._decoder = new TextDecoder();
  }

  async connect() {
    if (this.connected) return;
    this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BleNus.NUS_SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnect());
    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(BleNus.NUS_SERVICE);
    this.rxChar = await service.getCharacteristic(BleNus.NUS_RX);
    this.txChar = await service.getCharacteristic(BleNus.NUS_TX);
    await this.txChar.startNotifications();
    this.txChar.addEventListener('characteristicvaluechanged', (e) => {
      const text = this._decoder.decode(e.target.value);
      this.dispatchEvent(new CustomEvent('data', { detail: text }));
    });
    this.connected = true;
    this.dispatchEvent(new Event('connect'));
  }

  async send(text) {
    if (!this.connected) throw new Error('Not connected');
    await this.rxChar.writeValue(this._encoder.encode(text));
  }

  disconnect() {
    if (this.device?.gatt.connected) this.device.gatt.disconnect();
  }

  _onDisconnect() {
    this.connected = false;
    this.rxChar = this.txChar = this.server = null;
    this.dispatchEvent(new Event('disconnect'));
  }
}
