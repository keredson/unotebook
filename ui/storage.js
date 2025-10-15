const DB_NAME = 'unotebook';
const DB_VER = 1;
const STORE = 'notebooks';
import stringify from 'fast-json-stable-stringify';


/** Open (or create) the DB */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // keyPath = filename; store content as Blob or string
        const os = db.createObjectStore(STORE, { keyPath: 'fn' });
        os.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveNotebook(fn, obj) {
  const db = await openDB();

  // Serialize to JSON
  const json = stringify(obj);
  const blob = new Blob([json], { type: 'application/json' });

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    const record = {
      fn,
      size: blob.size,
      updatedAt: Date.now(),
      content: blob,
    };

    store.put(record);

    tx.oncomplete = () => resolve({ fn, size: blob.size });
    tx.onerror = () => reject(tx.error);
  });
}

export async function getNotebook(fn) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(fn);

    req.onsuccess = async (e) => {
      const rec = e.target.result;
      if (!rec) return resolve(null);

      try {
        // content is always a Blob now
        const text = await rec.content.text();
        const obj = JSON.parse(text);
        resolve(obj);
      } catch (err) {
        reject(err);
      }
    };

    req.onerror = () => reject(tx.error);
  });
}

/** Delete by filename */
export async function deleteNotebook(fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(fn);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/** List notebooks (returns array of {fn, size, updatedAt}) */
export async function listNotebooks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const items = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) return resolve(items);
      const { fn, size, updatedAt } = cur.value;
      if (fn.endsWith('.ipynb')) {
        items.push({ source:'local', fn, size, updatedAt });
      }
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
