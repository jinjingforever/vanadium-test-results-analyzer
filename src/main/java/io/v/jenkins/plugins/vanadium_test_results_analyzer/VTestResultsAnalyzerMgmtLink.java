package io.v.jenkins.plugins.vanadium_test_results_analyzer;

import hudson.Extension;
import hudson.model.ManagementLink;
import hudson.util.FormValidation;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.logging.Level;
import java.util.logging.Logger;
import net.sf.json.JSONArray;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.QueryParameter;
import org.kohsuke.stapler.Stapler;
import org.kohsuke.stapler.StaplerRequest;
import org.kohsuke.stapler.StaplerResponse;
import org.kohsuke.stapler.bind.JavaScriptMethod;

/**
 * Registers the plugin to be recognized by Jenkins as a management link (shown in Manage Jenkins
 * page).
 *
 * @author Jing Jin (jingjin@google.com)
 */
@Extension
public class VTestResultsAnalyzerMgmtLink extends ManagementLink {
  private static final Logger LOGGER =
      Logger.getLogger(VTestResultsAnalyzerMgmtLink.class.getName());

  //  /** Display name. */
  private static final String DISPLAY_NAME = "Vanadium Test Results Analyzer";

  /** URL to the plugin. */
  private static final String URL = "vanadium-test-results-analyzer";

  /** Icon used by this plugin shown in "Manage Jenkins" page. */
  private static final String ICON = "/plugin/" + URL + "/images/mgmtlink.png";

  /** A set of keys in the json object returned by checkDatabaseStatus. */
  private static final String KEY_DB_STATUS_MYSQL_ERR = "mySQLErrMsg";
  private static final String KEY_DB_STATUS_DATABASE_ERR = "databaseErrMsg";
  private static final String KEY_DB_STATUS_TABLES = "tables";
  private static final String KEY_DB_STATUS_TABLE_ERR = "errMsg";
  private static final String KEY_DB_STATUS_TABLE_CREATION_TIME = "creationTime";
  private static final String KEY_DB_STATUS_TABLE_UPDATE_TIME = "updateTime";
  private static final String KEY_DB_STATUS_TABLE_ROW_COUNT = "rowCount";
  private static final String KEY_DB_STATUS_TABLE_SIZE = "size";

  /** A set of keys in the json object returned by getJenkinsBuildsRunTimeInfo. */
  private static final String KEY_BUILDS_RUN_TIME_ERR = "errMsg";

  /** The default database name. */
  static final String DB_NAME = "jenkins";

  /** The database table to store jenkins builds data. */
  static final String TB_JENKINS_BUILDS = "jenkins_builds";

  /** SQL to create Jenkins Builds table. */
  private static final String SQL_CREATE_TB_JENKINS_BUILDS =
      "CREATE TABLE "
          + TB_JENKINS_BUILDS
          + "(id INTEGER NOT NULL AUTO_INCREMENT, "
          // The name of the Jenkins project for this build.
          + " jenkins_project VARCHAR(64), "
          // Build number.
          + " build_number INTEGER, "
          // sub build labels. NULL means root build.
          + " sub_build_labels VARCHAR(1024), "
          // Node this build runs on.
          + " node VARCHAR(64), "
          // The time when the build started.
          + " start_time DATETIME, "
          // Build duration in seconds.
          + " duration INTEGER, "
          // Result.
          + " result VARCHAR(16), "
          // URL of this build.
          + " url VARCHAR(1024), "
          // When this entry is added to the database.
          + " update_time DATETIME, "
          + " PRIMARY KEY ( id ))";

  static final String TB_TEST_RESULTS = "test_results";

