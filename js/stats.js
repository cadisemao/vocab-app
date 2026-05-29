// 数据统计模块
var Stats = (function() {

  // 获取仪表盘数据
  function getDashboardData() {
    return Scheduler.getOverallProgress().then(function(progress) {
      return DB.getAllProgress().then(function(allProgress) {
        var retention = Ebbinghaus.getRetentionRate(allProgress);
        return DB.getDifficultWords().then(function(difficult) {
          return {
            progress: progress,
            retention: retention,
            difficultCount: difficult.length,
            totalProgress: allProgress.length
          };
        });
      });
    });
  }

  // 获取近7天背诵量（用于柱状图）
  function getWeeklyData() {
    var result = [];
    var today = new Date();

    return DB.getRecentLogs(7).then(function(logs) {
      var logMap = {};
      logs.forEach(function(log) {
        logMap[log.date] = log.totalWords || 0;
      });

      for (var i = 6; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var dateStr = d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
        var dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
        result.push({
          date: dateStr,
          day: dayLabels[d.getDay()],
          count: logMap[dateStr] || 0
        });
      }
      return result;
    });
  }

  // 获取薄弱单词列表（Top N）
  function getDifficultWordsList(limit) {
    limit = limit || 20;
    return DB.getDifficultWords().then(function(difficult) {
      // Sort by reviewCount desc (most reviewed = hardest)
      difficult.sort(function(a, b) { return (b.reviewCount || 0) - (a.reviewCount || 0); });
      var topN = difficult.slice(0, limit);
      var wordIds = topN.map(function(p) { return p.wordId; });
      return DB.getWordsByIds(wordIds).then(function(words) {
        var wordMap = {};
        words.forEach(function(w) { wordMap[w.id] = w; });
        return topN.map(function(p) {
          var w = wordMap[p.wordId];
          return {
            word: w ? w.word : '?',
            meaning: w ? w.meaning : '',
            reviewCount: p.reviewCount || 0,
            stage: p.stage
          };
        });
      });
    });
  }

  // 获取各等级词汇掌握分布
  function getFrequencyDistribution() {
    return DB.getAllProgress().then(function(allProgress) {
      var progressMap = {};
      allProgress.forEach(function(p) { progressMap[p.wordId] = p; });

      var result = { high: { total: 0, learned: 0, mastered: 0 },
                     medium: { total: 0, learned: 0, mastered: 0 },
                     low: { total: 0, learned: 0, mastered: 0 } };

      return DB.getAllWords().then(function(allWords) {
        allWords.forEach(function(w) {
          var cat = result[w.frequency];
          if (!cat) return;
          cat.total++;
          var p = progressMap[w.id];
          if (p) {
            cat.learned++;
            if (Ebbinghaus.isMastered(p.stage)) cat.mastered++;
          }
        });
        return result;
      });
    });
  }

  // 获取累计统计数据
  function getCumulativeStats() {
    return DB.getRecentLogs(365).then(function(logs) {
      var totalDays = logs.length;
      var totalWords = 0;
      logs.forEach(function(l) { totalWords += (l.totalWords || 0); });

      return DB.getAllProgress().then(function(allProgress) {
        var todayReviews = 0;
        var today = Scheduler.todayStr();
        var todayLog = null;
        for (var i = logs.length - 1; i >= 0; i--) {
          if (logs[i].date === today) { todayLog = logs[i]; break; }
        }

        return {
          totalDays: totalDays,
          totalWords: totalWords,
          avgPerDay: totalDays > 0 ? Math.round(totalWords / totalDays) : 0,
          totalLearned: allProgress.length,
          todayDone: todayLog ? todayLog.totalWords : 0
        };
      });
    });
  }

  return {
    getDashboardData: getDashboardData,
    getWeeklyData: getWeeklyData,
    getDifficultWordsList: getDifficultWordsList,
    getFrequencyDistribution: getFrequencyDistribution,
    getCumulativeStats: getCumulativeStats
  };
})();
