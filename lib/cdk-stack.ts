import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as  Key  from 'aws-cdk-lib/aws-kms';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2Targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as iam from "aws-cdk-lib/aws-iam";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

      // *****************************************
      //      VPC, 1 public and 1 private subnet
      // *****************************************
      const vpc = new ec2.Vpc(this, "alb-lambda-vpc", {
            maxAzs: 2,
            // ipAddresses: [],
            natGateways: 1,
            subnetConfiguration: [
              {
                cidrMask: 24,
                name: "ingress",
                subnetType: ec2.SubnetType.PUBLIC,
              },
              {
                cidrMask: 24,
                name: "application",
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
              },
            ],
          });
          
      vpc.addFlowLog('FlowLogHuma')
  

      // **************************************
      //  Security group can receive traffic from internet on given ports
      // **************************************

      const serviceSG = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', { 
        vpc,
         allowAllOutbound: true ,
         description: 'Security group for bastion host',
         securityGroupName: 'BastionSecurityGroup'
        });
   
       // serviceSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH access'); not required with session manager
     serviceSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22))
      serviceSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))
       serviceSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8545))
        serviceSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8546))
    

      // **************************************
      //          Role and Policy
      // **************************************

      const appServerRole = new iam.Role(this, "AppServerRole", {
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        // managedPolicies: [
        //   iam.ManagedPolicy.fromAwsManagedPolicyName(
        //     "service-role/AmazonECSTaskExecutionRolePolicy"// need to find apt one
        //   ),
        // ],
      });

      appServerRole.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ["ec2-instance-connect:SendSSHPublicKey"],
    }));
 
 

      // **************************************
      //        EC2 inside private subnet
      // ************************************** 
    // create a EC2 in private subnet
    // need to create 1 in each avaiability zone , in our case 3 in each azs.
    // and one in public subnet for Explorer with web server , in each azs.
    
    const nodeEc2 = new ec2.Instance(this, "our-instances", {
      vpc,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      availabilityZone: vpc.availabilityZones[0],
      role: appServerRole,
      securityGroup: serviceSG,
      ssmSessionPermissions: true,
    })

    nodeEc2.instance.addPropertyOverride("KeyName", "EC2KeyPair")

        // **************************************
        //      BastionHost in public subnet
        // **************************************

        const bastionHostLinux = new ec2.BastionHostLinux(this, 'BastionHostLinux', {  
          vpc: vpc,
          instanceName: "BastionHostLinux",
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL),
          securityGroup: serviceSG,
          subnetSelection: {
            subnetType: ec2.SubnetType.PUBLIC
          }
        });
        bastionHostLinux.allowSshAccessFrom(ec2.Peer.anyIpv4())
        bastionHostLinux.instance.instance.addPropertyOverride("KeyName", "BastionKeyPair")
        // bastionHostLinux.
        // ***********************************************
        //     ApplicationLoadBalancer in public subnet
        // ***********************************************
      const loadbalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "alb-lambda-lb",
      {
        vpc,
        loadBalancerName: "albino",
        securityGroup:serviceSG,
        // http2Enabled: true,
        // securityGroup: serviceSG.securityGroupId,
        // internetFacing: true,
        vpcSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PUBLIC,
        })
      }
    );

    // If this is specified, the load balancer will be opened up to anyone who can reach it.
    //  For internal load balancers this is anyone in the same VPC.
    //  For public load balancers, this is anyone on the internet.
    // If you want to be more selective about who can access this 
    // load balancer, set this to false and use the listener's connections

    const listener1 = loadbalancer.addListener('PublicListener1', { 
      port: 8545, 
      open: false,
      protocol: elbv2.ApplicationProtocol.HTTP,
      // defaultTargetGroups
    });

    const listener2 = loadbalancer.addListener('PublicListener2', { 
      port: 8546, 
      open: false ,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });
        // listener1.connections.allowInternally   
  
        listener1.connections.allowFrom(  
          bastionHostLinux ,
          ec2.Port.tcp(8545),
          "Allow all ingress 8545 traffic to be routed to the VPC"
        );
        listener2.connections.allowFrom(
          bastionHostLinux,
          ec2.Port.tcp(8546),
          "Allow all ingress 8546 traffic to be routed to the VPC"
        );
        listener1.connections.allowTo(  
          bastionHostLinux ,
          ec2.Port.tcp(8545),
          "Allow all engress 8545 traffic to be routed to the VPC"
        );
        listener2.connections.allowTo(
          bastionHostLinux,
          ec2.Port.tcp(8546),
          "Allow all engress 8546 traffic to be routed to the VPC"
        );

        // **************************************
        //     Method 1
        // **************************************

        const targetGroup = new elbv2.ApplicationTargetGroup(
          this,
          "alb-ec2-target-group",
          {
            vpc,
            targetType: elbv2.TargetType.INSTANCE,
            targets: [new elbv2Targets.InstanceTarget(nodeEc2, 80)],
            port:80,
            // protocol: elbv2.ApplicationProtocol.HTTP,
            // protocolVersion: elbv2.ApplicationProtocolVersion.GRPC,
            // healthCheck: {
            //   enabled: true,
            //   healthyGrpcCodes: '0-99',
            // },
          }
        );
        
        listener1.addAction("alb-ec2-action", {
          action: elbv2.ListenerAction.forward([targetGroup]), 
          // conditions: [elbv2.ListenerCondition.pathPatterns(["/hello"])],
          // priority: 1,/ used with conditions
        });


        // **************************************
        //     Method 2
        // **************************************
        listener2.addTargets('EC2-listner2', {
        port: 8546,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [new elbv2Targets.InstanceTarget(nodeEc2, 80)]
           // include health check (default is none)
        // healthCheck: {
        //   interval: cdk.Duration.seconds(60),
        //   path: "/health",
        //   timeout: cdk.Duration.seconds(5),
        // }
        });

        listener2.addAction("alb-ec2-action2", {
          action: elbv2.ListenerAction.forward([targetGroup])
        });

    //  serviceSG.connections.allowFrom(loadbalancer, ec2.Port.tcp(80));// no need for this as we have added listener

    // const connections = new ec2.Connections({
    //   securityGroups: [serviceSG],
    //   defaultPort: ec2.Port.tcp(443), // Control Plane has an HTTPS API
    // });

      // **************************************
      //              Outputs
      // **************************************
      new cdk.CfnOutput(this, 'BastioInstanceId', { value: bastionHostLinux.instanceId});
      new cdk.CfnOutput(this, 'LoadBalancerDNS', {
        value: loadbalancer.loadBalancerDnsName,
      });

  }
}


// You may wish to add port 443 to the load balancer, and configure an SSL certificate for HTTPS traffic