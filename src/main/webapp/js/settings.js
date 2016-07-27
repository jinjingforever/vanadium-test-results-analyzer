document.addEventListener('DOMContentLoaded', function() {
  var $statusEle = $j('#status');
  var $statusMsgEle = $j('#status-msg');
  var $divFixDB = $j('#fix-database');
  var $fixErrMsg = $j('#fix-error-msg');
  var $btnFixDB = $j('#btn-fix');

  function showError(statusMsg, errMsg, showBtnFixDB) {
    $statusEle.text(statusMsg);
    $statusEle.attr('class', 'failed');
    $statusMsgEle.text(errMsg);
    if (showBtnFixDB) {
      $divFixDB.show();
    }
  }

  function createTableInfoDiv(table, info) {
    var $container = $j('<div class="table-info"></div>');
    var $tableName = $j('<div class="table-name">Table "' + table + '"</div>');
    $container.append($tableName);

    // Table creation time.
    var $row = $j('<div class="table-row"></div>');
    $row.append($j('<div class="row-header">Creation Time:</div>'));
    var creationTime = 'N/A';
    if (info.creationTime >= 0) {
      creationTime = new Date(info.creationTime);
      var timezoneOffset = creationTime.getTimezoneOffset();
      creationTime = new Date(info.creationTime - timezoneOffset * 60000);
    }
    $row.append($j('<div class="row-value">' + creationTime + '</div>'));
    $container.append($row);

    // Table's newest entry.
    $row = $j('<div class="table-row"></div>');
    var lastUpdateTime = 'N/A';
    if (info.lastUpdateTime >= 0) {
      lastUpdateTime = new Date(info.lastUpdateTime);
    }
    $row.append($j('<div class="row-header">Newset Entry:</div>'));
    $row.append($j('<div class="row-value">' + lastUpdateTime + '</div>'));
    $container.append($row);

    // Table's oldest entry.
    $row = $j('<div class="table-row"></div>');
    var oldestUpdateTime = 'N/A';
    if (info.oldestUpdateTime >= 0) {
      oldestUpdateTime = new Date(info.oldestUpdateTime);
    }
    $row.append($j('<div class="row-header">Oldest Entry:</div>'));
    $row.append($j('<div class="row-value">' + oldestUpdateTime + '</div>'));
    $container.append($row);

    // Row count.
    $row = $j('<div class="table-row"></div>');
    $row.append($j('<div class="row-header">Row Count:</div>'));
    $row.append($j('<div class="row-value">' + info.rowCount + '</div>'));
    $container.append($row);

    // Size in MB.
    $row = $j('<div class="table-row"></div>');
    $row.append($j('<div class="row-header">Size:</div>'));
    $row.append($j('<div class="row-value">' + info.size + ' MB</div>'));
    $container.append($row);

    return $container;
  }

  // Check database status when the settings page is done loading.
  it.checkDatabaseStatus(function(t) {
    var status = t.responseObject();

    if (status.mySQLErrMsg !== '') {
      showError('MySQL access not setup correctly:',
          'Set up access above and save', false);
      return;
    }

    if (status.databaseErrMsg !== '') {
      showError('Database check failed:', status.databaseErrMsg, true);
      return;
    }

    var tables = Object.keys(status.tables).sort();
    var hasErrors = false;
    var $container = $j('#status-container');
    tables.forEach(function(table) {
      var errMsg = status.tables[table].errMsg;
      if (errMsg !== '') {
        showError('Table check failed:', errMsg, true);
        hasErrors = true;
        return false;
      }
      $container.append(createTableInfoDiv(table, status.tables[table]));
    });
    if (hasErrors) {
      return;
    }

    $statusEle.text('All OK');
    $statusEle.attr('class', 'ok');
  });

  // Set up click listener for the "fix database and tables" button.
  $btnFixDB.click(function() {
    if (!$j(this).hasClass('enabled')) {
      return;
    }
    $fixErrMsg.hide();
    $j(this).text('Please Wait').removeClass('enabled');
    it.fixDatabaseAndTables(function(t) {
      var errMsg = t.responseObject();
      if (errMsg === '') {
        location.reload();
      } else {
        $btnFixDB.text('Fix Databases and Tables').addClass('enabled');
        $fixErrMsg.text(errMsg).show();
      }
    });
  });
});