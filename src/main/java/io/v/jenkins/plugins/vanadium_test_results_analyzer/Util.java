package io.v.jenkins.plugins.vanadium_test_results_analyzer;

import java.io.PrintStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class Util {
  
  private static final String CONSOLE_LOG_PREFIX = "[Vanadium Test Results Analyzer]";

  // Establishes a connection to the given database server.
  static Connection getConnection(String serverIP, String rootPassword, String database)
      throws SQLException {
    String url =
        "jdbc:mysql://"
            + serverIP
            + (database != null ? ("/" + database) : "")
            + "?useSSL=false&serverTimezone=UTC";
    return DriverManager.getConnection(url, "root", rootPassword);
  }
  
  // Logs the given message to the console with a prefix.
  static void logToConsole(PrintStream ps, String msg) {
    ps.print(String.format("%s: %s", CONSOLE_LOG_PREFIX, msg));
  }
}
