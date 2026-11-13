import { describe, expect, it, vi } from "vitest";
import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { escrowAbi, zarpAbi } from "./contracts";
import {
  CONTRACT_ERROR_MESSAGES,
  contractErrorMessage,
  createAndFundOrder,
  ensureBaseSepolia,
  getTestZarp,
  readBalances,
  signWalletLink,
  splitTotal,
  type ChainClients,
} from "./chain";

const ESCROW = "0xE5c0000000000000000000000000000000000001" as Address;
const ZARP = "0x2a40000000000000000000000000000000000002" as Address;
const BUYER = "0xb0b0000000000000000000000000000000000003" as Address;
const SUPPLIER = "0x5050000000000000000000000000000000000004" as Address;
const HASH = ("0x" + "11".repeat(32)) as Hex;

function orderCreatedLog(orderId: bigint, address: Address = ESCROW) {
  const topics = encodeEventTopics({
    abi: escrowAbi,
    eventName: "OrderCreated",
    args: { orderId, buyer: BUYER, supplier: SUPPLIER },
  });
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes32" }],
    [parseUnits("100", 18), HASH],
  );
  return { address, topics, data, blockNumber: 1n, transactionHash: "0xc1" as Hex, logIndex: 0, blockHash: "0x01" as Hex, transactionIndex: 0, removed: false };
}

/** Fake viem clients that record every simulate / write / wait in order. */
function fakeClients(opts: { logs?: unknown[]; revertOn?: string; status?: "success" | "reverted" } = {}) {
  const log: string[] = [];
  let n = 0;
  const publicClient = {
    simulateContract: vi.fn(async (args: { functionName: string; args: unknown[] }) => {
      log.push(`simulate:${args.functionName}`);
      if (opts.revertOn === args.functionName) {
        const data = encodeErrorResult({ abi: escrowAbi, errorName: "SplitMismatch" });
        const cause = new ContractFunctionRevertedError({ abi: escrowAbi, data, functionName: args.functionName });
        throw new ContractFunctionExecutionError(cause as unknown as BaseError, {
          abi: escrowAbi, functionName: args.functionName, args: args.args,
        });
      }
      return { request: { ...args, simulated: true } };
    }),
    waitForTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      log.push(`wait:${hash}`);
      return { status: opts.status ?? "success", transactionHash: hash, logs: hash === "0xtx1" ? (opts.logs ?? [orderCreatedLog(7n)]) : [] };
    }),
    readContract: vi.fn(async ({ args }: { args: [Address] }) => {
      log.push(`read:${args[0]}`);
      return BigInt(args[0].slice(-1));
    }),
  };
  const walletClient = {
    writeContract: vi.fn(async (req: { functionName: string; simulated?: boolean }) => {
      log.push(`write:${req.functionName}${req.simulated ? "" : ":UNSIMULATED"}`);
      n += 1;
      return `0xtx${n}` as Hex;
    }),
  };
  const clients = { publicClient, walletClient, account: BUYER, escrow: ESCROW, zarp: ZARP } as unknown as ChainClients;
  return { clients, log, publicClient, walletClient };
}

const params = {
  supplier: SUPPLIER,
  total: parseUnits("100", 18),
  ...splitTotal(parseUnits("100", 18)),
  refundDeadline: 1_900_000_000n,
  agreementHash: HASH,
};

describe("splitTotal", () => {
  it("Given a total, When split 10/40/50, Then shares sum exactly to the total", () => {
    const total = 1001n; // not divisible: rounding must land in the delivery share
    const s = splitTotal(total);
    expect(s.driverAtPickup).toBe(100n);
    expect(s.supplierAtPickup).toBe(400n);
    expect(s.driverAtPickup + s.supplierAtPickup + s.supplierAtDelivery).toBe(total);
  });
});

