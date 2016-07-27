document.addEventListener(
    'DOMContentLoaded',
    function() {
      var COLS = [
        {
          key: 'jenkins_project',
          label: 'project',
          dataSort: 'string',
        }, {
          key: 'avg',
          label: 'avg dur.',
          dataSort: 'int',
          formatter: vUtil.humanReadableDurationFormatter,
        }, {
          key: 'min',
          label: 'min dur.',
          dataSort: 'int',
          formatter: vUtil.humanReadableDurationFormatter,
        }, {
          key: 'max',
          label: 'max dur.',
          dataSort: 'int',
          formatter: vUtil.humanReadableDurationFormatter,
        }, {
          key: 'count',
          label: 'total #',
          dataSort: 'int',
        }, {
          key: 'success_count',
          label: 'success #',
          dataSort: 'int',
        }, {
          key: 'unstable_count',
          label: 'unstable #',
          dataSort: 'int',
        }, {
          key: 'failure_count',
          label: 'failure #',
          dataSort: 'int',
        }, {
          key: 'aborted_count',
          label: 'aborted #',
          dataSort: 'int',
        },
      ];

      var curStartTime, curEndTime;
      var curFilterProjectName = '';

      // Root build name to rows of its sub builds.
      var rootBuildToSubBuildRows = {};

      // Tree states (open/close) of all root builds.
      var rootBuildsTreeStats = {};

      var $loadingMsg = $j('#loading-msg');
      var $mainContent = $j('#content');

      // Set up time period picker.
      var $picker = timePeriodPicker.init({
        onTimePeriodChanged: function(startTime, endTime) {
          curStartTime = startTime;
          curEndTime = endTime;
          loadJenkinsBuildsData();
        }
      });
      $picker.insertAfter($j('#jenkins-builds-container h2'));
      timePeriodPicker.setup();

      // Get data.
      curStartTime = timePeriodPicker.getStartAndEndTime().startTime;
      curEndTime = timePeriodPicker.getStartAndEndTime().endTime;
      loadJenkinsBuildsData();

      /**
       * Starts loading jenkins builds data.
       */
      function loadJenkinsBuildsData() {
        $loadingMsg.show();
        $mainContent.hide();
        $j('#jenkins-builds-container table').remove();
        it.getJenkinsBuildsInfo(curStartTime, curEndTime,
            jenkinsBuildsDataReceived);
      }

      /**
       * Called when jenkins builds data is received from the corresponding Java
       * call.
       */
      function jenkinsBuildsDataReceived(t) {
        $j('#jenkins-builds-container table').remove();
        $loadingMsg.hide();

        // Show error message if there is any.
        var d = t.responseObject();
        console.log(d);
        var $errMsg = $j('#jenkins-builds-container #err-msg');
        $errMsg.hide().text('');
        if (d.errMsg !== '') {
          $errMsg.html(d.errMsg).show();
          return;
        }

        // Create table.
        var hasSubBuilds = {};
        d.items.forEach(function(item) {
          if (item.sub_build_labels) {
            hasSubBuilds[item['jenkins_project']] = 1;
          }
        })

        var $table = vUtil.createTable(
            COLS,
            d.items,
            'avg',
            function(colKey, label, item) {
              var isRootBuild = !item.sub_build_labels;
              var commonParams = {
                'start': d.startTime,
                'end': d.endTime,
                'labels': item.sub_build_labels || '',
              };
              if (colKey === 'jenkins_project') {
                // "project" column. Create a link to
                // its build details page.
                var params = $j.extend({}, commonParams);
                params.b = label;
                var href = 'jenkins-build?' +
                    Object.keys(params).map(function(k) {
                      return k + '=' + encodeURIComponent(params[k]);
                    }).join('&');
                var $c = $j('<div></div>').addClass('build-name-container');
                var $img = $j('<div></div>').addClass('build-name-img');
                var $link = $j('<a></a>').attr('href', href).attr('target',
                    '_blank');
                $c.append($img, $link);
                if (isRootBuild) {
                  $link.text(label);
                  if (hasSubBuilds[label]) {
                    var curTreeState = rootBuildsTreeStats[label];
                    if (curTreeState === 1) {
                      $c.addClass('tree-open');
                    } else if (curTreeState === 0) {
                      $c.addClass('tree-close');
                    } else {
                      $c.addClass('tree-close');
                      rootBuildsTreeStats[label] = 0;
                    }
                  }
                } else {
                  /*
                   * var subBuildLabel = createSubBuildLabel(item.os, item.arch,
                   * item.part, item.sub_test);
                   */
                  $link.text(item.sub_build_labels);
                }
                $c.attr('data-is-root-build', isRootBuild).attr(
                    'data-build-name', label);
                return $c;
              } else if (colKey.endsWith('_count')) {
                // "_count" columns.
                if (label === 0) {
                  return $j('<span class="zero-value">0</span>');
                } else {
                  if (colKey.startsWith('unstable') ||
                      colKey.startsWith('failure') ||
                      colKey.startsWith('aborted')) {
                    var params = $j.extend({}, commonParams);
                    params.b = item['jenkins_project'];
                    params.f = colKey.split('_')[0].toUpperCase();
                    var href = 'jenkins-build?' +
                        Object.keys(params).map(function(k) {
                          return k + '=' + encodeURIComponent(params[k]);
                        }).join('&');
                    var $ret = $j('<a></a>').attr('class',
                        params.f.toLowerCase() + ' problems').attr('href', href).attr(
                        'target', '_blank').text(label);
                    // if (isRootBuild && hasSubBuilds[item['jenkins_project']])
                    // {
                    // $ret.addClass('has-sub-build');
                    // $ret.attr('title', 'Caused by sub builds');
                    // }
                    return $ret;
                  } else {
                    return document.createTextNode(label);
                  }
                }
              } else {
                return document.createTextNode(label);
              }
            },
            // After sorting is done, put sub builds rows
            // into right places.
            function() {
              reOrgSubBuildsRows();
            });
        $mainContent.append($table).show();

        // Handlers for open/close root builds to show/hide
        // their sub builds.
        $j('.build-name-container .build-name-img').click(function(e) {
          var $p = $j(this).parent();
          var buildName = $p.attr('data-build-name');
          if ($p.hasClass('tree-open')) {
            // Close tree.
            $p.removeClass('tree-open').addClass('tree-close');
            rootBuildToSubBuildRows[buildName].forEach(function($r) {
              $r.hide();
              rootBuildsTreeStats[buildName] = 0;
            });
          } else if ($p.hasClass('tree-close')) {
            // Open tree.
            $p.removeClass('tree-close').addClass('tree-open');
            rootBuildToSubBuildRows[buildName].forEach(function($r) {
              $r.show();
              rootBuildsTreeStats[buildName] = 1;
            });
          }
        });

        // Extract rows for sub builds.
        rootBuildToSubBuildRows = {};
        $j('.v-table div.build-name-container[data-is-root-build="false"]').each(
            function(i, ele) {
              var buildName = $j(ele).attr('data-build-name');
              if (!rootBuildToSubBuildRows[buildName]) {
                rootBuildToSubBuildRows[buildName] = [];
              }
              var $row = $j(ele).closest('tr');
              $row.addClass('sub-build-row').hide();
              rootBuildToSubBuildRows[buildName].push($row);
            });
        // Sort sub builds by sub build labels.
        Object.keys(rootBuildToSubBuildRows).forEach(function(k) {
          rootBuildToSubBuildRows[k].sort(function($a, $b) {
            var l1 = $a.find('a').text();
            var l2 = $b.find('a').text();
            if (l1 > l2) {
              return -1;
            }
            if (l1 < l2) {
              return 1;
            }
            return 0;
          });
        });
        reOrgSubBuildsRows();

        // Set up Jenkins project filter.
        setupJenkinsBuildsFilter();
        filterTableRows();
      }

      function filterTableRows() {
        $j('.v-table tbody tr').show();

        // Filter rows by project name.
        if (curFilterProjectName !== '') {
          $j(
              '.v-table div.build-name-container[data-build-name!="' +
                  curFilterProjectName + '"]').closest('.v-row').hide();
        }

        // Restore tree states.
        Object.keys(rootBuildsTreeStats).forEach(
            function(k) {
              var $r = $j(
                  '.sub-build-row .build-name-container[data-build-name="' + k +
                      '"]').closest('tr');
              if (rootBuildsTreeStats[k] === 1) {
                var $rootBuildRow = $j('.build-name-container[data-build-name="' +
                    k + '"][data-is-root-build="true"]');
                if ($rootBuildRow.is(':visible')) {
                  $r.show();
                }
              } else {
                $r.hide();
              }
            });
      }

      function setupJenkinsBuildsFilter() {
        // Get build names from visible rows.
        var buildsSet = {};
        $j('.v-table tbody tr:visible').each(
            function(index, ele) {
              buildsSet[$j(ele).find('.build-name-container').attr(
                  'data-build-name')] = 1;
            });
        var builds = Object.keys(buildsSet).sort();

        // Setup typeahead.
        var $buildFilter = $j('#jenkins-builds-filter-input').val('');
        $buildFilter.typeahead('destroy');
        $buildFilter.typeahead({
          hint: true,
          highlight: true,
          minLength: 1
        }, {
          source: vUtil.substringMatcher(builds),
          limit: 100
        });
        $buildFilter.bind('typeahead:select', function(ev, suggestion) {
          curFilterProjectName = suggestion;
          filterTableRows();
        });

        // Set up reset link.
        $j('#link-reset').click(function() {
          $buildFilter.val('');

          curFilterProjectName = '';
          filterTableRows();
        });
      }

      function reOrgSubBuildsRows() {
        var unProcessedRoots = Object.keys(rootBuildToSubBuildRows);
        $j('.v-table div.build-name-container[data-is-root-build="true"]').each(
            function(i, ele) {
              var buildName = $j(ele).attr('data-build-name');
              var index = unProcessedRoots.indexOf(buildName);
              if (index > -1) {
                unProcessedRoots.splice(index, 1);
              }
              var subBuilds = rootBuildToSubBuildRows[buildName];
              if (subBuilds) {
                subBuilds.forEach(function($sb) {
                  $sb.insertAfter($j(ele).closest('tr'));
                })
              }
            });
        // Hide sub builds whose root builds are not present in the database
        // yet.
        unProcessedRoots.forEach(function(r) {
          rootBuildToSubBuildRows[r].forEach(function($sb) {
            $sb.hide();
          });
        });
      }
    });