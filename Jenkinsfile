pipeline {
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
        // FIX #1 — give the docker CLI a writable config dir
        DOCKER_CONFIG  = '/tmp/.docker'
        HOME           = '/tmp'
    }

    stages {
        // stage('Test') {
        //     steps {
        //         sh '''
        //             echo "=== Jenkins workspace ==="
        //             pwd
        //             ls -la

        //             echo "=== Check app.js ==="
        //             test -f app.js && echo "app.js EXISTS" || echo "app.js MISSING"

        //             # FIX #2 — inherit the workspace via --volumes-from instead of a host bind-mount
        //             echo "=== Docker mount (via --volumes-from) ==="
        //             docker run --rm \
        //               --volumes-from "$(hostname)" \
        //               alpine:3.20 \
        //               ls -la "$WORKSPACE"

        //             echo "=== Node syntax check ==="
        //             docker run --rm \
        //               --volumes-from "$(hostname)" \
        //               -w "$WORKSPACE" \
        //               node:20-alpine \
        //               node --check app.js
        //         '''
        //     }
        // }
        stage('Test') {
    steps {
        sh '''
            echo "=== Jenkins workspace ==="
            pwd
            ls -la

            test -f app.js && echo "app.js EXISTS" || { echo "app.js MISSING"; exit 1; }

            # --network host makes `hostname` return the HOST's hostname,
            # so pull the real container ID out of cgroups instead.
            CID=$(grep -oE '[0-9a-f]{64}' /proc/self/cgroup 2>/dev/null | head -1)
            if [ -z "$CID" ] || ! docker inspect "$CID" >/dev/null 2>&1; then
                CID=$(cat /etc/hostname)
            fi
            echo "Agent container: $CID"

            echo "=== Docker mount (via --volumes-from $CID) ==="
            docker run --rm --volumes-from "$CID" alpine:3.20 ls -la "$WORKSPACE"

            echo "=== Node syntax check ==="
            docker run --rm --volumes-from "$CID" -w "$WORKSPACE" \\
                node:20-alpine node --check app.js
        '''
    }
}

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
                                  | jq -r ".results[]?.name" 2>/dev/null || true)
                                CUR=$(echo "$TAGS" \
                                  | grep -E "^[0-9]+[.][0-9]+([.][0-9]+)?$" \
                                  | sort -t. -k1,1n -k2,2n -k3,3n \
                                  | tail -1)
                                CUR=${CUR:-1.0}
                                MAJOR=${CUR%%.*}; REST=${CUR#*.}; MINOR=${REST%%.*}
                                case "$REST" in *.*) PATCH=${REST#*.} ;; *) PATCH=0 ;; esac
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
                        trap 'rm -f /tmp/vm_key' EXIT

                        ssh -i /tmp/vm_key -p "$SSH_PORT" \
                            -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
                            -o ConnectTimeout=10 \
                            "$SSH_TARGET" \
                            "set -e
                             docker pull ${DOCKERHUB_USER}/${IMAGE_NAME}:${NEW_VERSION}
                             docker rm -f ${APP_NAME} 2>/dev/null || true
                             docker run -d --name ${APP_NAME} --restart unless-stopped \
                               -p 3000:3000 ${DOCKERHUB_USER}/${IMAGE_NAME}:${NEW_VERSION}"
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
