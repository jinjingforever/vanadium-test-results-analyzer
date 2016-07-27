var timePeriodPicker = function() {
  var DURATION_TO_SECS = {
    '6h': 3600 * 6,
    '12h': 3600 * 12,
    '1d': 3600 * 24,
    '3d': 3600 * 24 * 3,
    '1w': 3600 * 24 * 7,
    '2w': 3600 * 24 * 14,
    '1m': 3600 * 24 * 30,
    '2m': 3600 * 24 * 60,
    '3m': 3600 * 24 * 90,
    '6m': 3600 * 24 * 180
  };

  var DEFAULT_DURATION = '1w';

  var SORTED_DURATIONS = [
    '6h', '12h', '1d', '3d', '1w', '2w', '1m', '2m', '3m', '6m'
  ];

  var curStartTime, curEndTime;
  var lastManualUpdateStartDate, lastManualUpdateEndDate;

  var options;

  function init(opts) {
    options = opts;

    // Create DOM elements.
    var $c = $j('<div class="v-time-period-picker-container"></div>');
    $c.append($j('<div class="v-title">Time Period</div>'));

    var $startEndTimeContainer = $j('<div id="v-start-end-time-container"></div>');
    $startEndTimeContainer.append($j('<input type="text" id="start-time-input"></input>'));
    $startEndTimeContainer.append($j('<span>-</span>'));
    $startEndTimeContainer.append($j('<input type="text" id="end-time-input"></input>'));
    $startEndTimeContainer.append($j('<span id="btn-update">update</span>'));
    $c.append($startEndTimeContainer);

    var $durations = $j('<div id="durations-container"></div>');
    SORTED_DURATIONS.forEach(function(d) {
      if (d === DEFAULT_DURATION) {
        $durations.append($j('<div class="selected">' + d + '</div>'));
      } else {
        $durations.append($j('<div>' + d + '</div>'));
      }
    });
    $c.append($durations);

    return $c;
  }

  function setup(startTime, endTime) {
    // Set up handlers for duration selectors.
    $j('#durations-container div').click(function() {
      $j('#durations-container div').removeClass('selected');
      $j(this).addClass('selected');
      var tpSecs = DURATION_TO_SECS[$j(this).text()];
      if (tpSecs) {
        curEndTime = new Date().getTime();
        curStartTime = curEndTime - tpSecs * 1000;
        $j('#btn-update').hide();
        updateTimeLabels();
        if (options.onTimePeriodChanged) {
          options.onTimePeriodChanged(curStartTime, curEndTime);
        }
      }
    });

    // Set up datetime pickers.
    $j('#start-time-input').datetimepicker({
      onChangeDateTime: function(dp, $input) {
        if ($input.val() !== lastManualUpdateStartDate) {
          curStartTime = dp.getTime();
        }
        startOrEndTimeChanged();
      }
    });
    $j('#end-time-input').datetimepicker({
      onChangeDateTime: function(dp, $input) {
        if ($input.val() !== lastManualUpdateEndDate) {
          curEndTime = dp.getTime();
        }
        startOrEndTimeChanged();
      }
    });

    // Click handler for the "update" button.
    $j('#btn-update').click(function() {
      lastManualUpdateStartDate = $j('#start-time-input').val();
      lastManualUpdateEndDate = $j('#end-time-input').val();
      $j('#btn-update').hide();
      if (options.onTimePeriodChanged) {
        options.onTimePeriodChanged(curStartTime, curEndTime);
      }
    });

    // Set start and end time.
    if (!startTime && !endTime) {
      curEndTime = new Date().getTime();
      curStartTime = curEndTime - DURATION_TO_SECS[DEFAULT_DURATION] * 1000;
    } else {
      $j('#durations-container div').removeClass('selected');
      if (startTime) {
        curStartTime = startTime;
      }
      if (endTime) {
        curEndTime = endTime;
      }
    }
    updateTimeLabels();
    lastManualUpdateStartTime = $j('#start-time-input').val();
    lastManualUpdateEndTime = $j('#end-time-input').val();
  }

  function getStartAndEndTime() {
    return {
      startTime: curStartTime,
      endTime: curEndTime
    };
  }

  function updateTimeLabels() {
    $j('#start-time-input').val(vUtil.dateFormatterWithoutSeconds(curStartTime));
    $j('#end-time-input').val(vUtil.dateFormatterWithoutSeconds(curEndTime));
  }

  function startOrEndTimeChanged() {
    if ($j('#start-time-input').val() !== lastManualUpdateStartTime ||
        $j('#end-time-input').val() !== lastManualUpdateEndTime) {
      $j('#btn-update').show();
      $j('#durations-container div').removeClass('selected');
    } else {
      $j('#btn-update').hide();
    }
  }

  return {
    init: init,
    setup: setup,
    getStartAndEndTime: getStartAndEndTime
  };
}();