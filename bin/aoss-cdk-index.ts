#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AossCdkIndexStack } from "../lib/aoss-cdk-index-stack";

const app = new cdk.App();
new AossCdkIndexStack(app, "AossCdkIndexStack", {});
