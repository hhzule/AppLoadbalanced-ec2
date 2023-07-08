https://faun.pub/create-a-bastion-with-aws-cdk-d5ebfb91aef9
https://github.com/devopsrepohq/bastion
https://repost.aws/knowledge-center/ec2-troubleshoot-bastion-host-connection
https://github.com/aws-samples/secure-bastion-cdk
https://github.com/aws-samples

https://www.raghurana.com/how-to-samples-with-aws-cdk

https://www.cloudtechsimplified.com/aws-lambda-with-application-load-balancer/

Stack So Far

- a VPC with 1 public , 1 private subnet

- public subnet will have bastion host and ec2 with explorer webInterface.
  (not added now as this would be in public subnet and would be managed as usual)
- security group allowed to receive traffic from internet on ports [8545, 8546,80,22], we might not need 22 as SSh shall be managed through session manager on AWS.
- Load balancer would listen on port [8545, 8546] , only allowed connections from BastionHost(controlled)
- loadBalancer has target group of ec2 instance inside private subnet.
- ec2 instancehas webserver listing on port 80 for testing purposes