  private static final String SQL_CREATE_TB_TEST_RESULTS =
      "CREATE TABLE "
          + TB_TEST_RESULTS
          + "(id INTEGER NOT NULL AUTO_INCREMENT, "
          // The name of the Jenkins project for this build.
          + " jenkins_project VARCHAR(64), "
          // Build number.
          + " build_number INTEGER, "
          // sub build labels. NULL means root build.
          + " sub_build_labels VARCHAR(1024), "
          // Test package name.
          + " test_package VARCHAR(256), "
          // Test class name.
          + " test_class VARCHAR(256), "
          // Test case name.
          + " test_case VARCHAR(256), "
          // Test full name.
          + " test_full_name VARCHAR(1024), "
          // The time when the corresponding build started.
          + " start_time DATETIME, "
          // Build duration in seconds.
          + " duration FLOAT, "
          // Result.
          + " result VARCHAR(16), "
          // URL of this test.
          + " url VARCHAR(1024), "
          // When this entry is added to the database.
          + " update_time DATETIME, "
          + " PRIMARY KEY ( id ))";

  /** SQL to query table stats. */
  private static final String SQL_TABLE_STATS =
      "SELECT create_time,"
          + "round(((data_length + index_length) / 1024 / 1024), 2) 'size' "
          + "FROM INFORMATION_SCHEMA.TABLES "
          + "WHERE table_name='%s'";

  /** SQL to query info of all jenkins builds. */
  private static final String SQL_JENKINS_BUILDS =
      "SELECT jenkins_project, sub_build_labels, "
          + "AVG(duration) AS avg, "
          + "MIN(duration) AS min, "
          + "MAX(duration) AS max, "
          + "STD(duration) AS std, "
          + "COUNT(CASE WHEN result IN ('SUCCESS') THEN 1 END) as success_count, "
          + "COUNT(CASE WHEN result IN ('UNSTABLE') THEN 1 END) as unstable_count, "
          + "COUNT(CASE WHEN result IN ('FAILURE') THEN 1 END) as failure_count, "
          + "COUNT(CASE WHEN result IN ('ABORTED') THEN 1 END) as aborted_count, "
          + "COUNT(*) AS count "
          + "FROM "
          + TB_JENKINS_BUILDS
          + " WHERE "
          + "start_time BETWEEN '%s' AND '%s' "
          + "GROUP BY jenkins_project,sub_build_labels "
          + "ORDER BY avg DESC";

  /** SQL to query a specific jenkins build. */
  private static final String SQL_BUILD_DETAILS =
      "SELECT build_number, start_time, duration, result, url FROM "
          + TB_JENKINS_BUILDS
          + " WHERE jenkins_project='%s' AND %s AND "
          + "start_time BETWEEN '%s' AND '%s' "
          + "ORDER BY build_number";

  /** SQL to query all available jenkins builds. */
  private static final String SQL_AVAILABLE_JENKINS_BUILDS =
      "SELECT jenkins_project, start_time, sub_build_labels "
          + "FROM "
          + TB_JENKINS_BUILDS
          + " WHERE "
          + "start_time BETWEEN '%s' AND '%s' "
          + "GROUP BY jenkins_project,sub_build_labels";

  /** SQL to query test results data. */
  private static final String SQL_FAILED_TEST_RESULTS =
      "SELECT test_full_name, jenkins_project, sub_build_labels, "
          + "AVG(duration) AS avg_duration, "
          + "MIN(duration) AS min_duration, "
          + "MAX(duration) AS max_duration, "
          + "COUNT(CASE WHEN result IN ('FAILED') THEN 1 END) as failed_count, "
          + "COUNT(*) AS count "
          + "FROM "
          + TB_TEST_RESULTS
          + " WHERE "
          + "start_time BETWEEN '%s' AND '%s' "
          + "GROUP BY test_full_name,jenkins_project,sub_build_labels "
          + "HAVING COUNT(CASE WHEN result in ('FAILED') THEN 1 END) > 0 "
          + "ORDER BY count DESC, test_full_name ASC";

  /** SQL to query longest tests. */
  private static final String SQL_LONGEST_TESTS =
      "SELECT test_full_name, jenkins_project, sub_build_labels, "
          + "AVG(duration) AS avg_duration, "
          + "MIN(duration) AS min_duration, "
          + "MAX(duration) AS max_duration, "
          + "COUNT(CASE WHEN result IN ('FAILED') THEN 1 END) as failed_count, "
          + "COUNT(*) AS count "
          + "FROM "
          + TB_TEST_RESULTS
          + " WHERE "
          + "start_time BETWEEN '%s' AND '%s' "
          + "GROUP BY test_full_name,jenkins_project,sub_build_labels "
          + "ORDER BY avg_duration DESC, test_full_name ASC "
          + "LIMIT 50";

