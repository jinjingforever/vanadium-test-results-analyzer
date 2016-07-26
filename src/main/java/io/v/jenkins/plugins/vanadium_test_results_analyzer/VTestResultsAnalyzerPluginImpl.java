package io.v.jenkins.plugins.vanadium_test_results_analyzer;

import hudson.Plugin;
import java.util.logging.Logger;

/**
 * The main class for this plugin.
 *
 * <p>We mainly use its singleton instance to store global configurations, such as cloud sql
 * settings.
 *
 * @author Jing Jin (jingjin@google.com)
 */
public class VTestResultsAnalyzerPluginImpl extends Plugin {
  private static final Logger LOGGER =
      Logger.getLogger(VTestResultsAnalyzerPluginImpl.class.getName());

  /** The singleton instance. */
  private static VTestResultsAnalyzerPluginImpl instance = null;

  private String serverIP = "";
  private String rootPassword = "";
  private boolean pluginDisabled = false;

  public VTestResultsAnalyzerPluginImpl() {
    instance = this;
  }

  @Override
  public void start() throws Exception {
    super.start();
    load();

    // Register mysql jdbc driver.
    Class.forName("com.mysql.jdbc.Driver");

    LOGGER.info("Vanadium Test Results Analyzer plugin initialized.");
  }

  public static VTestResultsAnalyzerPluginImpl getInstance() {
    return instance;
  }

  public String getServerIP() {
    return serverIP;
  }

  public void setServerIP(String serverIP) {
    this.serverIP = serverIP;
  }

  public String getRootPassword() {
    return rootPassword;
  }

  public void setRootPassword(String rootPassword) {
    this.rootPassword = rootPassword;
  }
  
  public boolean getPluginDisabled() {
    return pluginDisabled;
  }

  public void setPluginDisabled(boolean pluginDisabled) {
    this.pluginDisabled = pluginDisabled;
  }
}
