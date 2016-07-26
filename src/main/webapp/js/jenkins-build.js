document.addEventListener('DOMContentLoaded', function() {
  var chartsAPILoaded = false;

  // Get query parameters from URL.
  var buildName = vUtil.getURLParameter('b');
  var startTime = parseInt(vUtil.getURLParameter('start'));
  var endTime = parseInt(vUtil.getURLParameter('end'));
  var filters = (vUtil.getURLParameter('f') || '').split(',');
  var subBuildLabels = vUtil.getURLParameter('labels') || '';
  var initBuildLabel = createBuildLabel(buildName, subBuildLabels);
  $j('#item-input').val(initBuildLabel);

  // Prepare drop down menu for choosing different Jenkins
  // build.
  it.getAvailableJenkinsBuilds(startTime, endTime, function(t) {
    var d = t.responseObject();
    if (d.errMsg !== '') {
      return;
    }

    // From build labels to their build objs.
    var labelToBuild = {};
    d.builds.map(function(build) {
      var label = createBuildLabel(build.jenkins_project,
          build.sub_build_labels || '');
      labelToBuild[label] = build;
    });

    // Setup typeahead.
    var $buildNameInput = $j('#item-input');
    $buildNameInput.typeahead({
      hint: true,
      highlight: true,
      minLength: 1
    }, {
      source: vUtil.substringMatcher(Object.keys(labelToBuild).sort()),
      limit: 100
    });
    $buildNameInput.bind('typeahead:select', function(ev, label) {
      var build = labelToBuild[label];
      if (build) {
        buildName = build.jenkins_project;
        subBuildLabels = build.sub_build_labels || '';
        loadJenkinsBuildDetails();
      }
    });
  });

  // Set up time period picker.
  var $picker = timePeriodPicker.init({
    onTimePeriodChanged: function(start, end) {
      startTime = start;
      endTime = end;
      loadJenkinsBuildDetails();
    }
  });
  $picker.insertAfter($j('#item-input-container'));
  timePeriodPicker.setup(startTime, endTime);

  // Start loading data.
  loadJenkinsBuildDetails();

  /**
   * Loads jenkins build details.
   */
  function loadJenkinsBuildDetails() {
    $j('#details-content').hide();
    $j('#details-loading').text('loading...').show();
    $j('#details-table').empty();

    it.getJenkinsBuildDetails(startTime, endTime, buildName, subBuildLabels,
        function(t) {
          var d = t.responseObject();
          if (d.errMsg !== '') {
            $j('#details-loading').hide();
            $j('#details-err-msg').html(d.errMsg).show();
            return;
          }

          if (d.builds.length === 0) {
            $j('#details-loading').text('No builds in this time period');
            return;
          }

          if (chartsAPILoaded) {
            renderContent(d.builds);
          } else {
            google.charts.load('current', {
              packages: [
                'corechart'
              ]
            });
            google.charts.setOnLoadCallback(function() {
              chartsAPILoaded = true;
              renderContent(d.builds);
            });
          }
        });
  }

  /**
   * Show builds in a table and several graphs.
   */
  function renderContent(builds) {
    vUtil.renderItemsInTableAndGraphs(builds, 'build_number', [
      'SUCCESS', 'UNSTABLE', 'FAILURE', 'ABORTED'
    ], 'Builds', filters);
  }

  function createBuildLabel(build, subBuildLabels) {
    if (subBuildLabels === '') {
      return build;
    }
    return build + ' (' + subBuildLabels + ')';
  }
});
