# Vanadium Test Results Analyzer

## Overview

Vanadium<sup>[1](#footnote1)</sup> Test Results Analyzer is a Jenkins plugin
that allows users to easily see and analyze stats (result, duration, etc) of
Jenkins builds and test cases. After the plugin is installed, a **post-build
step** can be added to any Jenkins project to send build and/or tests stats to
an external MySQL database (which can be set up by the plugin), and a set of
**dashboards** are provided to let users see overviews of all collected stats
and their detailed information.

Jenkins itself already shows stats of builds and test cases, but they are
scattered everywhere and it is hard and slow to use its UI to answer questions
like:

- Which projects failed in the last X days.
- What are the longest running test cases of all my projects.
- How often does TestXXX fail in the past X days.

If you find yourself trying to answer these questions, this plugin is for you.

## Installation

This plugin is not in Jenkins plugins central repository yet, so you will have
to install it manually.

1.  Clone this repo, and run `mvn install` from its root directory to build the
plugin. You need at lease Java 1.7 and mvn installed on your system.
1.  From your Jenkins instance, visit "Manage Jenkins > Manage Plugins", select
the "Advanced" tab, and under the "Upload Plugin" section, upload the plugin at
`${root_dir}/target/vanadium-test-results-analyzer.hpi`.
1. You may need to restart Jenkins if you've installed this plugin before.

## Setup

You only need to follow these steps once before starting using the plugin.

1. Set up a MySQL instance somewhere. Remember its IP address and root password.
1. Visit plugin's settings page: "Manage Jenkins > Vanadium Test Results
Analyzer > Settings"
1. Enter the correct IP address and root password, make sure it works by
clicking the "Test Connection" button, and then click "Save".
1. In the "Status" section, it will show an error message because no database
and tables have been set up yet. Click the "Fix Database and Tables" button to
let plugin create those for you automatically.
1. If everything is set up correctly, it will show stats of two tables as below.
Visit this page in the future to see your tables grow.

<div style="text-align:center"><img alt="settings"
src="https://dl.dropboxusercontent.com/s/g4mizfvtf64syqu/settings.png"
width="601px"></div>

## Enable Plugin In Projects

After the plugin is installed, add the post-build step "Send test results to
Vanadium Test Results Analyzer" to projects that you want to collect stats for.
You have the options to send jenkins build results and/or test results. Click on
their "help" icon for more info.

<div style="text-align:center"><img alt="post-build"
src="https://dl.dropboxusercontent.com/s/kvao4lsh7m0k1q3/postbuild.png"
width="864px"></div>

When the plugin is enabled for a project, you will see logs in the console about
sending data to the analyzer.

<pre>
[Vanadium Test Results Analyzer]: Sending jenkins build stats. Please wait.
[Vanadium Test Results Analyzer]: Build stats sent.
[Vanadium Test Results Analyzer]: Sending test results. Please wait.
[Vanadium Test Results Analyzer]: 2287 test results sent. Took 0.5 seconds.
</pre>

## Dashboards

Dashboards can be accessed at the "Manage Jenkins > Vanadium Test Results
Analyzer" page. For each of the "jenkins builds" and "test cases" category,
there are two dashboards: overview and detailed info.

### Jenkins Builds Overview

This dashboard shows Jenkins builds stats during a given time period. The rows
that start with a triangle are matrix (multi-configuration) projects. Open the
triangle to see their sub-builds with different configurations
(vanadium-java-test as an example in the screenshot below). The table is sorted
by average durations by default. You can use the "Time Period" controls to
change the current time period.

Clicking on a project name will open it in the Jenkins Build Details dashboard.
Clicking on a number of certain results (failure, aborted, etc) will go to the
same Details dashboard, but it will only show that result. More about this in
the next section.

<div style="text-align:center"><img alt="jenkins-builds-overview"
src="https://dl.dropboxusercontent.com/s/v3hp947686fiibd/jenkins-builds-overview.png"
width="969px"></div>

### Jenkins Build Details

This dashboard shows all past builds for the given project during a given time
period. The builds are visualized in color blocks with details in a table.
Clicking on a color block will highlight the corresponding row in the table.
Clicking on result stats above the color blocks will filter the table rows by
those results. Under the table shows durations histogram and trend. You can
freely change the build name in the text field (auto-complete supported) at the
top of the page.

<div style="text-align:center"><img alt="jenkins-build-details"
src="https://dl.dropboxusercontent.com/s/xftjmqqmydnld6p/jenkins-build-details.png"
width="533px"></div>

### Test Cases Overview

This dashboard shows overview stats of all the collected test cases during the
given time period. It has two tables. The first table shows all the failed test
cases, and the second table shows the top 50 slow test cases. Clicking on a test
case will bring it into the Test Case Details dashboard.

<div style="text-align:center"><img alt="test-cases-overview"
src="https://dl.dropboxusercontent.com/s/h3v2w737k6bjyab/test-cases-overview.png"
width="1110px"></div>

### Test Case Details

This dashboard shows all the past runs for the given test case during a given
time period. The layout and functions are very similar to Jenkins Build Details
dashboard.

<div style="text-align:center"><img alt="test-case-details"
src="https://dl.dropboxusercontent.com/s/fevhfkham4q9fes/test-case-details.png"
width="564px"></div>


---

<a name="footnote1">1</a>: [vanadium](https://github.com/vanadium) was a super
awesome framework designed to make it much easier to develop secure, distributed
applications that can run anywhere. This plugin was created duration its
development.
