// IndexedDB 封装 — 词库、进度、日志、设置
var DB = (function() {
  var DB_NAME = 'VocabApp';
  var DB_VERSION = 1;
  var db = null;

  function open() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('words')) {
          var ws = d.createObjectStore('words', { keyPath: 'id' });
          ws.createIndex('frequency', 'frequency', { unique: false });
        }
        if (!d.objectStoreNames.contains('progress')) {
          var ps = d.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
          ps.createIndex('wordId', 'wordId', { unique: true });
          ps.createIndex('nextReview', 'nextReview', { unique: false });
          ps.createIndex('isDifficult', 'isDifficult', { unique: false });
        }
        if (!d.objectStoreNames.contains('dailyLog')) {
          var dl = d.createObjectStore('dailyLog', { keyPath: 'id', autoIncrement: true });
          dl.createIndex('date', 'date', { unique: true });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function(e) { reject(e); };
    });
  }

  function getStore(name, mode) {
    var tx = db.transaction(name, mode || 'readonly');
    return tx.objectStore(name);
  }

  // ===== 词库操作 =====
  function importWords(words) {
    return new Promise(function(resolve, reject) {
      var store = getStore('words', 'readwrite');
      var count = 0;
      var total = words.length;
      words.forEach(function(w) {
        var req = store.put(w);
        req.onsuccess = function() {
          count++;
          if (count >= total) resolve(count);
        };
        req.onerror = function() { count++; if (count >= total) resolve(count); };
      });
    });
  }

  function getWordCount() {
    return new Promise(function(resolve) {
      var req = getStore('words').count();
      req.onsuccess = function() { resolve(req.result); };
    });
  }

  function getWordsByFrequency(freq) {
    return new Promise(function(resolve) {
      var store = getStore('words');
      var index = store.index('frequency');
      var results = [];
      index.openCursor(IDBKeyRange.only(freq)).onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else { resolve(results); }
      };
    });
  }

  function getWordsByIds(ids) {
    return new Promise(function(resolve) {
      var store = getStore('words');
      var results = [];
      var count = 0;
      if (ids.length === 0) { resolve(results); return; }
      ids.forEach(function(id) {
        var req = store.get(id);
        req.onsuccess = function() {
          count++;
          if (req.result) results.push(req.result);
          if (count >= ids.length) resolve(results);
        };
      });
    });
  }

  function getAllWords() {
    return new Promise(function(resolve) {
      var results = [];
      getStore('words').openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else { resolve(results); }
      };
    });
  }

  // ===== 进度操作 =====
  function getProgress(wordId) {
    return new Promise(function(resolve) {
      var store = getStore('progress');
      var index = store.index('wordId');
      var req = index.get(wordId);
      req.onsuccess = function() { resolve(req.result || null); };
    });
  }

  function saveProgress(prog) {
    return new Promise(function(resolve) {
      var store = getStore('progress', 'readwrite');
      // Check existing by wordId
      var index = store.index('wordId');
      var getReq = index.getKey(prog.wordId);
      getReq.onsuccess = function() {
        if (getReq.result) { prog.id = getReq.result; }
        var req = store.put(prog);
        req.onsuccess = function() { resolve(req.result); };
      };
    });
  }

  function getAllProgress() {
    return new Promise(function(resolve) {
      var results = [];
      getStore('progress').openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else { resolve(results); }
      };
    });
  }

  function getDueReviews(now) {
    return new Promise(function(resolve) {
      var results = [];
      var store = getStore('progress');
      var index = store.index('nextReview');
      // Get all progress with nextReview <= now, excluding mastered (stage >= 8)
      index.openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) {
          if (cursor.value.nextReview <= now && cursor.value.stage < 8) {
            results.push(cursor.value);
          }
          cursor.continue();
        } else { resolve(results); }
      };
    });
  }

  function getDifficultWords() {
    return new Promise(function(resolve) {
      var results = [];
      var store = getStore('progress');
      var index = store.index('isDifficult');
      index.openCursor(IDBKeyRange.only(1)).onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else { resolve(results); }
      };
    });
  }

  function getNewWordCount() {
    return new Promise(function(resolve) {
      var store = getStore('progress');
      var req = store.count();
      req.onsuccess = function() { resolve(req.result); };
    });
  }

  function getMasteredCount() {
    return new Promise(function(resolve) {
      var results = [];
      getStore('progress').openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) {
          if (cursor.value.stage >= 8) results.push(cursor.value);
          cursor.continue();
        } else { resolve(results.length); }
      };
    });
  }

  // ===== 每日日志 =====
  function getDailyLog(dateStr) {
    return new Promise(function(resolve) {
      var store = getStore('dailyLog');
      var index = store.index('date');
      var req = index.get(dateStr);
      req.onsuccess = function() { resolve(req.result || null); };
    });
  }

  function saveDailyLog(log) {
    return new Promise(function(resolve) {
      var store = getStore('dailyLog', 'readwrite');
      // check existing
      var index = store.index('date');
      var getReq = index.getKey(log.date);
      getReq.onsuccess = function() {
        if (getReq.result) { log.id = getReq.result; }
        var req = store.put(log);
        req.onsuccess = function() { resolve(req.result); };
      };
    });
  }

  function getRecentLogs(days) {
    return new Promise(function(resolve) {
      var results = [];
      var store = getStore('dailyLog');
      store.openCursor(null, 'prev').onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor && results.length < days) {
          results.push(cursor.value);
          cursor.continue();
        } else { resolve(results.reverse()); }
      };
    });
  }

  // ===== 设置操作 =====
  function getSetting(key, defaultValue) {
    return new Promise(function(resolve) {
      var req = getStore('settings').get(key);
      req.onsuccess = function() {
        resolve(req.result ? req.result.value : defaultValue);
      };
    });
  }

  function saveSetting(key, value) {
    return new Promise(function(resolve) {
      var store = getStore('settings', 'readwrite');
      store.put({ key: key, value: value });
      resolve();
    });
  }

  function getAllSettings() {
    return new Promise(function(resolve) {
      var results = {};
      getStore('settings').openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) { results[cursor.value.key] = cursor.value.value; cursor.continue(); }
        else { resolve(results); }
      };
    });
  }

  // ===== 初始化 =====
  function init() {
    return open().then(function() {
      return getWordCount();
    }).then(function(count) {
      if (count === 0 && typeof WORDS !== 'undefined') {
        return importWords(WORDS);
      }
      return count;
    });
  }

  return {
    open: open,
    init: init,
    importWords: importWords,
    getWordCount: getWordCount,
    getWordsByFrequency: getWordsByFrequency,
    getWordsByIds: getWordsByIds,
    getAllWords: getAllWords,
    getProgress: getProgress,
    saveProgress: saveProgress,
    getAllProgress: getAllProgress,
    getDueReviews: getDueReviews,
    getDifficultWords: getDifficultWords,
    getNewWordCount: getNewWordCount,
    getMasteredCount: getMasteredCount,
    getDailyLog: getDailyLog,
    saveDailyLog: saveDailyLog,
    getRecentLogs: getRecentLogs,
    getSetting: getSetting,
    saveSetting: saveSetting,
    getAllSettings: getAllSettings
  };
})();
