import { describe, expect, it } from "bun:test";
import { toComputerSummary } from "../../src/env/computers.js";
import type { Computer } from "@letta-ai/letta-agent-sdk/client";

const computer = (extra: Partial<Computer> = {}): Computer =>
  ({
    id: "e1",
    deviceId: "dev-1",
    connectionId: "conn-1",
    name: "MacBook",
    status: "online",
    connectedAt: 1,
    lastSeenAt: 2,
    ...extra,
  }) as Computer;

describe("toComputerSummary", () => {
  it("projects the SDK record to the Android summary shape", () => {
    expect(toComputerSummary(computer())).toEqual({
      deviceId: "dev-1",
      name: "MacBook",
      connectionId: "conn-1",
      status: "online",
    });
  });

  it("keeps a null connection lease when the device is offline", () => {
    expect(
      toComputerSummary(computer({ connectionId: null, status: "offline" })),
    ).toMatchObject({ connectionId: null, status: "offline" });
  });
});
