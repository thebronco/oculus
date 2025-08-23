$ErrorActionPreference = "Continue"
Write-Host "Listing possible leftovers with 'oculus_' prefix (read-only)..." -ForegroundColor Cyan

Write-Host "`nVPCs:"; aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*oculus_*" --query "Vpcs[].{VpcId:VpcId,Name:Tags[?Key=='Name']|[0].Value}" --output table
Write-Host "`nSecurity Groups:"; aws ec2 describe-security-groups --filters "Name=group-name,Values=oculus_*" --query "SecurityGroups[].{Id:GroupId,Name:GroupName}" --output table
Write-Host "`nDB Instances:"; aws rds describe-db-instances --query "DBInstances[?contains(DBInstanceIdentifier, 'oculus_')].[DBInstanceIdentifier,DBInstanceStatus]" --output table
Write-Host "`nDB Proxies:"; aws rds describe-db-proxies --query "DBProxies[?contains(DBProxyName, 'oculus_')].[DBProxyName,Status]" --output table
Write-Host "`nSecrets:"; aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'oculus_')].[Name,DeletedDate]" --output table
Write-Host "`nS3 Buckets:"; aws s3api list-buckets --query "Buckets[?contains(Name, 'oculus')].Name" --output table
Write-Host "`nCloudFront Distributions:"; aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment, 'oculus') || contains(Id, 'oculus')].[Id,Comment,Status]" --output table
Write-Host "`nLambda functions:"; aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'oculus_')].[FunctionName,State]" --output table
Write-Host "`nAPI Gateways:"; aws apigateway get-rest-apis --query "items[?contains(name, 'oculus')].[id,name]" --output table
Write-Host "`nCloudWatch Log Groups:"; aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/oculus_" --query "logGroups[].logGroupName" --output table

Write-Host "`nDone." -ForegroundColor Green