  /** SQL to query all available test cases. */
  private static final String SQL_AVAILABLE_TEST_CASES =
      "SELECT test_full_name, jenkins_project, sub_build_labels "
          + "FROM "
          + TB_TEST_RESULTS
          + " WHERE "
          + "start_time BETWEEN '%s' AND '%s' "
          + "GROUP BY test_full_name,jenkins_project,sub_build_labels "
          + "ORDER BY test_full_name";

  /** SQL to query a specific test case. */
  private static final String SQL_TEST_CASE_DETAILS =
      "SELECT build_number, start_time, duration, result, url FROM "
          + TB_TEST_RESULTS
          + " WHERE jenkins_project='%s' AND test_full_name='%s' AND %s AND "
          + "start_time BETWEEN '%s' AND '%s' "
          + "ORDER BY build_number";

  @Override
  public String getDisplayName() {
    return DISPLAY_NAME;
  }

  @Override
  public String getIconFileName() {
    return ICON;
  }

  @Override
  public String getUrlName() {
    return URL;
  }

  @Override
  public String getDescription() {
    return "Set up cloud SQL and use it to analyze Vanadium test results.";
  }

  /** Called by UI to construct the correct URI for the "Test Connection" button. */
  public String getFullURL() {
    return Stapler.getCurrentRequest().getOriginalRequestURI().substring(1).replace("settings", "");
  }

  /** Called by UI to test connection given the server IP and root password. */
  public FormValidation doTestConnection(
      @QueryParameter("serverIP") final String serverIP,
      @QueryParameter("rootPassword") final String rootPassword) {
    LOGGER.info("Testing connection to server " + serverIP);
    String errMsg = checkConnection(serverIP, rootPassword, null);
    if (errMsg.isEmpty()) {
      return FormValidation.ok("Connection OK");
    } else {
      return FormValidation.error(errMsg);
    }
  }

  /** Called by UI to save current settings. */
  public void doSaveSettings(
      final StaplerRequest res,
      final StaplerResponse rep,
      @QueryParameter("serverIP") final String serverIP,
      @QueryParameter("rootPassword") final String rootPassword,
      @QueryParameter("pluginDisabled") final boolean pluginDisabled)
      throws IOException {
    LOGGER.info("Saving settings");

    final VTestResultsAnalyzerPluginImpl plugin = VTestResultsAnalyzerPluginImpl.getInstance();
    plugin.setServerIP(serverIP);
    plugin.setRootPassword(rootPassword);
    plugin.setPluginDisabled(pluginDisabled);
    plugin.save();

    LOGGER.info("Done saving settings");
    rep.sendRedirect(res.getContextPath() + "/" + URL + "/settings");
  }

  /** Called by UI to check whether the status of the database. */
  @JavaScriptMethod
  public JSONObject checkDatabaseStatus() {
    VTestResultsAnalyzerPluginImpl plugin = getSettings();
    JSONObject ret = new JSONObject();
    ret.put(KEY_DB_STATUS_MYSQL_ERR, "");
    ret.put(KEY_DB_STATUS_DATABASE_ERR, "");
    String ip = plugin.getServerIP();
    String password = plugin.getRootPassword();

    // Check connection to the mysql server.
    String errMsgMySql = checkConnection(ip, password, null);
    if (!errMsgMySql.isEmpty()) {
      ret.put(KEY_DB_STATUS_MYSQL_ERR, errMsgMySql);
      return ret;
    }

    // Check connection to the database.
    String errMsgDB = checkConnection(ip, password, DB_NAME);
    if (!errMsgDB.isEmpty()) {
      ret.put(KEY_DB_STATUS_DATABASE_ERR, errMsgDB);
      return ret;
    }

    // Check tables.
    Connection conn = null;
    try {
      conn = Util.getConnection(ip, password, DB_NAME);
    } catch (SQLException e) {
      ret.put(KEY_DB_STATUS_DATABASE_ERR, e.getMessage());
      return ret;
    }
    if (conn == null) {
      ret.put(KEY_DB_STATUS_DATABASE_ERR, "Failed to establish connection");
      return ret;
    }
    JSONObject jsonObjTables = new JSONObject();
    for (String table : new String[] {TB_JENKINS_BUILDS, TB_TEST_RESULTS}) {
      JSONObject jsonObjCurTable = checkTable(conn, table);
      jsonObjTables.put(table, jsonObjCurTable);
    }
    ret.put(KEY_DB_STATUS_TABLES, jsonObjTables);

    return ret;
  }

