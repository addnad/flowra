export const DRIPLY_ABI = [
  {
    name: "createStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver",      type: "address" },
      { name: "token",         type: "address" },
      { name: "totalAmount",   type: "uint256" },
      { name: "duration",      type: "uint256" },
      { name: "interval",      type: "uint256" },
      { name: "conditionType", type: "uint8"   },
      { name: "conditionData", type: "bytes"   },
    ],
    outputs: [{ name: "streamId", type: "uint256" }],
  },
  {
    name: "claimFunds",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "streamId",  type: "uint256" },
      { name: "signature", type: "bytes"   },
    ],
    outputs: [],
  },
  {
    name: "pauseStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "resumeStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimableAmount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getStream",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sender",          type: "address" },
          { name: "receiver",        type: "address" },
          { name: "token",           type: "address" },
          { name: "totalAmount",     type: "uint256" },
          { name: "startTime",       type: "uint256" },
          { name: "endTime",         type: "uint256" },
          { name: "interval",        type: "uint256" },
          { name: "amountClaimed",   type: "uint256" },
          { name: "pausedAt",        type: "uint256" },
          { name: "totalPausedTime", type: "uint256" },
          { name: "status",          type: "uint8"   },
          { name: "conditionType",   type: "uint8"   },
          { name: "conditionData",   type: "bytes"   },
        ],
      },
    ],
  },
  {
    name: "nextStreamId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "emergencyUnlock",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "streamId",   type: "uint256" },
      { name: "percentage", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "EmergencyUnlocked",
    type: "event",
    inputs: [
      { name: "streamId",   type: "uint256", indexed: true  },
      { name: "amount",     type: "uint256", indexed: false },
      { name: "percentage", type: "uint256", indexed: false },
    ],
  },
  {
    name: "StreamCreated",
    type: "event",
    inputs: [
      { name: "streamId",      type: "uint256", indexed: true  },
      { name: "sender",        type: "address", indexed: true  },
      { name: "receiver",      type: "address", indexed: true  },
      { name: "totalAmount",   type: "uint256", indexed: false },
      { name: "startTime",     type: "uint256", indexed: false },
      { name: "endTime",       type: "uint256", indexed: false },
      { name: "conditionType", type: "uint8",   indexed: false },
    ],
  },
  {
    name: "FundsClaimed",
    type: "event",
    inputs: [
      { name: "streamId", type: "uint256", indexed: true  },
      { name: "receiver", type: "address", indexed: true  },
      { name: "amount",   type: "uint256", indexed: false },
    ],
  },
  {
    name: "StreamPaused",
    type: "event",
    inputs: [{ name: "streamId", type: "uint256", indexed: true }],
  },
  {
    name: "StreamResumed",
    type: "event",
    inputs: [{ name: "streamId", type: "uint256", indexed: true }],
  },
  {
    name: "StreamCancelled",
    type: "event",
    inputs: [
      { name: "streamId",       type: "uint256", indexed: true  },
      { name: "refundToSender", type: "uint256", indexed: false },
      { name: "keptByReceiver", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
