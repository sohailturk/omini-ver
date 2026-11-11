pipeline {
    // agent {
    //     docker {
    //         image 'docker:27-cli'
    //         args '-v /var/run/docker.sock:/var/run/docker.sock --network host'
    //     }
    // }
    agent {
    docker {
        image 'docker:27-cli'
        args '-v /var/run/docker.sock:/var/run/docker.sock --group-add 127 --network host'
    }
}

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        DOCKERHUB_USER = 'bluells'
        IMAGE_NAME     = 'my-app'
        APP_NAME       = 'my-app'
        SSH_TARGET     = 'root@127.0.0.1'
        SSH_PORT       = '2222'
    }

    stages {
        // stage('Test') {
        //     steps {
        //         sh 'docker run --rm -v "$WORKSPACE":/app -w /app node:20-alpine node --check app.js'
        //     }
        // }

        stage('Test') {
    steps {
        sh '''
            echo "=== Jenkins workspace ==="
            pwd
            ls -la

            echo "=== Check app.js ==="
            test -f app.js && echo "app.js EXISTS" || echo "app.js MISSING"

            echo "=== Docker mount ==="
            docker run --rm \
              -v "$WORKSPACE":/app \
              -w /app \
              alpine:3.20 \
              ls -la /app
        '''
    }
}

        // stage('Version') {
        //     steps {
        //         script {
        //             env.NEW_VERSION = sh(
        //                 script: '''
        //                     apk add --no-cache curl jq >/dev/null 2>&1
        //                     TAGS=$(curl -fsS "https://hub.docker.com/v2/repositories/${DOCKERHUB_USER}/${IMAGE_NAME}/tags?page_size=100" \
        //                            | jq -r '.results[]?.name' 2>/dev/null || true)
        //                     CUR=$(echo "$TAGS" | grep -E '^[0-9]+[.][0-9]+([.][0-9]+)?$' \
        //                           | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)
        //                     CUR=${CUR:-1.0}
        //                     MAJOR=${CUR%%.*}; REST=${CUR#*.}; MINOR=${REST%%.*}
        //                     case "$REST" in *.*) PATCH=${REST#*.} ;; *) PATCH=0 ;; esac
        //                     echo "${MAJOR}.${MINOR}.$((PATCH + 1))"
        //                 ''',
        //                 returnStdout: true
        //             ).trim()
        //             echo "Next version: ${env.NEW_VERSION}"
        //         }
        //     }
        // }

stage('Version') {
    steps {
        script {
            env.NEW_VERSION = sh(
                script: '''
                    docker run --rm \
                      -e DOCKERHUB_USER \
                      -e IMAGE_NAME \
                      alpine:3.20 sh -c '
                        set -e

                        apk add --no-cache curl jq >/dev/null 2>&1

                        TAGS=$(curl -fsS \
                          "https://hub.docker.com/v2/repositories/${DOCKERHUB_USER}/${IMAGE_NAME}/tags?page_size=100" \
                          | jq -r ".results[]?.name")

                        CUR=$(echo "$TAGS" \
                          | grep -E "^[0-9]+[.][0-9]+([.][0-9]+)?$" \
                          | sort -t. -k1,1n -k2,2n -k3,3n \
                          | tail -1)

                        CUR=${CUR:-1.0}

                        MAJOR=${CUR%%.*}
                        REST=${CUR#*.}
                        MINOR=${REST%%.*}

                        case "$REST" in
                          *.*) PATCH=${REST#*.} ;;
                          *) PATCH=0 ;;
                        esac

                        echo "${MAJOR}.${MINOR}.$((PATCH + 1))"
                      '
                ''',
                returnStdout: true
            ).trim()

            echo "Next version: ${env.NEW_VERSION}"
        }
    }
}


        stage('Build') {
            steps {
                sh '''
                    docker build \
                      -t "${DOCKERHUB_USER}/${IMAGE_NAME}:${NEW_VERSION}" \
                      -t "${DOCKERHUB_USER}/${IMAGE_NAME}:latest" .
                '''
            }
        }

        stage('Push') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-cred',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:${NEW_VERSION}"
                        docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: 'vm-ssh-key', variable: 'SSH_KEY')]) {
                    sh '''
                        cp "$SSH_KEY" /tmp/vm_key && chmod 600 /tmp/vm_key
                        ssh -i /tmp/vm_key -p "$SSH_PORT" \
                            -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
                            "$SSH_TARGET" \
                            "set -e
                             docker pull ${DOCKERHUB_USER}/${IMAGE_NAME}:${NEW_VERSION}
                             docker rm -f ${APP_NAME} 2>/dev/null || true
                             docker run -d --name ${APP_NAME} --restart unless-stopped \
                               -p 3000:3000 ${DOCKERHUB_USER}/${IMAGE_NAME}:${NEW_VERSION}"
                        rm -f /tmp/vm_key
                    '''
                }
            }
        }
    }

    post {
        success { echo "Build, push and deploy completed. Version: ${env.NEW_VERSION}" }
        failure { echo 'Pipeline failed - check the stage logs above.' }
    }
}