package io.v.jenkins.plugins.vanadium_test_results_analyzer;

import hudson.matrix.MatrixRun;
import hudson.model.AbstractBuild;
import hudson.tasks.junit.CaseResult;
import hudson.tasks.test.TabulatedResult;
import hudson.tasks.test.TestResult;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Collection;

public class TestResultsSender implements Runnable {

  static interface TestResultsSenderEventHandler {
    void onFinish(String errMsg);
  }

  private String ip;
  private String password;
  private TestResult packageResult;
  private TabulatedResult classResult;
  private AbstractBuild<?, ?> build;
  private String errMsg = "";
  private TestResultsSenderEventHandler eventHandler;

  public TestResultsSender(
      String ip,
      String password,
      TestResult packageResult,
      TabulatedResult classResult,
      AbstractBuild<?, ?> build,
      TestResultsSenderEventHandler eventHandler) {
    this.ip = ip;
    this.password = password;
    this.packageResult = packageResult;
    this.classResult = classResult;
    this.build = build;
    this.eventHandler = eventHandler;
  }

  @Override
  public void run() {
    // TODO(jingjin): Auto-generated method stub
    Connection conn = null;
    try {
      conn = Util.getConnection(ip, password, VTestResultsAnalyzerMgmtLink.DB_NAME);
      conn.setAutoCommit(false);

      String sqlInsert =
          String.format(
              "INSERT INTO "
                  + VTestResultsAnalyzerMgmtLink.TB_TEST_RESULTS
                  + "(jenkins_project, build_number, sub_build_labels, test_package, "
                  + "test_class, test_case, test_full_name, "
                  + "start_time, duration, result, url, update_time) VALUES "
                  + "(?,?,?,?,?,?,?,?,?,?,?,?)");
      PreparedStatement ps = conn.prepareStatement(sqlInsert);

      String packageName = packageResult.getDisplayName();
      String className = classResult.getDisplayName();
      Collection<? extends TestResult> testCases = classResult.getChildren();
      for (TestResult testCase : testCases) {
        CaseResult caseResult = (CaseResult) testCase;
        String url =
            String.format(
                "%stestReport/%s/%s/%s/",
                build.getUrl(),
                packageResult.getSafeName(),
                classResult.getSafeName(),
                caseResult.getSafeName());
        String result = "PASSED";
        if (caseResult.isFailed()) {
          result = "FAILED";
        } else if (caseResult.isSkipped()) {
          result = "SKIPPED";
        }
        ps.clearParameters();
        ps.setString(1, build.getRootBuild().getProject().getName()); // jenkins_project
        ps.setInt(2, build.getNumber()); // build_number
        if (build instanceof MatrixRun) {
          ps.setString(3, build.getParent().getName()); // sub build labels for sub builds.
        } else {
          ps.setString(3, null); // null for root build.
        }
        ps.setString(4, packageName); // package name
        ps.setString(5, className); // class name
        ps.setString(6, caseResult.getDisplayName()); // case name
        ps.setString(7, caseResult.getFullDisplayName()); // full name
        ps.setTimestamp(8, new Timestamp(build.getStartTimeInMillis())); // start time.
        ps.setFloat(9, caseResult.getDuration()); // duration (in seconds)
        ps.setString(10, result); // result
        ps.setString(11, url);
        long curMs = System.currentTimeMillis();
        ps.setTimestamp(12, new Timestamp(curMs));
        ps.addBatch();
      }
      ps.executeBatch();
      conn.commit();
      conn.setAutoCommit(true);
    } catch (SQLException e) {
      errMsg = e.getMessage();
      return;
    } finally {
      if (conn != null) {
        try {
          conn.close();
        } catch (SQLException e) {
          errMsg = e.getMessage();
        }
      }
      if (eventHandler != null) {
        eventHandler.onFinish(errMsg);
      }
    }
  }

  public String getErrorMessage() {
    return errMsg;
  }
}
