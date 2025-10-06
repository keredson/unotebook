# µNotebook
An on-device Juypter Notebook like tool for Micropython.

## Get Coding
Go here: [unotebook.org/code](//unotebook.org/code)

## Self-Hosted (optional)
µNotebook can run entirely on your MicroPython device (~20kb flash; no internet needed).  To install:
```python
>>> import mip
>>> mip.install("github:keredson/unotebook")
Installing github:keredson/unotebook/package.json to /lib
Copying: /lib/unotebook.py
Copying: /lib/unotebook.js.gz
Done
```

Then run (manually or in `main.py`):
```python
>>> import unotebook
>>> unotebook.start()
```
This will start the server on port 80 in a new thread.
If you would rather run in the current thread, call `run()`.
Both functions take an optional `port` argument.

To automatically create a WiFi access point (like `uNotebook-123456`) that will launch 
µNotebook automatically when your device connects to it, run:
```
>>> unotebook.wifi()
```