describe("createAndFundOrder", () => {
  it("Given a buyer, When creating and funding, Then it runs createOrder → approve → fundEscrow, each simulated and mined in order", async () => {
    const { clients, log } = fakeClients();
    await createAndFundOrder(clients, params);
    expect(log).toEqual([
      "simulate:createOrder", "write:createOrder", "wait:0xtx1",
      "simulate:approve", "write:approve", "wait:0xtx2",
      "simulate:fundEscrow", "write:fundEscrow", "wait:0xtx3",
    ]);
  });

  it("Given the OrderCreated log, When creating, Then the on-chain orderId and all tx hashes are returned", async () => {
    const { clients } = fakeClients({ logs: [orderCreatedLog(99n, "0x0000000000000000000000000000000000000bad"), orderCreatedLog(42n)] });
    const result = await createAndFundOrder(clients, params);
    expect(result).toEqual({ orderId: 42n, createTxHash: "0xtx1", approveTxHash: "0xtx2", fundTxHash: "0xtx3" });
  });

  it("Given the escrow and token, When approving and funding, Then approve targets ZARP for the total and fund uses the orderId", async () => {
    const { clients, publicClient } = fakeClients({ logs: [orderCreatedLog(5n)] });
    await createAndFundOrder(clients, params);
    const [create, approve, fund] = publicClient.simulateContract.mock.calls.map((c) => c[0] as unknown as Record<string, unknown>);
    expect(create.address).toBe(ESCROW);
    expect(create.args).toEqual([SUPPLIER, params.total, params.driverAtPickup, params.supplierAtPickup, params.supplierAtDelivery, 1_900_000_000n, HASH]);
    expect(approve.address).toBe(ZARP);
    expect(approve.args).toEqual([ESCROW, params.total]);
    expect(fund.address).toBe(ESCROW);
    expect(fund.args).toEqual([5n]);
    expect(create.account).toBe(BUYER);
  });

  it("Given a step callback, When each tx is mined, Then it reports created (with ids), approved and funded", async () => {
    const { clients } = fakeClients();
    const steps: unknown[] = [];
    await createAndFundOrder(clients, params, (s) => steps.push(s));
    expect(steps).toEqual([
      { step: "created", orderId: 7n, txHash: "0xtx1" },
      { step: "approved", txHash: "0xtx2" },
      { step: "funded", txHash: "0xtx3" },
    ]);
  });

  it("Given an existing on-chain order, When retrying, Then it skips createOrder and only approves and funds", async () => {
    const { clients, log } = fakeClients();
    const result = await createAndFundOrder(clients, { ...params, existingOrderId: 7n });
    expect(log.filter((l) => l.startsWith("write"))).toEqual(["write:approve", "write:fundEscrow"]);
    expect(result.orderId).toBe(7n);
  });

  it("Given a receipt with no OrderCreated log, When creating, Then it throws", async () => {
    const { clients } = fakeClients({ logs: [] });
    await expect(createAndFundOrder(clients, params)).rejects.toThrow(/OrderCreated/);
  });

  it("Given a reverted receipt, When creating, Then it throws and does not approve", async () => {
    const { clients, log } = fakeClients({ status: "reverted" });
    await expect(createAndFundOrder(clients, params)).rejects.toThrow(/reverted/i);
    expect(log).not.toContain("write:approve");
  });

  it("Given the contract reverts SplitMismatch in simulation, When creating, Then the error maps to its name and nothing is sent", async () => {
    const { clients, log } = fakeClients({ revertOn: "createOrder" });
    const err = await createAndFundOrder(clients, params).catch((e: unknown) => e);
    expect(contractErrorMessage(err)).toBe(CONTRACT_ERROR_MESSAGES.SplitMismatch);
    expect(contractErrorMessage(err)).toContain("SplitMismatch");
    expect(log.some((l) => l.startsWith("write"))).toBe(false);
  });
});

