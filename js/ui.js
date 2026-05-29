// UI 渲染模块
var UI = (function() {
  var currentPage = 'home';
  var studyWords = [];
  var studyIndex = 0;
  var studyNewWords = [];
  var studyReviewWords = [];

  // ===== 页面切换 =====
  function showPage(name) {
    currentPage = name;
    var main = document.getElementById('mainContent');
    var headerTitle = document.getElementById('headerTitle');
    var headerSub = document.getElementById('headerSub');
    headerSub.textContent = '';

    switch (name) {
      case 'home': headerTitle.textContent = '中考词汇'; renderHome(main); break;
      case 'study': headerTitle.textContent = '背诵'; renderStudyPage(main); break;
      case 'stats': headerTitle.textContent = '数据统计'; renderStats(main); break;
      case 'settings': headerTitle.textContent = '设置'; renderSettings(main); break;
    }

    // Update nav
    var btns = document.querySelectorAll('.nav-btn');
    btns.forEach(function(b) {
      b.classList.toggle('active', b.dataset.page === name);
    });
  }

  // ===== 主页 =====
  function renderHome(container) {
    Stats.getDashboardData().then(function(data) {
      var p = data.progress;
      var pct = p.percentComplete;
      var circumference = 2 * Math.PI * 54;
      var offset = circumference - (pct / 100) * circumference;

      container.innerHTML =
        '<div class="page active">' +
          '<div class="progress-ring-container">' +
            '<svg id="progressRing" viewBox="0 0 120 120">' +
              '<circle class="ring-bg" cx="60" cy="60" r="54"/>' +
              '<circle class="ring-fg" cx="60" cy="60" r="54" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"/>' +
              '<text class="ring-text" x="60" y="55">' + pct + '%</text>' +
              '<text class="ring-sub" x="60" y="72">' + p.masteredWords + '/' + p.totalWords + ' 掌握</text>' +
            '</svg>' +
          '</div>' +
          '<div class="home-stats">' +
            '<div class="stat-card">' +
              '<div class="stat-value">' + p.learnedWords + '</div>' +
              '<div class="stat-label">已学习单词</div>' +
            '</div>' +
            '<div class="stat-card">' +
              '<div class="stat-value blue">' + (p.totalWords - p.learnedWords) + '</div>' +
              '<div class="stat-label">剩余单词</div>' +
            '</div>' +
            '<div class="stat-card">' +
              '<div class="stat-value">' + p.masteredWords + '</div>' +
              '<div class="stat-label">已掌握</div>' +
            '</div>' +
            '<div class="stat-card">' +
              '<div class="stat-value blue">' + data.difficultCount + '</div>' +
              '<div class="stat-label">薄弱单词</div>' +
            '</div>' +
          '</div>' +
          '<button class="btn-start" id="btnStartStudy">开始背诵</button>' +
          '<div class="retention-bar">' +
            '<span class="retention-label">记忆留存率</span>' +
            '<span class="retention-value">' + data.retention + '%</span>' +
          '</div>' +
        '</div>';

      document.getElementById('btnStartStudy').addEventListener('click', function() {
        showPage('study');
        startStudySession();
      });
    });
  }

  // ===== 背诵页 =====
  function renderStudyPage(container) {
    container.innerHTML =
      '<div class="page active" id="studyPage">' +
        '<div class="study-header">' +
          '<span class="study-progress-text" id="studyProgressText">准备中...</span>' +
          '<span class="study-progress-text" id="studyCountText"></span>' +
        '</div>' +
        '<div class="study-progress-bar"><div class="study-progress-fill" id="studyProgressFill" style="width:0%"></div></div>' +
        '<div class="card-container">' +
          '<div class="flashcard" id="flashcard">' +
            '<div class="card-face card-front">' +
              '<div class="card-word" id="cardWord">---</div>' +
              '<div class="card-hint">点击卡片翻转查看释义</div>' +
            '</div>' +
            '<div class="card-face card-back">' +
              '<div id="cardFreqBadge"></div>' +
              '<div class="card-meaning" id="cardMeaning"></div>' +
              '<div class="card-phonetic" id="cardPhonetic"></div>' +
              '<div class="card-pos" id="cardPos"></div>' +
              '<div class="card-collocations" id="cardCollocations"></div>' +
              '<div class="card-synonyms" id="cardSynonyms"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="study-actions">' +
          '<button class="btn-dont-know" id="btnDontKnow">不会</button>' +
          '<button class="btn-know" id="btnKnow">会</button>' +
        '</div>' +
        '<div class="study-finished hidden" id="studyFinished">' +
          '<h2>🎉 全部完成！</h2>' +
          '<p>今日任务已完成，明天继续保持！</p>' +
          '<button class="btn-start" id="btnBackHome">返回首页</button>' +
        '</div>' +
      '</div>';

    // Card flip
    document.getElementById('flashcard').addEventListener('click', function() {
      this.classList.toggle('flipped');
    });

    // Action buttons
    document.getElementById('btnKnow').addEventListener('click', function() {
      answerCurrent(true);
    });
    document.getElementById('btnDontKnow').addEventListener('click', function() {
      answerCurrent(false);
    });
    document.getElementById('btnBackHome').addEventListener('click', function() {
      showPage('home');
    });
  }

  function startStudySession() {
    DB.getSetting('mode', 'school').then(function(mode) {
      return DB.getSetting('frequencyFilter', 'all').then(function(freqFilter) {
        return Scheduler.getTodayTasks(mode).then(function(tasks) {
          // Apply frequency filter if set
          var newWords = tasks.newWords;
          var reviewWords = tasks.reviewWords;
          if (freqFilter !== 'all') {
            newWords = newWords.filter(function(w) { return w.frequency === freqFilter; });
            reviewWords = reviewWords.filter(function(w) { return w.frequency === freqFilter; });
          }

          studyNewWords = newWords;
          studyReviewWords = reviewWords;
          studyWords = reviewWords.concat(newWords); // Review first, then new
          studyIndex = 0;

          if (studyWords.length === 0) {
            document.getElementById('studyProgressText').textContent = '暂无任务';
            document.getElementById('studyProgressFill').style.width = '0%';
            document.getElementById('studyCountText').textContent = '0/0';
            document.getElementById('cardWord').textContent = '🎉';
            document.getElementById('flashcard').classList.remove('flipped');
            document.getElementById('btnKnow').style.display = 'none';
            document.getElementById('btnDontKnow').style.display = 'none';
            document.getElementById('studyFinished').classList.remove('hidden');
            return;
          }

          document.getElementById('btnKnow').style.display = '';
          document.getElementById('btnDontKnow').style.display = '';
          document.getElementById('studyFinished').classList.add('hidden');
          showCurrentWord();
        });
      });
    });
  }

  function showCurrentWord() {
    if (studyIndex >= studyWords.length) {
      // All done
      document.getElementById('studyProgressText').textContent = '全部完成';
      document.getElementById('studyProgressFill').style.width = '100%';
      document.getElementById('studyCountText').textContent = studyWords.length + '/' + studyWords.length;
      document.getElementById('cardWord').textContent = '🎉';
      document.getElementById('flashcard').classList.remove('flipped');
      document.getElementById('btnKnow').style.display = 'none';
      document.getElementById('btnDontKnow').style.display = 'none';
      document.getElementById('studyFinished').classList.remove('hidden');
      return;
    }

    var word = studyWords[studyIndex];
    var isReview = studyReviewWords.indexOf(word) >= 0;

    document.getElementById('studyProgressText').textContent = isReview ? '复习' : '新学';
    document.getElementById('studyCountText').textContent = (studyIndex + 1) + '/' + studyWords.length;
    document.getElementById('studyProgressFill').style.width = ((studyIndex / studyWords.length) * 100) + '%';

    document.getElementById('cardWord').textContent = word.word;
    document.getElementById('cardMeaning').textContent = word.meaning;
    document.getElementById('cardPhonetic').textContent = word.phonetic || '';
    document.getElementById('cardPos').textContent = word.pos || '';

    // Frequency badge
    var badge = document.getElementById('cardFreqBadge');
    var freqLabels = { high: '高频', medium: '中频', low: '低频' };
    badge.textContent = freqLabels[word.frequency] || '';
    badge.className = 'freq-badge freq-' + word.frequency;

    var collocations = word.collocations ? '固定搭配: ' + word.collocations : '';
    document.getElementById('cardCollocations').textContent = collocations;

    var synonyms = word.synonymsDiff ? '辨析: ' + word.synonymsDiff : '';
    document.getElementById('cardSynonyms').textContent = synonyms;

    // Reset card
    document.getElementById('flashcard').classList.remove('flipped');
  }

  function answerCurrent(known) {
    if (studyIndex >= studyWords.length) return;
    var word = studyWords[studyIndex];
    var isNew = studyNewWords.indexOf(word) >= 0;

    // Get or create progress
    DB.getProgress(word.id).then(function(prog) {
      if (!prog) {
        prog = Ebbinghaus.createProgress(word.id);
      }
      var updated = Ebbinghaus.processAnswer(prog, known);

      return DB.saveProgress(updated).then(function() {
        return Scheduler.recordWordDone(word.id, isNew).then(function() {
          studyIndex++;
          showCurrentWord();
        });
      });
    });
  }

  // ===== 统计页 =====
  function renderStats(container) {
    container.innerHTML = '<div class="page active"><div style="text-align:center;padding:40px;color:var(--text-secondary)">加载中...</div></div>';

    Promise.all([
      Stats.getWeeklyData(),
      Stats.getDifficultWordsList(20),
      Stats.getFrequencyDistribution(),
      Stats.getCumulativeStats()
    ]).then(function(results) {
      var weekly = results[0];
      var difficult = results[1];
      var freqDist = results[2];
      var cumulative = results[3];

      var maxCount = 1;
      weekly.forEach(function(d) { if (d.count > maxCount) maxCount = d.count; });

      var barsHtml = weekly.map(function(d) {
        var h = maxCount > 0 ? Math.max(4, (d.count / maxCount) * 100) : 4;
        var cls = d.date === Scheduler.todayStr() ? 'chart-bar green' : 'chart-bar';
        return '<div class="chart-bar-col">' +
          '<div class="chart-bar-value">' + d.count + '</div>' +
          '<div class="' + cls + '" style="height:' + h + 'px"></div>' +
          '<div class="chart-bar-label">' + d.day + '</div>' +
        '</div>';
      }).join('');

      var diffHtml = difficult.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);padding:20px">暂无薄弱单词，继续保持！</div>'
        : '<ul class="word-list">' + difficult.map(function(item) {
            return '<li><div><span class="wl-word">' + item.word + '</span> <span class="wl-meaning">' + item.meaning + '</span></div><span class="wl-count">错' + item.reviewCount + '次</span></li>';
          }).join('') + '</ul>';

      container.innerHTML =
        '<div class="page active">' +
          '<div class="stats-section">' +
            '<h3>累计数据</h3>' +
            '<div class="stats-grid">' +
              '<div class="stat-card"><div class="stat-value">' + cumulative.totalDays + '</div><div class="stat-label">累计天数</div></div>' +
              '<div class="stat-card"><div class="stat-value blue">' + cumulative.totalWords + '</div><div class="stat-label">累计背词</div></div>' +
              '<div class="stat-card"><div class="stat-value">' + cumulative.avgPerDay + '</div><div class="stat-label">日均背词</div></div>' +
              '<div class="stat-card"><div class="stat-value blue">' + cumulative.totalLearned + '</div><div class="stat-label">已学单词</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="stats-section">' +
            '<h3>近7天背诵量</h3>' +
            '<div class="chart-bar-row">' + barsHtml + '</div>' +
          '</div>' +
          '<div class="stats-section">' +
            '<h3>分频次掌握</h3>' +
            '<div class="stats-grid">' +
              '<div class="stat-card"><div class="stat-value">' + freqDist.high.mastered + '/' + freqDist.high.total + '</div><div class="stat-label">高频词</div></div>' +
              '<div class="stat-card"><div class="stat-value blue">' + freqDist.medium.mastered + '/' + freqDist.medium.total + '</div><div class="stat-label">中频词</div></div>' +
              '<div class="stat-card"><div class="stat-value">' + freqDist.low.mastered + '/' + freqDist.low.total + '</div><div class="stat-label">低频词</div></div>' +
              '<div class="stat-card"><div class="stat-value blue">' + cumulative.todayDone + '</div><div class="stat-label">今日完成</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="stats-section">' +
            '<h3>薄弱单词 Top ' + Math.min(20, difficult.length) + '</h3>' +
            diffHtml +
          '</div>' +
        '</div>';
    });
  }

  // ===== 设置页 =====
  function renderSettings(container) {
    DB.getAllSettings().then(function(settings) {
      var mode = settings.mode || 'school';
      var morning = settings.reminderMorning || '08:00';
      var evening = settings.reminderEvening || '20:00';
      var freqFilter = settings.frequencyFilter || 'all';

      container.innerHTML =
        '<div class="page active">' +
          '<div class="settings-group">' +
            '<h3>背诵模式</h3>' +
            '<div class="setting-item" id="settingMode">' +
              '<span class="setting-label">当前模式</span>' +
              '<span class="setting-value">' + (mode === 'summer' ? '☀️ 暑假模式' : '📚 学期模式') + '</span>' +
            '</div>' +
            '<div class="setting-item" id="settingFreq">' +
              '<span class="setting-label">词汇筛选</span>' +
              '<span class="setting-value">' + (freqFilter === 'all' ? '全部' : freqFilter === 'high' ? '高频' : freqFilter === 'medium' ? '中频' : '低频') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="settings-group">' +
            '<h3>提醒设置</h3>' +
            '<div class="setting-item" id="settingMorning">' +
              '<span class="setting-label">早间提醒</span>' +
              '<span class="setting-value">' + morning + '</span>' +
            '</div>' +
            '<div class="setting-item" id="settingEvening">' +
              '<span class="setting-label">晚间提醒</span>' +
              '<span class="setting-value">' + evening + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="settings-group">' +
            '<h3>专项背诵</h3>' +
            '<div class="setting-item" id="settingDifficult">' +
              '<span class="setting-label">📕 生词本（薄弱词专项）</span>' +
              '<span class="setting-value">→</span>' +
            '</div>' +
            '<div class="setting-item" id="settingCustomBank">' +
              '<span class="setting-label">📝 自建词库</span>' +
              '<span class="setting-value">→</span>' +
            '</div>' +
          '</div>' +
          '<div class="settings-group">' +
            '<h3>数据管理</h3>' +
            '<button class="btn-danger" id="btnReset">重置所有进度</button>' +
          '</div>' +
        '</div>';

      // Mode toggle
      document.getElementById('settingMode').addEventListener('click', function() {
        var newMode = mode === 'school' ? 'summer' : 'school';
        DB.saveSetting('mode', newMode).then(function() { renderSettings(container); });
      });

      // Frequency filter
      document.getElementById('settingFreq').addEventListener('click', function() {
        var options = ['all', 'high', 'medium', 'low'];
        var idx = options.indexOf(freqFilter);
        var next = options[(idx + 1) % options.length];
        DB.saveSetting('frequencyFilter', next).then(function() { renderSettings(container); });
      });

      // Morning reminder
      document.getElementById('settingMorning').addEventListener('click', function() {
        var t = prompt('请输入早间提醒时间（格式: HH:MM，留空关闭）', morning);
        if (t !== null) {
          DB.saveSetting('reminderMorning', t).then(function() {
            Notifications.setupReminders(t, evening);
            renderSettings(container);
          });
        }
      });

      // Evening reminder
      document.getElementById('settingEvening').addEventListener('click', function() {
        var t = prompt('请输入晚间提醒时间（格式: HH:MM，留空关闭）', evening);
        if (t !== null) {
          DB.saveSetting('reminderEvening', t).then(function() {
            Notifications.setupReminders(morning, t);
            renderSettings(container);
          });
        }
      });

      // Difficult words special study
      document.getElementById('settingDifficult').addEventListener('click', function() {
        DB.getDifficultWords().then(function(difficult) {
          if (difficult.length === 0) {
            alert('暂无薄弱单词，继续保持！');
            return;
          }
          var wordIds = difficult.map(function(p) { return p.wordId; });
          DB.getWordsByIds(wordIds).then(function(words) {
            studyNewWords = [];
            studyReviewWords = words;
            studyWords = words;
            studyIndex = 0;
            showPage('study');
            renderStudyPage(document.getElementById('mainContent'));
            document.getElementById('headerTitle').textContent = '生词本专项';
          });
        });
      });

      // Custom word bank
      document.getElementById('settingCustomBank').addEventListener('click', function() {
        renderCustomBank(document.getElementById('mainContent'));
        document.getElementById('headerTitle').textContent = '自建词库';
      });

      // Reset
      document.getElementById('btnReset').addEventListener('click', function() {
        if (confirm('确定要重置所有学习进度吗？此操作不可恢复！')) {
          if (confirm('再次确认：清除所有背诵记录？')) {
            var delReq = indexedDB.deleteDatabase('VocabApp');
            delReq.onsuccess = function() {
              location.reload();
            };
          }
        }
      });
    });
  }

  // ===== 自建词库 =====
  function renderCustomBank(container) {
    DB.getCustomWords().then(function(words) {
      var listHtml = '';
      if (words.length === 0) {
        listHtml = '<div style="text-align:center;padding:30px;color:var(--text-muted)">还没有自定义单词，点击下方按钮添加</div>';
      } else {
        words.forEach(function(w, i) {
          listHtml += '<div class="word-list-item" style="background:var(--bg-card);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">' +
            '<div><span style="font-weight:600;font-size:15px">' + w.word + '</span> <span style="color:var(--text-secondary);font-size:12px">' + (w.meaning||'') + '</span></div>' +
            '<button style="background:var(--accent-red-bg);border:none;color:var(--accent-red);padding:4px 10px;border-radius:12px;font-size:11px;cursor:pointer" onclick="if(confirm(\'删除 '+w.word+'？\')){DB.deleteCustomWord('+w.id+').then(function(){UI.renderCustomBankUI();})}">✕</button>' +
            '</div>';
        });
      }

      container.innerHTML = '<div class="page active">' +
        '<div style="display:flex;gap:8px;margin-bottom:16px">' +
          '<button class="study-nav-btn active" id="btnCWView">浏览 ('+words.length+')</button>' +
          '<button class="study-nav-btn" id="btnCWAdd">单个添加</button>' +
          '<button class="study-nav-btn" id="btnCWBatch">批量导入</button>' +
        '</div>' +
        '<div id="cwContent">' + listHtml + '</div>' +
        '<button class="btn-start" style="background:var(--accent-green);margin-top:16px" onclick="UI.showPage(\'home\')">返回首页</button>' +
      '</div>';

      document.getElementById('btnCWAdd').addEventListener('click', function() {
        var c = document.getElementById('cwContent');
        c.innerHTML = '<div style="background:var(--bg-card);border-radius:var(--radius);padding:16px">' +
          '<h3 style="margin-bottom:12px">添加单词</h3>' +
          '<input id="cwWord" placeholder="单词" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-primary);border-radius:var(--radius-sm);margin-bottom:8px;font-size:16px">' +
          '<input id="cwPhonetic" placeholder="音标（选填）" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-primary);border-radius:var(--radius-sm);margin-bottom:8px;font-size:14px">' +
          '<input id="cwPos" placeholder="词性（选填）" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-primary);border-radius:var(--radius-sm);margin-bottom:8px;font-size:14px">' +
          '<input id="cwMeaning" placeholder="释义" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-primary);border-radius:var(--radius-sm);margin-bottom:8px;font-size:14px">' +
          '<textarea id="cwCollocations" placeholder="搭配/考点（选填）" rows="2" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-primary);border-radius:var(--radius-sm);margin-bottom:8px;font-size:14px;resize:vertical"></textarea>' +
          '<button class="btn-start" id="btnCWSave">保存</button></div>';
        document.getElementById('btnCWSave').addEventListener('click', function() {
          var w = {
            word: document.getElementById('cwWord').value.trim(),
            phonetic: document.getElementById('cwPhonetic').value.trim(),
            pos: document.getElementById('cwPos').value.trim(),
            meaning: document.getElementById('cwMeaning').value.trim(),
            collocations: document.getElementById('cwCollocations').value.trim()
          };
          if (!w.word || !w.meaning) { alert('单词和释义为必填'); return; }
          DB.addCustomWord(w).then(function() {
            renderCustomBank(container);
            document.getElementById('headerTitle').textContent = '自建词库';
          });
        });
      });

      document.getElementById('btnCWBatch').addEventListener('click', function() {
        var c = document.getElementById('cwContent');
        c.innerHTML = '<div style="background:var(--bg-card);border-radius:var(--radius);padding:16px">' +
          '<h3 style="margin-bottom:8px">批量导入单词</h3>' +
          '<p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">每行一个单词，格式: <b>单词 — 释义</b> 或 <b>单词 释义</b></p>' +
          '<p style="font-size:11px;color:var(--accent-orange);margin-bottom:8px">示例:<br>abandon — 放弃；抛弃<br>achieve — 实现；达到<br>brilliant — 杰出的；明亮的</p>' +
          '<textarea id="cwBatchText" placeholder="粘贴单词列表..." rows="10" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-primary);border-radius:var(--radius-sm);margin-bottom:8px;font-size:13px;resize:vertical;font-family:monospace"></textarea>' +
          '<button class="btn-start" id="btnCWImport">解析并导入</button>' +
          '<div id="cwBatchResult" style="margin-top:8px;font-size:13px"></div></div>';
        document.getElementById('btnCWImport').addEventListener('click', function() {
          var text = document.getElementById('cwBatchText').value.trim();
          if (!text) return;
          var lines = text.split('\n');
          var words = [];
          lines.forEach(function(line) {
            line = line.trim();
            if (!line) return;
            var sep = ' — ';
            var idx = line.indexOf(sep);
            if (idx === -1) { sep = '—'; idx = line.indexOf(sep); }
            if (idx === -1) { sep = ' - '; idx = line.indexOf(sep); }
            if (idx === -1) { sep = '-'; idx = line.indexOf(sep); }
            if (idx === -1) { sep = '  '; idx = line.indexOf('  '); }
            if (idx === -1) { sep = '\t'; idx = line.indexOf('\t'); }
            if (idx > 0) {
              var word = line.substring(0, idx).trim();
              var meaning = line.substring(idx + sep.length).trim();
              if (word && meaning) words.push({ word: word, meaning: meaning });
            }
          });
          if (words.length === 0) { document.getElementById('cwBatchResult').innerHTML = '<span style="color:var(--accent-red)">未识别到有效单词，请检查格式</span>'; return; }
          DB.addCustomWords(words).then(function(count) {
            document.getElementById('cwBatchResult').innerHTML = '<span style="color:var(--accent-green)">成功导入 ' + count + ' 个单词！</span>';
            document.getElementById('cwBatchText').value = '';
            setTimeout(function() { renderCustomBank(container); }, 1000);
          });
        });
      });
    });
  }

  return {
    showPage: showPage,
    startStudySession: startStudySession,
    renderCustomBankUI: function() { renderCustomBank(document.getElementById('mainContent')); }
  };
})();
