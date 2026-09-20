import { expect, it } from "bun:test";

it("keeps portable workflow contracts and execution free of Promise runtimes", async () => {
  const contracts = await Bun.file(
    new URL("../index.ts", import.meta.url)
  ).text();
  const testingSource = await Bun.file(
    new URL("../../testing/index.ts", import.meta.url)
  ).text();
  const runtime = testingSource.slice(
    testingSource.indexOf("export const createInMemoryWorkflowMetadataStore")
  );

  expect(contracts).not.toMatch(/Promise\s*</);
  expect(runtime).not.toMatch(/Effect\.run(?:Promise|Sync|Fork)/);
  expect(runtime).not.toMatch(/Promise\.(?:resolve|reject)/);
  expect(contracts).not.toMatch(/from\s+["']cloudflare:/);
  expect(runtime).not.toMatch(/from\s+["']cloudflare:/);
});
