pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "mediassist-app"
    }

    stages {

        stage('Clone Code') {
            steps {
                git branch: 'main', url: 'https://github.com/nukalavarshita/MediAssist.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $DOCKER_IMAGE .'
            }
        }

        stage('Deploy on EC2') {
            steps {
                sshagent(['ec2-ssh-key']) {
                    sh '''
                    ssh -o StrictHostKeyChecking=no ubuntu@13.127.217.51 '
                        docker stop mediassist || true
                        docker rm mediassist || true
                        docker run -d -p 3000:3000 --name mediassist mediassist-app
                    '
                    '''
                }
            }
        }
    }
}