  /** Called by UI to fix database and tables. */
  @JavaScriptMethod
  public String fixDatabaseAndTables() {
    LOGGER.info("Setting up database");
    VTestResultsAnalyzerPluginImpl plugin = getSettings();

    // Check and create database.
    Connection conn = null;
    boolean checkDB = true;
    try {
      conn = Util.getConnection(plugin.getServerIP(), plugin.getRootPassword(), DB_NAME);
    } catch (SQLException e) {
      checkDB = false;
    }
    if (!checkDB || conn == null) {
      try {
        Connection sqlConnection =
            Util.getConnection(plugin.getServerIP(), plugin.getRootPassword(), null);
        Statement stmt = sqlConnection.createStatement();
        stmt.executeUpdate("CREATE DATABASE " + DB_NAME);
        conn = Util.getConnection(plugin.getServerIP(), plugin.getRootPassword(), DB_NAME);
      } catch (SQLException e) {
        return e.getMessage();
      }
    }

    // Check and create Jenkins Builds table.
    if (!checkTable(conn, TB_JENKINS_BUILDS).getString(KEY_DB_STATUS_TABLE_ERR).isEmpty()) {
      try {
        Statement stmt = conn.createStatement();
        stmt.executeUpdate(SQL_CREATE_TB_JENKINS_BUILDS);
      } catch (SQLException e) {
        return e.getMessage();
      }
    }
    
    // Check and create Test Results table.
    if (!checkTable(conn, TB_TEST_RESULTS).getString(KEY_DB_STATUS_TABLE_ERR).isEmpty()) {
      try {
        Statement stmt = conn.createStatement();
        stmt.executeUpdate(SQL_CREATE_TB_TEST_RESULTS);
      } catch (SQLException e) {
        return e.getMessage();
      }
    }

    return "";
  }

  /** Called by UI to get Jenkins builds data. */
  @JavaScriptMethod
  public JSONObject getJenkinsBuildsInfo(long startEpoch, long endEpoch) {
    JSONObject ret = new JSONObject();
    ret.put(KEY_BUILDS_RUN_TIME_ERR, "");
    JSONArray items = new JSONArray();
    DateFormat df = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
    String strStartTime = df.format(new Date(startEpoch));
    String strEndTime = df.format(new Date(endEpoch));
    String strQuery = String.format(SQL_JENKINS_BUILDS, strStartTime, strEndTime);
    String errMsg =
        query(
            strQuery,
            new String[] {
              "jenkins_project",
              "sub_build_labels",
              "avg",
              "min",
              "max",
              "std",
              "count",
              "success_count",
              "unstable_count",
              "failure_count",
              "aborted_count"
            },
            items);
    if (!errMsg.isEmpty()) {
      ret.put("errMsg", errMsg);
      return ret;
    }
    ret.put("items", items);
    ret.put("startTime", startEpoch);
    ret.put("endTime", endEpoch);

    return ret;
  }

  /** Called by UI to get details info for a specific jenkins build. */
  @JavaScriptMethod
  public JSONObject getJenkinsBuildDetails(
      long startEpoch, long endEpoch, String buildName, String subBuildLabels) {
    JSONObject ret = new JSONObject();
    ret.put("errMsg", "");
    JSONArray builds = new JSONArray();
    DateFormat df = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
    String strStartTime = df.format(new Date(startEpoch));
    String strEndTime = df.format(new Date(endEpoch));
    String c = "sub_build_labels='" + subBuildLabels + "'";
    if (subBuildLabels.isEmpty()) {
      c = "sub_build_labels IS NULL";
    }
    String errMsg =
        query(
            String.format(SQL_BUILD_DETAILS, buildName, c, strStartTime, strEndTime),
            new String[] {"build_number", "start_time", "duration", "result", "url"},
            builds);
    if (!errMsg.isEmpty()) {
      ret.put("errMsg", errMsg);
      return ret;
    }
    ret.put("builds", builds);
    return ret;
  }

