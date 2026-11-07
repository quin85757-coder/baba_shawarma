const required = ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT_ID"];

const missing = required.filter((k) => !process.env[k] || !process.env[k].trim());

if (missing.length > 0) {
  console.error("\nBUILD STOPPED. These variables are empty or missing at build time:");
  for (const k of missing) console.error(`  - ${k}`);
  console.error(
    '\nIn Cloudflare add them under Settings -> Build -> "Variables and secrets" (the BUILD list, not the runtime one), then retry the build.\n'
  );
  process.exit(1);
}

if (!/^https?:\/\//.test(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)) {
  console.error("\nBUILD STOPPED. NEXT_PUBLIC_APPWRITE_ENDPOINT must start with https://\n");
  process.exit(1);
}

console.log("Build variables found:", required.join(", "));