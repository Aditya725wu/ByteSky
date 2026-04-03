pipeline {
  agent any

  environment {
    BYTESKY_PROJECT_DIR = "${env.BYTESKY_PROJECT_DIR ?: '/workspace/bytesky-cloud'}"
    BYTESKY_GIT_REPO_URL = "${env.BYTESKY_GIT_REPO_URL ?: ''}"
    BYTESKY_GIT_BRANCH = "${env.BYTESKY_GIT_BRANCH ?: 'main'}"
  }

  stages {
    stage('Checkout') {
      steps {
        script {
          if (env.BYTESKY_GIT_REPO_URL?.trim()) {
            dir('repo') {
              git branch: env.BYTESKY_GIT_BRANCH, url: env.BYTESKY_GIT_REPO_URL
            }
            env.BYTESKY_BUILD_DIR = "${env.WORKSPACE}/repo"
            echo "Pulled project from ${env.BYTESKY_GIT_REPO_URL}"
          } else {
            env.BYTESKY_BUILD_DIR = env.BYTESKY_PROJECT_DIR
            echo "Using mounted project workspace at ${env.BYTESKY_BUILD_DIR}"
          }
        }
      }
    }

    stage('Install') {
      steps {
        dir("${env.BYTESKY_BUILD_DIR}") {
          sh 'npm install'
          sh 'npm --prefix backend install'
        }
      }
    }

    stage('Build') {
      steps {
        dir("${env.BYTESKY_BUILD_DIR}") {
          sh '''
            set -e
            if command -v docker >/dev/null 2>&1; then
              docker build -t bytesky-cloud-app .
            else
              echo "Docker CLI is not available inside Jenkins, skipping docker build."
            fi
          '''
        }
      }
    }
  }
}
