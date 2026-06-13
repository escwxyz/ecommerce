import { describe, expect, it } from "bun:test";

import Stack, {
  database,
  server,
  statefulCoordinator,
  web,
} from "./alchemy.run";

describe("alchemy stack exports", () => {
  it("defines the stack and deployable resources without executing deploy", () => {
    expect(Stack).toBeDefined();
    expect(database).toBeDefined();
    expect(server).toBeDefined();
    expect(statefulCoordinator).toBeDefined();
    expect(web).toBeDefined();
  });
});
