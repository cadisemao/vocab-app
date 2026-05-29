// Service Worker — 离线缓存 + 消息推送
const CACHE_NAME = 'vocab-app-v1';
const ASSETS = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/words.js',
  'js/database.js',
  'js/ebbinghaus.js',
  'js/scheduler.js',
  'js/stats.js',
  'js/notifications.js',
  'js/ui.js',
  'js/app.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});

// 推送通知
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : {};
  var options = {
    body: data.body || '到时间背单词了！',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'vocab-reminder',
    renotify: true
  };
  e.waitUntil(
    self.registration.showNotification(data.title || '中考词汇', options)
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('index.html') > -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('index.html');
      }
    })
  );
});
