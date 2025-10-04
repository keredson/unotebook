# µNotebook
An on-device Juypter Notebook like tool for Micropython.

## Install
On your device:
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
