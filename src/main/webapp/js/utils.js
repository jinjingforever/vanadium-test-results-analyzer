var vUtil = function() {
  var vTestNameRegex = /([^\[\]]*)\[[^\[\]]*]/g;

  var DETAILS_COLS = [
    {
      key: 'build_number',
      label: 'build#',
      dataSort: 'int',
      formatter: function(n) {
        return '#' + n;
      }
    }, {
      key: 'start_time',
      label: 'start time',
      dataSort: 'int',
      formatter: dateFormatter
    }, {
      key: 'duration',
      label: 'duration',
      dataSort: 'int',
      formatter: humanReadableDurationFormatter,
    }, {
      key: 'result',
      label: 'result',
      dataSort: 'string',
    },
  ];

  function createTable(cols, rowItems, defaultColKey, createCellFunc,
      afterTableSortCb) {
    var $table = $j('<table></table>').addClass('v-table');

    // Create headers.
    var defaultColIndex = 0;
    var $thead = $j('<thead></thead>');
    var $headerRow = $j('<tr></tr>').addClass('v-header-row').addClass('v-row');
    $thead.append($headerRow);
    $table.append($thead);
    cols.forEach(function(c, index) {
      var $header = $j('<th></th>').attr('data-sort', c.dataSort).attr(
          'data-sort-default', 'desc').addClass('rt-header').text(c.label);
      if (c.key === defaultColKey) {
        defaultColIndex = index;
      }
      $headerRow.append($header);
    });

    // Fill content.
    var $tbody = $j('<tbody></tbody>');
    $table.append($tbody);
    rowItems.forEach(function(item) {
      var $row = $j('<tr></tr>').addClass('v-row');
      cols.forEach(function(c) {
        var label = item[c.key];
        var $td = $j('<td></td>').addClass('v-cell');
        if (c.formatter) {
          $td.attr('data-sort-value', item[c.key]);
          label = c.formatter(label);
        }
        $td.append(createCellFunc(c.key, label, item));
        $row.append($td);
      });
      $tbody.append($row);
    });

    // Make it sortable.
    var $sortableTable = $table.stupidtable();
    $sortableTable.bind('aftertablesort', function(e, data) {
      highlightColumn($table, data.column);
      if (afterTableSortCb) {
        afterTableSortCb();
      }
    });
    $sortableTable.find('thead th').eq(defaultColIndex).stupidsort();

    return $table;
  }

  function highlightColumn($table, index) {
    var $tbody = $table.find('tbody');
    $tbody.find('tr td').removeClass('sorting');
    $tbody.find('tr td:nth-child(' + (index + 1) + ')').addClass('sorting');
  }

  function createSubBuildLabel(os, arch, part, subTest) {
    var subs = [
      os
    ];
    if (arch !== 'amd64') {
      subs.push(arch);
    }
    if (part !== -1) {
      subs.push('P' + part);
    }
    if (subTest && subTest !== 'undefined') {
      subs.push(subTest);
    }
    return subs.join(', ');
  }

  function dateFormatter(ts) {
    var d = new Date(ts);
    return dateFormatterWithoutSeconds(ts) + ':' + leftPad(d.getSeconds());
  }

  function dateFormatterWithoutSeconds(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '/' + leftPad((d.getMonth() + 1)) + '/' +
        leftPad(d.getDate()) + ' ' + leftPad(d.getHours()) + ':' +
        leftPad(d.getMinutes());
  }

  function leftPad(n) {
    return String('00' + n).slice(-2);
  }

  function humanReadableDurationFormatter(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds - 3600 * h) / 60);
    var s = Math.floor(seconds - 3600 * h - 60 * m);
    var ret = '';
    if (h > 0) {
      ret += h + 'h ';
    }
    if (m > 0) {
      ret += m + 'm ';
    }
    if (s >= 0) {
      ret += s + 's';
    }
    return ret;
  }

  function substringMatcher(strs) {
    return function findMatches(q, cb) {
      var matches, substringRegex;
      matches = [];
      substringRegex = new RegExp(escapeRegExp(q), 'i');
      $j.each(strs, function(i, str) {
        if (substringRegex.test(str)) {
          matches.push(str);
        }
      });
      cb(matches);
    };
  }

  function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

  function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' +
        '([^&;]+?)(&|#|;|$)').exec(location.search) || [
      null, ''
    ])[1].replace(/\+/g, '%20')) ||
        null;
  }

  function cleanupTestLabel(label) {
    return label.replace(vTestNameRegex, '$1').trim();
  }

  function renderItemsInTableAndGraphs(items, defaultColKey, availableStats,
      tableTitleBase, filters) {
    // Show items in a table.
    var $table = createTable(
        DETAILS_COLS,
        items,
        defaultColKey,
        function(colKey, label, item) {
          if (colKey === 'build_number') {
            return $j('<a></a>').attr('target', '_blank').attr('href',
                rootURL + '/' + item.url).text(label);
          } else if (colKey === 'result') {
            var c = item.result.toLowerCase();
            return $j('<span></span>').addClass(c).text(label);
          } else {
            return document.createTextNode(label);
          }
        },
        // After sorting, re-generate history blocks.
        function() {
          // Render test cases history color blocks.
          var $blocks = [];
          $j('.v-table tbody tr').each(
              function(i, r) {
                var $row = $j(r);
                var buildNumber = $row.find('td:first-of-type').attr(
                    'data-sort-value');
                var $resultTD = $row.find('td:last-of-type');
                var result = $resultTD.text().toLowerCase();
                var $block = $j('<div></div>');
                $block.addClass('history-block').addClass(result).attr(
                    'data-build-number', buildNumber);
                $blocks.push($block);
              });
          $j('#details-history-blocks-container').empty().append($blocks);

          // Jump to the corresponding table row when clicking on a block.
          $j('.history-block').click(
              function() {
                var buildNumber = $j(this).attr('data-build-number');
                var $firstRow = $j('.v-table tbody tr');
                var $row = $j(
                    '.v-table tbody td[data-sort-value="' + buildNumber + '"]').parent().removeClass(
                    'highlight-end');
                var $thead = $j('.v-table thead');
                $row.addClass('highlight-start');
                $j('#details-table').animate(
                    {
                      scrollTop: $row.position().top -
                          $firstRow.position().top + $thead.height() -
                          $j('#details-table').height() / 2
                    },
                    500,
                    "easeInOutQuint",
                    function() {
                      $row.addClass('highlight-end');
                      window.setTimeout(function() {
                        $row.removeClass('highlight-start').removeClass(
                            'highlight-end');
                      }, 1210);
                    });
              });
        });
    $j('#details-table').append($table);

    // Count results.
    var resultCounts = {};
    items.forEach(function(item) {
      if (resultCounts[item.result] === undefined) {
        resultCounts[item.result] = 0;
      }
      resultCounts[item.result]++;
    });
    var stats = '';
    var $statsContainer = $j('#details-stats');
    $statsContainer.empty();
    availableStats.forEach(function(t) {
      if (resultCounts[t] !== undefined) {
        var text = (stats === '' ? '' : ', ') + t + ': ' + resultCounts[t] +
            ' (' + (resultCounts[t] / items.length * 100).toFixed(1) + '%)';
        var $status = $j('<span></span>').addClass('status-item').attr(
            'data-result', t).text(text);
        if (filters.indexOf(t) >= 0) {
          $status.addClass('selected');
        }
        $statsContainer.append($status);
      }
    });
    $j('#details-table-subtitle').text(
        tableTitleBase + ' (' + items.length + ')');
    if (filters.length > 0) {
      filterTableRowsByResults(filters);
    }

    // Click handlers for status filter.
    $j('#details-stats .status-item').click(function() {
      $j(this).toggleClass('selected');

      // Get selected result types.
      var selectedResults = [];
      $j('#details-stats .status-item.selected').each(function(i, ele) {
        selectedResults.push($j(ele).attr('data-result'));
      });

      // Filter.
      filterTableRowsByResults(selectedResults);
    });

    // Show a dot in the color block for current table row under cursor.
    var $lastBlock = undefined;
    $j('.v-table tbody tr').mouseover(
        function() {
          var curBuildNumber = $j(this).find('td').eq(0).attr('data-sort-value');
          $lastBlock = $j('.history-block[data-build-number="' +
              curBuildNumber + '"]');
          $lastBlock.addClass('current');
        }).mouseout(function() {
      $lastBlock.removeClass('current');
    });

    // Prepare graph data.
    var dt = new google.visualization.DataTable();
    dt.addColumn('string', 'Build Number');
    dt.addColumn('number', 'Duration');
    dt.addRows(items.map(function(item) {
      return [
        '#' + item.build_number, item.duration
      ];
    }));
    var options = {
      legend: {
        position: 'none'
      },
      width: 640,
      height: 200,
      chartArea: {
        left: 40,
        top: 20,
        bottom: 40
      },
      hAxis: {
        slantedText: true
      },
      series: {
        0: {
          color: '#00838F'
        }
      }
    };

    // Create durations histogram.
    var c = new google.visualization.Histogram(
        document.getElementById('graph-durations-histogram'));
    c.draw(dt, options);

    // Create durations trend.
    options.hAxis = {
      textPosition: 'none'
    };
    var c2 = new google.visualization.AreaChart(
        document.getElementById('graph-durations-trend'));
    c2.draw(dt, options);

    $j('#details-content').show();
    $j('#details-loading').hide();
  }

  function filterTableRowsByResults(resultFilters) {
    // Show everything if no result filter is selected.
    if (resultFilters.length === 0) {
      $j('.v-table tbody tr').show();
      return;
    }

    // Show only the selected result types.
    var showSelectors = [];
    var hideSelectors = [];
    resultFilters.forEach(function(r) {
      showSelectors.push('.v-table tbody tr td:last-of-type:contains("' + r +
          '")');
      hideSelectors.push(':not(:contains("' + r + '"))');
    });
    $j(showSelectors.join(',')).parent().show();
    var hideSelector = hideSelectors.join('');
    $j('.v-table tbody tr td:last-of-type' + hideSelector).parent().hide();
  }

  return {
    cleanupTestLabel: cleanupTestLabel,
    createTable: createTable,
    createSubBuildLabel: createSubBuildLabel,
    dateFormatter: dateFormatter,
    dateFormatterWithoutSeconds: dateFormatterWithoutSeconds,
    leftPad: leftPad,
    humanReadableDurationFormatter: humanReadableDurationFormatter,
    substringMatcher: substringMatcher,
    getURLParameter: getURLParameter,
    renderItemsInTableAndGraphs: renderItemsInTableAndGraphs,
  };
}();