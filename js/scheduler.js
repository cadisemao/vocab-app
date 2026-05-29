// 每日任务调度器
var Scheduler = (function() {
  // 学期模式默认值
  var SCHOOL_NEW = 18;   // 每日新词 15-20
  var SCHOOL_MAX = 40;   // 每日总量 ≤40

  // 暑假模式默认值
  var SUMMER_NEW = 32;   // 每日新词 30-35
  var SUMMER_MAX = 70;   // 每日总量 ≤70

  var TOTAL_WORDS = 1600;

  function getConfig(mode) {
    if (mode === 'summer') {
      return { newPerDay: SUMMER_NEW, maxTotal: SUMMER_MAX };
    }
    return { newPerDay: SCHOOL_NEW, maxTotal: SCHOOL_MAX };
  }

  // 获取今日日期字符串 YYYY-MM-DD
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // 获取今天的任务列表
  // 返回: { newWords: [...], reviewWords: [...], total: N }
  function getTodayTasks(mode) {
    var config = getConfig(mode);
    var now = Date.now();
    var dateStr = todayStr();

    return DB.getDueReviews(now).then(function(dueReviews) {
      // 按 overdue 程度排序（越早该复习的越优先）
      dueReviews.sort(function(a, b) { return a.nextReview - b.nextReview; });

      // 检查今日日志是否已有记录
      return DB.getDailyLog(dateStr).then(function(todayLog) {
        var newWordIdsDone = todayLog ? (todayLog.newWordIds || []) : [];
        var reviewWordIdsDone = todayLog ? (todayLog.reviewWordIds || []) : [];

        // 过滤掉今天已经完成的
        dueReviews = dueReviews.filter(function(r) {
          return reviewWordIdsDone.indexOf(r.wordId) === -1;
        });

        var remainingSlots = config.maxTotal - reviewWordIdsDone.length - newWordIdsDone.length;

        if (remainingSlots <= 0 || dueReviews.length >= remainingSlots) {
          // 全是复习词，或配额已满
          return DB.getWordsByIds(dueReviews.slice(0, Math.max(remainingSlots, 0)).map(function(r) { return r.wordId; }))
            .then(function(words) {
              return { newWords: [], reviewWords: words, total: words.length };
            });
        }

        // 复习词占一部分配额，剩余给新词
        var reviewQuota = Math.min(dueReviews.length, remainingSlots);
        var reviewWords = dueReviews.slice(0, reviewQuota);
        var newQuota = Math.min(config.newPerDay - newWordIdsDone.length, remainingSlots - reviewQuota);

        if (newQuota <= 0) {
          return DB.getWordsByIds(reviewWords.map(function(r) { return r.wordId; }))
            .then(function(words) {
              return { newWords: [], reviewWords: words, total: words.length };
            });
        }

        // 获取新词：优先高频词，排除已学过的
        return DB.getAllProgress().then(function(allProgress) {
          var learnedIds = {};
          allProgress.forEach(function(p) { learnedIds[p.wordId] = true; });

          return DB.getWordsByFrequency('high').then(function(highWords) {
            return DB.getWordsByFrequency('medium').then(function(medWords) {
              return DB.getWordsByFrequency('low').then(function(lowWords) {
                return DB.getCustomWords().then(function(customWords) {
                var candidates = highWords.concat(medWords).concat(lowWords).concat(customWords);
                var newWords = [];
                for (var i = 0; i < candidates.length && newWords.length < newQuota; i++) {
                  if (!learnedIds[candidates[i].id] && newWordIdsDone.indexOf(candidates[i].id) === -1) {
                    newWords.push(candidates[i]);
                  }
                }

                return DB.getWordsByIds(reviewWords.map(function(r) { return r.wordId; }))
                  .then(function(revWords) {
                    return { newWords: newWords, reviewWords: revWords, total: newWords.length + revWords.length };
                  });
              });
            });
          });
        });
      });
    });
  }

  // 记录今日完成一个单词
  function recordWordDone(wordId, isNew) {
    var dateStr = todayStr();
    return DB.getDailyLog(dateStr).then(function(log) {
      if (!log) {
        log = { date: dateStr, newWordIds: [], reviewWordIds: [], totalWords: 0, timeSpent: 0 };
      }
      if (isNew) {
        if (log.newWordIds.indexOf(wordId) === -1) log.newWordIds.push(wordId);
      } else {
        if (log.reviewWordIds.indexOf(wordId) === -1) log.reviewWordIds.push(wordId);
      }
      log.totalWords = log.newWordIds.length + log.reviewWordIds.length;
      return DB.saveDailyLog(log);
    });
  }

  // 获取整体进度数据
  function getOverallProgress() {
    return DB.getWordCount().then(function(total) {
      return DB.getNewWordCount().then(function(learned) {
        return DB.getMasteredCount().then(function(mastered) {
          return {
            totalWords: total,
            learnedWords: learned,
            masteredWords: mastered,
            remainingWords: total - learned,
            percentComplete: total > 0 ? Math.round((learned / total) * 100) : 0,
            percentMastered: total > 0 ? Math.round((mastered / total) * 100) : 0
          };
        });
      });
    });
  }

  // 估算剩余天数
  function estimateRemainingDays(mode) {
    var config = getConfig(mode);
    return DB.getWordCount().then(function(total) {
      return DB.getNewWordCount().then(function(learned) {
        var remaining = total - learned;
        return Math.ceil(remaining / config.newPerDay);
      });
    });
  }

  return {
    getConfig: getConfig,
    todayStr: todayStr,
    getTodayTasks: getTodayTasks,
    recordWordDone: recordWordDone,
    getOverallProgress: getOverallProgress,
    estimateRemainingDays: estimateRemainingDays,
    TOTAL_WORDS: TOTAL_WORDS
  };
})();
