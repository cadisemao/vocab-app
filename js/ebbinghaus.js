// 艾宾浩斯遗忘曲线算法引擎
var Ebbinghaus = (function() {
  // 7级复习节点（分钟）
  var INTERVALS = [0, 5, 30, 720, 1440, 2880, 10080, 21600]; // 0, 5m, 30m, 12h, 1d, 2d, 7d, 15d
  var MASTERED_STAGE = 8;

  // 根据stage计算下次复习时间(毫秒时间戳)
  function getNextReviewTime(stage) {
    if (stage >= MASTERED_STAGE) return Number.MAX_SAFE_INTEGER;
    var now = Date.now();
    var intervalMinutes = INTERVALS[Math.min(stage, INTERVALS.length - 1)];
    return now + intervalMinutes * 60 * 1000;
  }

  // 处理答题结果，返回更新后的进度对象
  // known: true=会, false=不会
  function processAnswer(progress, known) {
    var p = Object.assign({}, progress);
    p.reviewCount = (p.reviewCount || 0) + 1;

    if (known) {
      p.consecutiveCorrect = (p.consecutiveCorrect || 0) + 1;
      // 连续答对3次可以加速晋级
      if (p.consecutiveCorrect >= 3 && p.stage < MASTERED_STAGE) {
        p.stage = Math.min(p.stage + 2, MASTERED_STAGE);
      } else {
        p.stage = Math.min(p.stage + 1, MASTERED_STAGE);
      }
    } else {
      p.consecutiveCorrect = 0;
      // 不会：stage退2级，最少到0
      p.stage = Math.max(0, p.stage - 2);
      p.isDifficult = 1;
    }

    p.nextReview = getNextReviewTime(p.stage);
    p.lastResult = known ? 1 : 0;
    return p;
  }

  // 创建初始进度对象
  function createProgress(wordId) {
    return {
      wordId: wordId,
      stage: 0,
      nextReview: getNextReviewTime(0),
      reviewCount: 0,
      consecutiveCorrect: 0,
      isDifficult: 0,
      lastResult: 0,
      createdAt: Date.now()
    };
  }

  // 获取stage名称（用于展示）
  function getStageLabel(stage) {
    if (stage >= MASTERED_STAGE) return '已掌握';
    var labels = ['新学', '5分钟', '30分钟', '12小时', '1天', '2天', '7天', '15天'];
    return labels[stage] || '复习';
  }

  // 判断单词是否已掌握
  function isMastered(stage) {
    return stage >= MASTERED_STAGE;
  }

  // 计算记忆留存率（粗略估算）
  function getRetentionRate(progressList) {
    if (!progressList || progressList.length === 0) return 0;
    var total = progressList.length;
    var retained = progressList.filter(function(p) {
      return p.lastResult === 1;
    }).length;
    return Math.round((retained / total) * 100);
  }

  return {
    INTERVALS: INTERVALS,
    MASTERED_STAGE: MASTERED_STAGE,
    getNextReviewTime: getNextReviewTime,
    processAnswer: processAnswer,
    createProgress: createProgress,
    getStageLabel: getStageLabel,
    isMastered: isMastered,
    getRetentionRate: getRetentionRate
  };
})();
