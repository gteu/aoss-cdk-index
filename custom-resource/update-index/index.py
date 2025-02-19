from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
import boto3
import json
import os


def handler(event, context):
    print("Received event: " + json.dumps(event, indent=2))

    host = os.environ['OPENSEARCH_HOST'].replace('https://', '')
    region = os.environ['AWS_REGION']
    service = 'aoss'
    credentials = boto3.Session().get_credentials()
    auth = AWSV4SignerAuth(credentials, region, service)

    client = OpenSearch(
        hosts=[{'host': host, 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )

    index_name = event['ResourceProperties']['IndexName']
    index_body = event['ResourceProperties']['IndexBody']

    if event['RequestType'] == 'Create':
        response = client.indices.create(index=index_name, body=index_body)
        print("Index created: " + json.dumps(response, indent=2))
        return {"index_name": index_name}

    elif event['RequestType'] == 'Delete':
        response = client.indices.delete(index=index_name)
        print("Index deleted: " + json.dumps(response, indent=2))
        return {}

    elif event['RequestType'] == 'Update':
        response = client.indices.put_mapping(
            index=index_name, body=index_body["mappings"])
        print("Index updated: " + json.dumps(response, indent=2))
        return {}
