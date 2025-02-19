import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import {
  CfnAccessPolicy,
  CfnCollection,
  CfnSecurityPolicy,
} from "aws-cdk-lib/aws-opensearchserverless";
import { Provider } from "aws-cdk-lib/custom-resources";

export class AossCdkIndexStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const collection = new CfnCollection(this, "OpenSearchCollection", {
      name: "my-opensearch-collection",
      type: "SEARCH",
    });

    const updateIndexFunction = new PythonFunction(
      this,
      "UpdateIndexFunction",
      {
        entry: "custom-resource/update-index",
        runtime: Runtime.PYTHON_3_12,
        initialPolicy: [
          new PolicyStatement({
            actions: ["aoss:*"],
            resources: ["*"],
          }),
        ],
        timeout: cdk.Duration.minutes(15),
        environment: {
          OPENSEARCH_HOST: collection.attrCollectionEndpoint,
        },
      }
    );

    const collectionEncryptionPolicy = new CfnSecurityPolicy(
      this,
      "CollectionEncryptionPolicy",
      {
        name: "encryption-policy",
        type: "encryption",
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: "collection",
              Resource: [`collection/${collection.name}`],
            },
          ],
          AWSOwnedKey: true,
        }),
      }
    );

    collection.addDependency(collectionEncryptionPolicy);

    new CfnSecurityPolicy(this, "CollectionNetworkPolicy", {
      name: "network-policy",
      type: "network",
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: "collection",
              Resource: [`collection/${collection.name}`],
            },
            {
              ResourceType: "dashboard",
              Resource: [`collection/${collection.name}`],
            },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    new CfnAccessPolicy(this, "CollectionAccessPolicy", {
      name: "access-policy",
      type: "data",
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: "collection",
              Resource: [`collection/${collection.name}`],
              Permission: ["aoss:*"],
            },
            {
              ResourceType: "index",
              Resource: [`index/${collection.name}/*`],
              Permission: ["aoss:*"],
            },
          ],
          Principal: [
            `arn:aws:iam::${cdk.Stack.of(this).account}:role/Admin`,
            updateIndexFunction.role!.roleArn,
          ],
        },
      ]),
    });

    const updateIndexProvider = new Provider(this, "UpdateIndexProvider", {
      onEventHandler: updateIndexFunction,
    });

    const indexDefinition = {
      mappings: {
        properties: {
          title: { type: "text" },
          content: { type: "text" },
          // timestamp: { type: "date" }, // コメントアウト外して index update を確認
        },
      },
    };

    new cdk.CustomResource(this, "UpdateIndexResource", {
      serviceToken: updateIndexProvider.serviceToken,
      properties: {
        IndexName: "my-index",
        IndexBody: JSON.stringify(indexDefinition),
      },
    });
  }
}