describe("contractErrorMessage", () => {
  it("Given every custom error in the escrow ABI, Then each has a message (drift guard)", () => {
    const names = escrowAbi.filter((x) => x.type === "error").map((x) => (x as { name: string }).name);
    for (const name of names) expect(CONTRACT_ERROR_MESSAGES[name], name).toBeTruthy();
  });

  it("Given the user rejects in MetaMask, Then it says cancelled", () => {
    const err = new UserRejectedRequestError(new Error("User denied"));
    expect(contractErrorMessage(err)).toMatch(/cancelled in MetaMask/i);
    expect(contractErrorMessage({ code: 4001, message: "nope" })).toMatch(/cancelled in MetaMask/i);
  });

  it("Given an unknown error, Then it returns its short message", () => {
    expect(contractErrorMessage(new Error("boom"))).toBe("boom");
  });
});

describe("getTestZarp", () => {
  it("Given a buyer, When minting, Then MockZARP.mint(buyer, 1000 ZARP) is simulated, sent and mined", async () => {
    const { clients, log, publicClient } = fakeClients();
    const hash = await getTestZarp(clients);
    expect(log).toEqual(["simulate:mint", "write:mint", "wait:0xtx1"]);
    const call = publicClient.simulateContract.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(call.address).toBe(ZARP);
    expect(call.abi).toBe(zarpAbi);
    expect(call.args).toEqual([BUYER, parseUnits("1000", 18)]);
    expect(hash).toBe("0xtx1");
  });
});

describe("readBalances", () => {
  it("Given some known and some missing addresses, When reading, Then known ones get ZARP balances and missing ones are null", async () => {
    const { clients, publicClient } = fakeClients();
    const out = await readBalances(clients.publicClient, {
      buyer: BUYER, supplier: SUPPLIER, driver: undefined, escrow: ESCROW,
    }, ZARP);
    expect(out).toEqual({ buyer: 3n, supplier: 4n, driver: null, escrow: 1n });
    expect(publicClient.readContract).toHaveBeenCalledTimes(3);
    const call = publicClient.readContract.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(call.functionName).toBe("balanceOf");
    expect(call.address).toBe(ZARP);
  });
});

describe("ensureBaseSepolia", () => {
  it("Given MetaMask lacks Base Sepolia (4902), When switching, Then it adds the chain", async () => {
    const calls: string[] = [];
    const eth = {
      request: vi.fn(async ({ method }: { method: string }) => {
        calls.push(method);
        if (method === "wallet_switchEthereumChain") throw Object.assign(new Error("unknown chain"), { code: 4902 });
        return null;
      }),
    };
    await ensureBaseSepolia(eth);
    expect(calls).toEqual(["wallet_switchEthereumChain", "wallet_addEthereumChain"]);
    const addParams = (eth.request.mock.calls[1][0] as { params: [{ chainId: string }] }).params[0];
    expect(addParams.chainId).toBe("0x14a34");
  });

  it("Given the user rejects the switch, Then it throws", async () => {
    const eth = { request: vi.fn(async () => { throw Object.assign(new Error("rejected"), { code: 4001 }); }) };
    await expect(ensureBaseSepolia(eth)).rejects.toThrow();
  });
});

describe("signWalletLink", () => {
  it("Given a backend challenge with string expiresAt, When signing, Then expiresAt is a bigint and types pass through", async () => {
    const signTypedData = vi.fn(async () => "0xsig" as Hex);
    const typedData = {
      domain: { name: "Patela Wallet Link", version: "1", chainId: 84532 },
      types: { WalletLink: [{ name: "userId", type: "string" }, { name: "wallet", type: "address" }, { name: "nonce", type: "bytes32" }, { name: "expiresAt", type: "uint256" }] },
      primaryType: "WalletLink",
      message: { userId: "u", wallet: BUYER, nonce: HASH, expiresAt: "1900000000" },
    };
    const sig = await signWalletLink({ signTypedData } as never, BUYER, typedData);
    expect(sig).toBe("0xsig");
    const arg = (signTypedData.mock.calls[0] as unknown as [Record<string, { expiresAt?: unknown }>])[0];
    expect(arg.message.expiresAt).toBe(1_900_000_000n);
    expect(arg.account).toBe(BUYER);
    expect(arg.primaryType).toBe("WalletLink");
  });
});
