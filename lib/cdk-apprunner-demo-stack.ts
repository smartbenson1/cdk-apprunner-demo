import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class CdkApprunnerDemoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    ///Create a new VPC
    const vpc = new ec2.Vpc(this, 'apprunner_vpc', {
      cidr: '10.0.0.0/21',
      maxAzs: 2,
    });

    //VPC Connector for App Runner
    const vpcConnector = new apprunner.VpcConnector(this, 'VpcConnector', {
      vpc,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      vpcConnectorName: 'DemoVpcConnector',
    });
    
   // Create a new instance role for App Runner service
   const instancerole = new iam.Role(this, 'apprunner-rds-role', {
    assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });

  instancerole.addToPolicy(new PolicyStatement({
    resources: ['*'],
    actions: ['rds-db:connect'],
  }))

    new apprunner.Service(this, 'Service', {
      source: apprunner.Source.fromGitHub({
        repositoryUrl: 'https://github.com/smartbenson1/hello-app-runner.git',
        branch: 'main',
        configurationSource: apprunner.ConfigurationSourceType.REPOSITORY,
        connection: apprunner.GitHubConnection.fromConnectionArn(#REPLACE_WITH_ARN_OF_CONNECTION),
      }),
      vpcConnector,
      instanceRole: instancerole,
    });

    //Get the Security Group from the Hyperplane ENI of AppRunner's VPC Connector 
    const vpc_connector_sg = vpcConnector.connections.securityGroups[0];
    // Create a password for Aurora DB
    const secret = new rds.DatabaseSecret(this, 'AuroraSecret', {
      username: 'clusteradmin',
    });

    // Create a security group for Aurora DB
    const aurora_sg = new ec2.SecurityGroup(this, 'aurora_sg', {
      vpc: vpc,
      allowAllOutbound: true,
      description: "Security group created for the Aurora DB cluster",
      securityGroupName: "aurora_sg",
    });
    //aurora_sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306), 'DB port 3306 inbound from App Runner');
    aurora_sg.connections.allowFrom(vpc_connector_sg, ec2.Port.tcp(3306), 'DB port 3306 inbound from App Runner');

    // Create a new RDS cluster for Aurora
    const cluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_10_2 }),
      clusterIdentifier: 'apprunner-db',
      iamAuthentication: true, 
      //defaultDatabaseName: 'bookcase',
      credentials: rds.Credentials.fromGeneratedSecret('clusteradmin'), // Optional - will default to 'admin' username and generated password
      instanceProps: {
        // optional , defaults to t3.medium
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.SMALL),
        publiclyAccessible: false,
        securityGroups: [aurora_sg],
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        vpc,
      },
    });

  }
}
