import { execSync } from "child_process";
import * as inquirer from "inquirer";

function run(cmd: string, cwd?: string) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: cwd || process.cwd(), env: process.env });
}

async function main() {
  console.log("This will destroy the Oculus CDK stack and clean up resources.");
  const { confirm } = await inquirer.prompt([
    { type: "confirm", name: "confirm", message: "Are you sure?", default: false },
  ]);

  if (!confirm) {
    console.log("Aborted.");
    return;
  }

  run("npx cdk destroy --force", "cdk");

  console.log("Checking for leftover CloudFront distributions with Project=oculus tag...");
  console.log("If found, disable + delete them manually via:");
  console.log("aws cloudfront update-distribution --id DIST_ID --distribution-config file://config.json");
  console.log("aws cloudfront delete-distribution --id DIST_ID --if-match ETAG");
}

main().catch((err) => {
  console.error("Destroy failed:", err);
  process.exit(1);
});