  /** Called by UI to get all available jenkins builds. */
  @JavaScriptMethod
  public JSONObject getAvailableJenkinsBuilds(long startEpoch, long endEpoch) {
    JSONObject ret = new JSONObject();
    ret.put("errMsg", "");
    JSONArray builds = new JSONArray();
    DateFormat df = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
    String strStartTime = df.format(new Date(startEpoch));
    String strEndTime = df.format(new Date(endEpoch));
    String strQuery = String.format(SQL_AVAILABLE_JENKINS_BUILDS, strStartTime, strEndTime);
    String errMsg = query(strQuery, new String[] {"jenkins_project", "sub_build_labels"}, builds);
    if (!errMsg.isEmpty()) {
      ret.put("errMsg", errMsg);
      return ret;
    }
    ret.put("builds", builds);
    return ret;
  }

  /** Called by UI to get test results info. */
  @JavaScriptMethod
  public JSONObject getTestResults(long startEpoch, long endEpoch) {
    JSONObject ret = new JSONObject();
    ret.put(KEY_BUILDS_RUN_TIME_ERR, "");
    JSONArray failedTests = new JSONArray();
    DateFormat df = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
    String strStartTime = df.format(new Date(startEpoch));
    String strEndTime = df.format(new Date(endEpoch));
    
    // Query failed tests.
    String strQuery = String.format(SQL_FAILED_TEST_RESULTS, strStartTime, strEndTime);
    String errMsg =
        query(
            strQuery,
            new String[] {
              "test_full_name",
              "jenkins_project",
              "sub_build_labels",
              "avg_duration",
              "min_duration",
              "max_duration",
              "count",
              "failed_count",
            },
            failedTests);
    if (!errMsg.isEmpty()) {
      ret.put("errMsg", errMsg);
      return ret;
    }
    ret.put("failedTests", failedTests);

    // Query longest tests.
    JSONArray longestTests = new JSONArray();
    strQuery = String.format(SQL_LONGEST_TESTS, strStartTime, strEndTime);
    errMsg =
        query(
            strQuery,
            new String[] {
              "test_full_name",
              "jenkins_project",
              "sub_build_labels",
              "avg_duration",
              "min_duration",
              "max_duration",
              "count",
              "failed_count",
            },
            longestTests);
    if (!errMsg.isEmpty()) {
      ret.put("errMsg", errMsg);
      return ret;
    }
    ret.put("longestTests", longestTests);

    ret.put("startTime", startEpoch);
    ret.put("endTime", endEpoch);

    return ret;
  }

  /** Called by UI to get all available test cases. */
  @JavaScriptMethod
  public JSONObject getAvailableTestCases(long startEpoch, long endEpoch) {
    JSONObject ret = new JSONObject();
    ret.put("errMsg", "");
    JSONArray builds = new JSONArray();
    DateFormat df = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
    String strStartTime = df.format(new Date(startEpoch));
    String strEndTime = df.format(new Date(endEpoch));
    String strQuery = String.format(SQL_AVAILABLE_TEST_CASES, strStartTime, strEndTime);
    String errMsg =
        query(
            strQuery,
            new String[] {"test_full_name", "jenkins_project", "sub_build_labels"},
            builds);
    if (!errMsg.isEmpty()) {
      ret.put("errMsg", errMsg);
      return ret;
    }
    ret.put("tests", builds);
    return ret;
  }

