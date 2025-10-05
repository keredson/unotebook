import network, machine, ubinascii, uasyncio as asyncio, socket, struct, os, webrepl

__version__ = None
try:
    __version__ = open('unotebook_VERSION').read()
except:
    try:
      __version__ = open('VERSION').read()
    except:
        print("could not load version")

AP_PASSWORD = None

# ---------- AP ----------
def start_ap():
    chip = ubinascii.hexlify(machine.unique_id()).decode().upper()
    ssid = "uNotebook-" + chip[-6:]
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    if AP_PASSWORD and len(AP_PASSWORD) >= 8:
        ap.config(essid=ssid, password=AP_PASSWORD, authmode=network.AUTH_WPA_WPA2_PSK)
    else:
        ap.config(essid=ssid, authmode=network.AUTH_OPEN)
    for _ in range(40):
        if ap.ifconfig()[0] != "0.0.0.0":
            break
        asyncio.sleep_ms(50)
    ip = ap.ifconfig()[0]
    print("AP:", ssid, "IP:", ip)
    return ap, ip

# ---------- DNS (wildcard -> our IP) ----------
class DnsServer:
    def __init__(self, ip_bytes):
        self.ip_bytes = ip_bytes
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        except:
            pass
        self.sock.bind(("0.0.0.0", 53))
        self.sock.setblocking(False)

    async def serve(self):
        print("DNS up")
        while True:
            try:
                data, addr = self.sock.recvfrom(512)
            except OSError:
                await asyncio.sleep_ms(2)
                continue
            if not data or len(data) < 12:
                continue
            tid = data[0:2]
            qdcount = struct.unpack("!H", data[4:6])[0]
            off = 12
            for _ in range(qdcount):
                while off < len(data) and data[off] != 0:
                    off += 1 + data[off]
                off += 1  # null
                off += 4  # QTYPE,QCLASS

            hdr = tid + b"\x81\x80" + data[4:6] + b"\x00\x01\x00\x00"
            q = data[12:off]
            ans = b"\xC0\x0C" + b"\x00\x01" + b"\x00\x01" + b"\x00\x00\x00\x3C" + b"\x00\x04" + self.ip_bytes
            pkt = hdr + q + ans
            try:
                self.sock.sendto(pkt, addr)
            except OSError:
                pass

# ---------- HTTP ----------
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm":  "text/html; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt":  "text/plain; charset=utf-8",
}

def guess_type(path):
    for ext, ctype in CONTENT_TYPES.items():
        if path.endswith(ext):
            return ctype
    return "application/octet-stream"

class HttpServer:
    def __init__(self):
        self.sock = socket.socket()
        try:
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        except:
            pass
        self.sock.bind(("0.0.0.0", 80))
        self.sock.listen(2)
        self.sock.setblocking(False)

    async def serve(self):
        print("HTTP up")
        while True:
            try:
                cl, addr = self.sock.accept()
            except OSError:
                await asyncio.sleep_ms(2)
                continue
            cl.settimeout(2)
            asyncio.create_task(self._handle(cl, addr))

    def _exists(self, path):
        try:
            s = os.stat(path)
            return s[0] & 0x4000 == 0  # not a dir
        except:
            return False

    async def _handle(self, cl, addr):
        try:
            req = b""
            try:
                req = cl.recv(1024)
            except:
                pass
            # Default path
            path = "/"
            if req:
                first = req.split(b"\r\n", 1)[0]
                parts = first.split()
                if len(parts) >= 2:
                    path = parts[1].decode("utf-8", "ignore")

            # Captive-portal probes
            if path in ("/generate_204", "/gen_204"):
                cl.send(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
                return
            if path in ("/hotspot-detect.html", "/library/test/success.html", "/ncsi.txt"):
                await self._send_file(cl, "/unotebook.html")
                return

            # Route mapping:
            if path == "/" or path == "/index.html":
                # serve unotebook.html at root
                await self._send_file(cl, "/unotebook.html")
            elif path == "/unotebook.js":
                await self._send_file(cl, "/unotebook.js")
            else:
                # Any other path → serve index (simple SPA/captive behavior)
                await self._send_file(cl, "/unotebook.html")
        except Exception as e:
            try:
                cl.send(b"HTTP/1.1 500 Internal Server Error\r\nContent-Length:0\r\n\r\n")
            except:
                pass
        finally:
            try:
                cl.close()
            except:
                pass

    async def _send_file(self, cl, path):
        if not self._exists(path):
            cl.send(b"HTTP/1.1 404 Not Found\r\nContent-Length:0\r\n\r\n")
            return
        ctype = guess_type(path)
        try:
            f = open(path, "rb")
            try:
                # compute length (os.stat)
                length = os.stat(path)[6]
            except:
                length = None

            hdr = "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nCache-Control: no-store\r\n".format(ctype)
            if length is not None:
                hdr += "Content-Length: {}\r\n".format(length)
            hdr += "\r\n"
            cl.send(hdr.encode())

            # stream file in chunks
            while True:
                chunk = f.read(1024)
                if not chunk:
                    break
                cl.send(chunk)
        finally:
            try:
                f.close()
            except:
                pass


async def _run_ap():
    if not webrepl._webrepl: webrepl.start()
    ap, ip = start_ap()
    ip_bytes = bytes(int(x) for x in ip.split("."))
    dns = DnsServer(ip_bytes)
    http = HttpServer()
    await asyncio.gather(dns.serve(), http.serve())


async def _run():
    if not webrepl._webrepl: webrepl.start()
    http = HttpServer()
    await http.serve()


def run_ap():
  try:
    asyncio.run(_run_ap())
  finally:
    try:
      asyncio.new_event_loop()
    except:
      pass


def run():
  try:
    asyncio.run(_run())
  finally:
    try:
      asyncio.new_event_loop()
    except:
      pass
