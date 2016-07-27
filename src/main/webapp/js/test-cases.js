document.addEventListener('DOMContentLoaded', function() {
  var COLS = [
    {
      key: 'test_full_name',
      label: 'test name',
      dataSort: 'string',
    }, {
      key: 'jenkins_project',
      label: 'project',
      dataSort: 'string',
    }, {
      key: 'sub_build_labels',
      label: 'sub build',
      dataSort: 'string',
    }, {
      key: 'avg_duration',
      label: 'avg dur.',
      dataSort: 'int',
      formatter: vUtil.humanReadableDurationFormatter,
    }, {
      key: 'min_duration',
      label: 'min dur.',
      dataSort: 'int',
      formatter: vUtil.humanReadableDurationFormatter,
    }, {
      key: 'max_duration',
      label: 'max dur.',
      dataSort: 'int',
      formatter: vUtil.humanReadableDurationFormatter,
    }, {
      key: 'count',
      label: 'total #',
      dataSort: 'int',
    }, {
      key: 'failed_count',
      label: 'failed #',
      dataSort: 'int',
    }
  ];

  var curStartTime, curEndTime;

  var $loadingMsg = $j('#loading-msg');
  var $mainContent = $j('#content');

  // Set up time period picker.
  var $picker = timePeriodPicker.init({
    onTimePeriodChanged: function(startTime, endTime) {
      curStartTime = startTime;
      curEndTime = endTime;
      loadTestResultsData();
    }
  });
  $picker.insertAfter($j('#test-results-container h2'));
  timePeriodPicker.setup();

  // Get data
  curStartTime = timePeriodPicker.getStartAndEndTime().startTime;
  curEndTime = timePeriodPicker.getStartAndEndTime().endTime;
  loadTestResultsData();

  /**
   * Starts loading test results data.
   */
  function loadTestResultsData() {
    $loadingMsg.show();
    $mainContent.hide();
    $j('#test-results-container table').remove();
    it.getTestResults(curStartTime, curEndTime, testResultsDataReceived);
  }

  /**
   * Called when test results data is received from the corresponding Java call.
   */
  function testResultsDataReceived(t) {
    $j('#test-results-container table').remove();
    $loadingMsg.hide();

    // Show error message if there is any.
    var d = t.responseObject();
    console.log(d);
    var $errMsg = $j('#test-results-container #err-msg');
    $errMsg.hide().text('');
    if (d.errMsg !== '') {
      $errMsg.html(d.errMsg).show();
      return;
    }

    // Create table for failed tests.
    if (d.failedTests.length === 0) {
      $j('#failed-tests-table-container').append(
          $j('<div></div>').addClass('msg').text(
              'No failed tests found in this time period'));
    } else {
      var $table = createTestsTable(d.failedTests, 'failed_count', d.startTime,
          d.endTime);
      $j('#failed-tests-table-container').append($table);
    }

    // Create table for longest tests.
    if (d.longestTests.length === 0) {
      $j('#longest-tests-table-container').append(
          $j('<div></div>').addClass('msg').text(
              'No tests found in this time period'));
    } else {
      var $table = createTestsTable(d.longestTests, 'avg_duration',
          d.startTime, d.endTime);
      $j('#longest-tests-table-container').append($table);
    }

    $mainContent.show();
  }

  function createTestsTable(items, defaultColumnKey, startTime, endTime) {
    var $table = vUtil.createTable(COLS, items, defaultColumnKey,
        function(colKey, label, item) {
          var commonParams = {
            'start': startTime,
            'end': endTime,
            'test_full_name': item.test_full_name,
            'b': item.jenkins_project,
            'labels': item.sub_build_labels || '',
          };
          if (colKey === 'test_full_name') {
            var href = 'test-case?' +
                Object.keys(commonParams).map(function(k) {
                  return k + '=' + encodeURIComponent(commonParams[k]);
                }).join('&');
            var modifiedLabel = vUtil.cleanupTestLabel(label);
            var $link = $j('<a></a>').attr('href', href).attr('target',
                '_blank').addClass('test-case-link').text(modifiedLabel);
            return $link;
          } else if (colKey === 'jenkins_project') {
            var href = 'jenkins-build?' +
                Object.keys(commonParams).map(function(k) {
                  return k + '=' + encodeURIComponent(commonParams[k]);
                }).join('&');
            var $link = $j('<a></a>').attr('href', href).attr('target',
                '_blank').text(label);
            return $link;
          } else if (colKey === 'sub_build_labels') {
            var $ret = $j('<span></span>').addClass('sub-build-cell').text(
                label === undefined ? 'none' : label);
            if (label === undefined) {
              $ret.addClass('no-sub-build');
            }
            return $ret
          } else if (colKey === 'failed_count') {
            if (label === 0) {
              return $j('<span>0</span>').addClass('zero-value');
            } else {
              var params = $j.extend({}, commonParams);
              params.f = 'FAILED';
              var href = 'test-result?' + Object.keys(params).map(function(k) {
                return k + '=' + encodeURIComponent(params[k]);
              }).join('&');
              var $ret = $j('<a></a>').attr('class', 'failed problems').attr(
                  'href', href).attr('target', '_blank').text(label);
              return $ret;

            }
          } else {
            return document.createTextNode(label);
          }
        });
    return $table;
  }
});