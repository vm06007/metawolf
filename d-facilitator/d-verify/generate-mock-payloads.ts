/**
 * Simple script to generate a mock verify request payload for CRE workflow simulation
 * 
 * Usage:
 *   bun run generate-mock-payloads.ts
 * 
 * This generates a single verify-request.json file that can be used with:
 *   cre workflow simulate ./d-verify --http-payload generated-payloads/verify-request.json
 */

import { createMockVerifyRequest } from "./mocks";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// Create output directory
const outputDir = join(process.cwd(), "generated-payloads");
mkdirSync(outputDir, { recursive: true });

console.log("=== Generating Mock Verify Request ===\n");

// Generate verify request
const verifyRequest = createMockVerifyRequest();
writeFileSync(
  join(outputDir, "verify-request.json"),
  JSON.stringify(verifyRequest, null, 2)
);

console.log("✓ Generated: generated-payloads/verify-request.json");
console.log("\nTo use with CRE workflow simulation:");
console.log("  cre workflow simulate ./d-verify --http-payload generated-payloads/verify-request.json");
console.log("\nNote: This is a MOCK payload with a dummy signature.");
console.log("For real signed payloads, use: bun run generate-payloads.ts");

