import hudson.model.BuildAuthorizationToken
import hudson.model.FreeStyleProject
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import hudson.security.HudsonPrivateSecurityRealm
import hudson.tasks.Shell
import jenkins.model.Jenkins

def jenkins = Jenkins.get()
def adminUser = System.getenv('BYTESKY_JENKINS_ADMIN_USER') ?: 'admin'
def adminPassword = System.getenv('BYTESKY_JENKINS_ADMIN_PASSWORD') ?: 'admin123'
def jobName = System.getenv('BYTESKY_JENKINS_JOB_NAME') ?: 'bytesky-node-app'
def buildToken = System.getenv('BYTESKY_JENKINS_BUILD_TOKEN') ?: 'bytesky-build-token'
def projectDir = System.getenv('BYTESKY_PROJECT_DIR') ?: '/workspace/bytesky-cloud'
def jenkinsfile = new File(projectDir, 'Jenkinsfile')

def securityRealm = jenkins.getSecurityRealm()
if (!(securityRealm instanceof HudsonPrivateSecurityRealm)) {
  securityRealm = new HudsonPrivateSecurityRealm(false)
  jenkins.setSecurityRealm(securityRealm)
}

if (securityRealm.getUser(adminUser) == null) {
  securityRealm.createAccount(adminUser, adminPassword)
}

def authorizationStrategy = new FullControlOnceLoggedInAuthorizationStrategy()
authorizationStrategy.setAllowAnonymousRead(false)
jenkins.setAuthorizationStrategy(authorizationStrategy)

def pipelineScript = jenkinsfile.exists()
  ? jenkinsfile.getText('UTF-8')
  : """
pipeline {
  agent any
  stages {
    stage('Missing Jenkinsfile') {
      steps {
        echo 'Jenkinsfile not found at ${projectDir}'
      }
    }
  }
}
"""

def freestyleScript = """
set -e
PROJECT_DIR="${projectDir}"
if [ ! -d "${projectDir}" ]; then
  echo "Project directory not found: ${projectDir}"
  exit 1
fi
cd "${projectDir}"
npm install
npm --prefix backend install
if command -v docker >/dev/null 2>&1; then
  docker build -t bytesky-cloud-app .
else
  echo "Docker CLI is not available inside Jenkins, skipping docker build."
fi
"""

def workflowJobClass = null
def cpsFlowDefinitionClass = null

try {
  workflowJobClass = jenkins.pluginManager.uberClassLoader.loadClass('org.jenkinsci.plugins.workflow.job.WorkflowJob')
  cpsFlowDefinitionClass = jenkins.pluginManager.uberClassLoader.loadClass('org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition')
} catch (Throwable error) {
  println("ByteSky bootstrap is using freestyle fallback because pipeline plugins are unavailable: ${error.message}")
}

def existingJob = jenkins.getItem(jobName)
def job = existingJob

if (workflowJobClass != null && cpsFlowDefinitionClass != null) {
  if (existingJob != null && !workflowJobClass.isInstance(existingJob)) {
    existingJob.delete()
    job = null
  }

  if (job == null) {
    job = jenkins.createProject(workflowJobClass, jobName)
  }

  job.setDescription('ByteSky Node.js pipeline job managed automatically by the Docker marketplace.')
  def definition = cpsFlowDefinitionClass.getConstructor(String, Boolean.TYPE).newInstance(pipelineScript, true)
  job.setDefinition(definition)
} else {
  if (existingJob != null && !(existingJob instanceof FreeStyleProject)) {
    existingJob.delete()
    job = null
  }

  if (job == null) {
    job = jenkins.createProject(FreeStyleProject, jobName)
  }

  job.setDescription('ByteSky Node.js build job managed automatically by the Docker marketplace.')
  job.buildersList.clear()
  job.buildersList.add(new Shell(freestyleScript))
}

try {
  job.setAuthToken(BuildAuthorizationToken.create(buildToken))
} catch (Throwable error) {
  println("ByteSky bootstrap could not set the remote build token: ${error.message}")
}

job.save()
jenkins.save()

println("ByteSky Jenkins job '${jobName}' is ready.")
