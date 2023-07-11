https://faun.pub/create-a-bastion-with-aws-cdk-d5ebfb91aef9
https://github.com/devopsrepohq/bastion
https://repost.aws/knowledge-center/ec2-troubleshoot-bastion-host-connection
https://github.com/aws-samples/secure-bastion-cdk
https://github.com/aws-samples
https://www.raghurana.com/how-to-samples-with-aws-cdk
https://www.cloudtechsimplified.com/aws-lambda-with-application-load-balancer/
https://dev.to/raphael_jambalos/secure-aws-environments-with-private-public-subnets-2ei9

Stack So Far

- a VPC with 1 public , 1 private subnet
- public subnet will have bastion host and ec2 with explorer webInterface.
  (not added now as this would be in public subnet and would be managed as usual)
- security group allowed to receive traffic from internet on ports [8545, 8546,80,22], we might not need 22 as SSh shall be managed through session manager on AWS.
- Load balancer would listen on port [8545, 8546] , only allowed connections from BastionHost(controlled)
- loadBalancer has target group of ec2 instance inside private subnet.
- ec2 instancehas webserver listing on port 80 for testing purposes

permissions to attach to the Iam user for Session Manager.
{
"Version": "2012-10-17",
"Statement": [
{
"Effect": "Allow",
"Action": [
"ssm:StartSession"
],
"Resource": [
"arn:aws:ec2:*:{account_id}:instance/*"
],
"Condition": {
"StringLike": {
"ssm:resourceTag/Name": [
"BastionHost"
]
}
}
},
{
"Effect": "Allow",
"Action": [
"ec2:DescribeInstances",
"ec2:DescribeImages",
"ec2:DescribeTags",
"ec2:DescribeSnapshots"
],
"Resource": [
"*"
]
},
{
"Effect": "Allow",
"Action": [
"ssm:StartSession"
],
"Resource": [
"arn:aws:ssm:*::document/AWS-StartPortForwardingSession",
"arn:aws:ssm:*::document/AWS-StartSSHSession"
]
},
{
"Effect": "Allow",
"Action": [
"ssm:TerminateSession"
],
"Resource": [
"arn:aws:ssm:*:*:session/${aws:username}-*"
]
},
{
"Effect": "Allow",
"Action": [
"secretsmanager:GetSecretValue",
"secretsmanager:DescribeSecret",
"secretsmanager:ListSecretVersionIds",
"secretsmanager:ListSecrets"
],
"Resource": [
"arn:aws:secretsmanager:*:{account_id}:secret:*"
],
"Condition": {
"StringEquals": {
"secretsmanager:ResourceTag/{tag_key}": "{tag_value}"
}
}
}
]
}
Accessing Bastion host and tunneling into private ec2

> > chmod 600 keyName.pem
> > ssh-add keyName.pem
> > ssh-add -L
> > to remove keys
> > eval `ssh-agent -s`
> > ssh-add -D

<!-- with DNS name -->

ssh -v -A ec2-user@ec2-54-147-16-134.compute-1.amazonaws.com

<!-- with public Ip
 -->

> > ssh -v -A ec2-user@ec2-54-147-16-134

<!-- now connet to private ec2 -->

> > ssh -v ec2-user@10.0.2.29

<!--  now installing react
 -->

> > sudo yum update
> > curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
> > . ~/.nvm/nvm.sh
> > nvm install 16
> > node -e "console.log('Running Node.js ' + process.version)"
> > sudo yum install git
> > git clone <repository-url>
> > cd <repository> npm install
> > npm run build
> > sudo yum install nginx or sudo amazon-linux-extras install nginx1
> > sudo nano /etc/nginx/nginx.conf
> > to resolve error on inginx unit not found:
> > sudo amazon-linux-extras install epel
> > sudo yum install nginx
> > sudo systemctl -l enable nginx
> > sudo systemctl -l start nginx
> > sudo systemctl -l status nginx
> > sudo systemctl -l restart nginx

<!-- run the following to see errors
>> -->

> > nginx -t
> > sudo service nginx restart
> > sudo service nginx start sudo chkconfig nginx on

write the following:
nginx config for bastionhost to route incoming traffic from 8545/8546 to application load balancer

````server {
        listen       8545;
        listen       [::]:8545;
        server_name  _;
        root         /usr/share/nginx/html;
        location / {
        proxy_pass http://internal-<loadBalancer-name>-768903.us-east-1.elb.amazonaws.com:8545/;
        }
}
        ```

nginx config for ec2 in private subnet listening on port 80 and serving react app in this example

````

server {
listen 80;
server*name *;
root /var/www/html;
index index.html index.htm;
location / {
try_files $uri $uri/ =404;
}
}

```

CNTRL + X
Y (for yes)
Enter


test application inside private ec2
https://github.com/hhzule/test-React.git

Secirity points:
-Node instance is inside private subnet, doesnt have public ip/elastic ip hence cannot be accessed through internet.
-Session manager not tested yet , need to impliment for Ssh access alternative and no need for port 22 after that.
-application load balancer only accessable through Bastion host on given ports.

```
