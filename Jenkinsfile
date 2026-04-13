stage('Deploy on EC2') {
    steps {
        sshagent(['ec2-ssh-key']) {
            sh '''
            ssh -o StrictHostKeyChecking=no ubuntu@<EC2-IP> '
                docker stop mediassist || true
                docker rm mediassist || true
                docker run -d -p 3000:3000 --name mediassist mediassist-app
            '
            '''
        }
    }
}