  /** Called by UI to get details info for a specific test case. */
  @JavaScriptMethod
  public JSONObject getTestCaseDetails(
      long startEpoch,
      long endEpoch,
      String testFullName,
      String buildName,
      String subBuildLabels) {
    JSONObject ret = new JSONObject();
    ret.put("errMsg", "");
    JSONArray testCases = new JSONArray();
    DateFormat df = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
    String strStartTime = df.format(new Date(startEpoch));
    String strEndTime = df.format(new Date(endEpoch));
    String c = "sub_build_labels='" + subBuildLabels + "'";
    if (subBuildLabels.isEmpty()) {
      c = "sub_build_labels IS NULL";
    }
    String errMsg =
        query(
            String.format(
                SQL_TEST_CASE_DETAILS, buildName, testFullName, c, strStartTime, strEndTime),
            new String[] {"build_number", "start_time", "duration", "result", "url"},
            testCases);
    if (!errMsg.isEmpty()) {
      ret.put("errMsg", errMsg);
      return ret;
    }
    ret.put("tests", testCases);
    return ret;
  }

  public VTestResultsAnalyzerPluginImpl getSettings() {
    return VTestResultsAnalyzerPluginImpl.getInstance();
  }

  private String checkConnection(String serverIP, String rootPassword, String dbName) {
    Connection connection = null;
    try {
      connection = Util.getConnection(serverIP, rootPassword, dbName);
    } catch (SQLException e) {
      return e.getMessage();
    }
    if (connection != null) {
      try {
        connection.close();
      } catch (SQLException e) {
        LOGGER.log(Level.WARNING, e.getMessage());
      }
      return "";
    }
    return "Failed to establish connection";
  }

  private JSONObject checkTable(Connection conn, String tableName) {
    JSONObject ret = new JSONObject();
    try {
      // Check table existence.
      DatabaseMetaData meta = conn.getMetaData();
      ResultSet tables = meta.getTables(null, null, tableName, new String[] {"TABLE"});
      if (tables.next()) {
        ret.put(KEY_DB_STATUS_TABLE_ERR, "");
      } else {
        ret.put(KEY_DB_STATUS_TABLE_ERR, "Talbe '" + tableName + "' doesn't exist");
      }

      // Check table creation time and size.
      Statement stmt = conn.createStatement();
      ResultSet rs = stmt.executeQuery(String.format(SQL_TABLE_STATS, tableName));
      if (rs.next()) {
        Timestamp createTime = rs.getTimestamp("create_time");
        ret.put(KEY_DB_STATUS_TABLE_CREATION_TIME, createTime == null ? -1 : createTime.getTime());
        ret.put(KEY_DB_STATUS_TABLE_SIZE, rs.getDouble("size"));
      }

      // Check last update time and row counts.
      rs = stmt.executeQuery("SELECT count(*), max(update_time) FROM " + tableName);
      if (rs.next()) {
        ret.put(KEY_DB_STATUS_TABLE_ROW_COUNT, rs.getInt(1));
        Timestamp updateTime = rs.getTimestamp(2);
        ret.put(KEY_DB_STATUS_TABLE_UPDATE_TIME, updateTime == null ? -1 : updateTime.getTime());
      }
    } catch (SQLException e) {
      ret.put(KEY_DB_STATUS_TABLE_ERR, e.getMessage());
      return ret;
    }

    return ret;
  }

  private String query(String sql, String[] cols, JSONArray results) {
    VTestResultsAnalyzerPluginImpl plugin = getSettings();
    String ip = plugin.getServerIP();
    String password = plugin.getRootPassword();

    Connection conn = null;
    try {
      conn = Util.getConnection(ip, password, DB_NAME);
      Statement stmt = conn.createStatement();
      ResultSet rs = stmt.executeQuery(sql);
      while (rs.next()) {
        JSONObject item = new JSONObject();
        for (String col : cols) {
          Object obj = rs.getObject(col);
          if (obj instanceof Double) {
            obj = ((Double) obj).intValue();
          }
          if (obj instanceof Timestamp) {
            obj = ((Timestamp) obj).getTime();
          }
          if (obj != null) {
            item.put(col, obj);
          }
        }
        results.add(item);
      }
    } catch (SQLException e) {
      return e.getMessage() + "<br><br>" + sql;
    } finally {
      if (conn != null) {
        try {
          conn.close();
        } catch (SQLException e) {
          e.printStackTrace();
        }
      }
    }
    return "";
  }
}
