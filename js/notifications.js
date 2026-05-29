// 消息提醒管理
var Notifications = (function() {
  var morningTimer = null;
  var eveningTimer = null;

  function requestPermission() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then(function(p) { return p === 'granted'; });
  }

  // 计算距离下次提醒的毫秒数
  function msUntilTime(timeStr) {
    // timeStr: "HH:MM"
    var parts = timeStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var now = new Date();
    var target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime() - now.getTime();
  }

  function scheduleMorning(timeStr) {
    if (morningTimer) clearTimeout(morningTimer);
    if (!timeStr) return;
    var ms = msUntilTime(timeStr);
    morningTimer = setTimeout(function() {
      fireReminder();
      // Re-schedule for next day
      scheduleMorning(timeStr);
    }, ms);
  }

  function scheduleEvening(timeStr) {
    if (eveningTimer) clearTimeout(eveningTimer);
    if (!timeStr) return;
    var ms = msUntilTime(timeStr);
    eveningTimer = setTimeout(function() {
      fireReminder();
      scheduleEvening(timeStr);
    }, ms);
  }

  function fireReminder() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Get today's pending count
    DB.getDueReviews(Date.now()).then(function(reviews) {
      var count = reviews.length;
      var body = count > 0
        ? '今日有 ' + count + ' 个单词待复习，快来巩固记忆！'
        : '今日背诵任务尚未完成，坚持就是胜利！';

      try {
        new Notification('中考词汇提醒', {
          body: body,
          icon: 'icons/icon-192.png',
          tag: 'vocab-reminder',
          renotify: true
        });
      } catch(e) {}
    });
  }

  function setupReminders(morningTime, eveningTime) {
    scheduleMorning(morningTime);
    scheduleEvening(eveningTime);
  }

  function clearReminders() {
    if (morningTimer) { clearTimeout(morningTimer); morningTimer = null; }
    if (eveningTimer) { clearTimeout(eveningTimer); eveningTimer = null; }
  }

  return {
    requestPermission: requestPermission,
    scheduleMorning: scheduleMorning,
    scheduleEvening: scheduleEvening,
    setupReminders: setupReminders,
    clearReminders: clearReminders,
    fireReminder: fireReminder
  };
})();
