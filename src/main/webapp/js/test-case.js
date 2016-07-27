document.addEventListener('DOMContentLoaded', function() {
  var chartsAPILoaded = false;

  // Get query parameters from URL.
  var buildName = vUtil.getURLParameter('b');
  var testName = vUtil.getURLParameter('test_full_name');
  var startTime = parseInt(vUtil.getURLParameter('start'));
  var endTime = parseInt(vUtil.getURLParameter('end'));
  var filters = (vUtil.getURLParameter('f') || '').split(',');
  var subBuildLabels = vUtil.getURLParameter('labels') || '';

  // Set up time period picker.
  var $picker = timePeriodPicker.init({
    onTimePeriodChanged: function(start, end) {
      startTime = start;
      endTime = end;
      loadTestCaseDetails();
    }
  });
  $picker.insertAfter($j('#item-input-container'));
  timePeriodPicker.setup(startTime, endTime);
  if (!startTime && !endTime) {
    var t = timePeriodPicker.getStartAndEndTime();
    startTime = t.startTime;
    endTime = t.endTime;
  }

  // Prepare drop down menu for choosing test cases.
  it.getAvailableTestCases(startTime, endTime, function(t) {
    var d = t.responseObject();
    if (d.errMsg !== '') {
      return;
    }

    // From test case labels to their test case objs.
    var labelToTestCase = {};
    d.tests.map(function(test) {
      var label = createTestCaseLabel(test.test_full_name,
          test.jenkins_project, test.sub_build_labels || '');
      labelToTestCase[label] = test;
    });

    // Setup typeahead.
    var $testCaseInput = $j('#item-input');
    $testCaseInput.typeahead({
      hint: true,
      highlight: true,
      minLength: 1
    }, {
      source: vUtil.substringMatcher(Object.keys(labelToTestCase).sort()),
      limit: 200
    });
    $testCaseInput.bind('typeahead:select', function(ev, label) {
      var testCase = labelToTestCase[label];
      if (testCase) {
        testName = testCase.test_full_name;
        buildName = testCase.jenkins_project;
        subBuildLabels = testCase.sub_build_labels || '';
        loadTestCaseDetails();
      }
    });
  });
  
  if (testName) {
    var initTestCaseLabel = createTestCaseLabel(testName, buildName,
        subBuildLabels);
    $j('#item-input').val(initTestCaseLabel);

    // Start loading data.
    loadTestCaseDetails();
  } else {
    $j('#details-loading').hide();
  }

  /**
   * Loads test case details.
   */
  function loadTestCaseDetails() {
    $j('#details-content').hide();
    $j('#details-loading').text('loading...').show();
    $j('#details-table').empty();

    it.getTestCaseDetails(startTime, endTime, testName, buildName,
        subBuildLabels, function(t) {
          var d = t.responseObject();
          if (d.errMsg !== '') {
            $j('#details-loading').hide();
            $j('#details-err-msg').html(d.errMsg).show();
            return;
          }

          if (d.tests.length === 0) {
            $j('#details-loading').text('No test cases in this time period');
            return;
          }

          if (chartsAPILoaded) {
            renderContent(d.tests);
          } else {
            google.charts.load('current', {
              packages: [
                'corechart'
              ]
            });
            google.charts.setOnLoadCallback(function() {
              chartsAPILoaded = true;
              renderContent(d.tests);
            });
          }
        });
  }

  /**
   * Show test cases in a table and several graphs.
   */
  function renderContent(testCases) {
    vUtil.renderItemsInTableAndGraphs(testCases, 'build_number', [
      'PASSED', 'FAILED', 'SKIPPED'
    ], 'Tests', filters);
  }

  function createTestCaseLabel(testName, build, subBuildLabels) {
    var ret = vUtil.cleanupTestLabel(testName);
    var parts = [
      build
    ];
    if (subBuildLabels !== '') {
      parts.push(subBuildLabels);
    }
    return ret + ' (' + parts.join(',') + ')';
  }
});