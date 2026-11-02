import { parseAbi } from 'viem';

// Matches blockhain/src/CaspyHeist.sol. Also used by the server signing bridge.
export const caspyAbi = parseAbi([
  'function mintWithVoucher(address to, uint256 tier, bytes32 sessionId, uint256 nonce, uint256 deadline, bytes signature)',
  'function usedSessions(bytes32) view returns (bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function SIGNER_ROLE() view returns (bytes32)',
  'function name() view returns (string)',
  'function treatSupply() view returns (uint256)',
  'function treatMinted() view returns (uint256)',
  'function paused() view returns (bool)',
  'function ownerOf(uint256) view returns (address)',
  'function tokenTier(uint256) view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
  'event MintWithVoucher(address indexed to, uint256 indexed tokenId, uint256 indexed tier, bytes32 sessionId, uint256 nonce)',
]);

export const voucherTypes = {
  Voucher: [
    { name: 'to', type: 'address' }, { name: 'tier', type: 'uint256' },
    { name: 'sessionId', type: 'bytes32' }, { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }, { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
} as const;
