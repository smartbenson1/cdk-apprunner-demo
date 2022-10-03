#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkApprunnerDemoStack } from '../lib/cdk-apprunner-demo-stack';

const app = new cdk.App();
new CdkApprunnerDemoStack(app, 'CdkApprunnerDemoStack');
