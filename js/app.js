// 主控制器 — 初始化、路由、事件绑定
(function() {
  var app = {
    init: function() {
      // Initialize database and import words
      DB.init().then(function(count) {
        console.log('Database ready, ' + count + ' words loaded');

        // Load settings and setup reminders
        return DB.getAllSettings().then(function(settings) {
          var morning = settings.reminderMorning || '08:00';
          var evening = settings.reminderEvening || '20:00';
          Notifications.requestPermission().then(function() {
            Notifications.setupReminders(morning, evening);
          });
        });
      }).then(function() {
        // Show home page
        UI.showPage('home');
      }).catch(function(err) {
        console.error('Init error:', err);
        // Try to show home anyway
        UI.showPage('home');
      });

      // Navigation
      document.getElementById('bottomNav').addEventListener('click', function(e) {
        var btn = e.target.closest('.nav-btn');
        if (!btn) return;
        var page = btn.dataset.page;
        if (page) UI.showPage(page);
      });

      // Handle back button
      window.addEventListener('popstate', function() {
        UI.showPage('home');
      });
    }
  };

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.init);
  } else {
    app.init();
  }
})();
