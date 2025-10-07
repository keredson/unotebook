__version__ = None
try:
    __version__ = open('unotebook_VERSION.txt').read()
except:
    try:
      __version__ = open('VERSION.txt').read()
    except:
        print("could not load version")

# BLE service that mimics Pybricks REPL subset (0x02, 0x06, 0x04, 0x00)
import bluetooth, struct, sys, uasyncio as asyncio
from micropython import const

_IRQ_CENTRAL_CONNECT    = const(1)
_IRQ_CENTRAL_DISCONNECT = const(2)
_IRQ_GATTS_WRITE        = const(3)

_PYB_SERVICE_UUID = bluetooth.UUID("c5f50001-8280-46da-89f4-6d8051e4aeef")
_PYB_CMD_EVT_UUID = bluetooth.UUID("c5f50002-8280-46da-89f4-6d8051e4aeef")
_FLAG_READ|_FLAG_WRITE|_FLAG_WRITE_NO_RSP|_FLAG_NOTIFY

def _adv(name, services):  # helper
    p=bytearray()
    n=name.encode(); p+=struct.pack("BB",len(n)+1,0x09)+n
    for s in services: b=bytes(s); p+=struct.pack("BB",len(b)+1,0x07)+b
    return p

class _BleWriter:
    def __init__(self,notify,chunk=180): self.n=notify; self.c=chunk
    def write(self,s):
        if isinstance(s,str): s=s.encode()
        for i in range(0,len(s),self.c): self.n(s[i:i+self.c])
        return len(s)
    def flush(self): pass

class PybricksReplBLE:
    def __init__(self,name="uNotebook Hub",debug=True):
        self.name = name
        self.ble=bluetooth.BLE(); self.ble.active(True)
        self.conn=None; self.rxbuf=bytearray(); self.debug=debug
        ((self.hdl,),)=self.ble.gatts_register_services(
            (( _PYB_SERVICE_UUID, ((_PYB_CMD_EVT_UUID, 0x001E),)),))
        self.ble.irq(self._irq)
        self.ble.gap_advertise(100_000,adv_data=_adv(self.name,[ _PYB_SERVICE_UUID]))
        if debug: print("[BLE] Advertising:",self.name)
        self.stdout=sys.stdout; self.stderr=sys.stderr
        self.running=False

    def _irq(self,ev,d):
        if ev==_IRQ_CENTRAL_CONNECT:
            self.conn,_,_=d; print("[BLE] Connected")
        elif ev==_IRQ_CENTRAL_DISCONNECT:
            self.conn=None; print("[BLE] Disconnected")
            self.ble.gap_advertise(100_000,adv_data=_adv(self.name,[ _PYB_SERVICE_UUID]))
        elif ev==_IRQ_GATTS_WRITE:
            if d[0]==self.hdl: self._on_write()

    def _notify(self,b):
        if self.conn is None: return
        for i in range(0,len(b),180):
            self.ble.gatts_notify(self.conn,self.hdl,b[i:i+180])

    def _on_write(self):
        raw=self.ble.gatts_read(self.hdl) or b""
        if not raw: return
        cmd=raw[0]; payload=raw[1:]
        if self.debug: print("CMD",hex(cmd),payload)
        if cmd==0x02:   # START_REPL
            self._start_repl()
        elif cmd==0x06: # WRITE_STDIN
            self.rxbuf.extend(payload)
        elif cmd==0x04: # WRITE_USER_RAM => run the current buffer
            self._run_buf()
        elif cmd==0x00: # STOP_USER_PROGRAM
            self._stop_repl()
        else:
            self._notify(b"?\n")

    def _start_repl(self):
        self._notify(b"[repl]\n")
        self.rxbuf=bytearray()
        sys.stdout=_BleWriter(self._notify)
        sys.stderr=_BleWriter(self._notify)
        self.running=True

    def _stop_repl(self):
        if self.running:
            self._notify(b"[stop]\n")
            sys.stdout=self.stdout
            sys.stderr=self.stderr
            self.running=False

    def _run_buf(self):
        src=self.rxbuf.decode()
        self.rxbuf=bytearray()
        try:
            exec(src,globals(),globals())
        except Exception as e:
            import sys, uio, traceback
            buf=uio.StringIO(); traceback.print_exc(file=buf)
            self._notify(buf.getvalue().encode())
        finally:
            self._notify(b">>> ")
