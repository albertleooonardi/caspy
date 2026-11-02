#!/usr/bin/env python3
"""
EIP-712 Voucher Signer for Caspy's Prompt Heist NFT Contract

This utility signs vouchers that authorize NFT minting. It uses EIP-712
structured data hashing to create cryptographically secure vouchers.
"""

import json
import sys
import argparse
from datetime import datetime, timedelta
from typing import Tuple, Dict
from eth_account import Account
from eth_account.messages import encode_typed_data
import os


class VoucherSigner:
    """Sign EIP-712 vouchers for Caspy's Prompt Heist NFT minting."""

    TIER_TREAT = 0
    TIER_TRICK = 1

    def __init__(
        self,
        private_key: str,
        contract_address: str,
        chain_id: int,
        domain_name: str = "Caspy's Treats",
        domain_version: str = "1",
    ):
        """Initialize voucher signer."""
        if not private_key.startswith("0x"):
            private_key = "0x" + private_key
        if not contract_address.startswith("0x"):
            contract_address = "0x" + contract_address

        if len(private_key) != 66:
            raise ValueError("Invalid private key format")

        self.account = Account.from_key(private_key)
        self.contract_address = contract_address.lower()
        self.chain_id = chain_id
        self.domain_name = domain_name
        self.domain_version = domain_version

        print(f"✓ Signer initialized: {self.account.address}")
        print(f"  Chain ID: {self.chain_id}")
        print(f"  Contract: {self.contract_address}")

    def create_voucher(
        self,
        to: str,
        tier: int,
        session_id: str,
        nonce: int,
        deadline: int,
    ) -> Dict:
        """Create a signed EIP-712 voucher."""
        if not to.startswith("0x"):
            to = "0x" + to
        if not session_id.startswith("0x"):
            session_id = "0x" + session_id

        to = to.lower()
        session_id = session_id.lower()

        if to.startswith("0x0x"):
            to = to[2:]
        if session_id.startswith("0x0x"):
            session_id = session_id[2:]

        if tier not in (self.TIER_TREAT, self.TIER_TRICK):
            raise ValueError(f"Invalid tier: {tier}")

        if len(session_id) != 66:
            raise ValueError("Session ID must be bytes32")

        message = {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"},
                ],
                "Voucher": [
                    {"name": "to", "type": "address"},
                    {"name": "tier", "type": "uint256"},
                    {"name": "sessionId", "type": "bytes32"},
                    {"name": "nonce", "type": "uint256"},
                    {"name": "deadline", "type": "uint256"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"},
                ],
            },
            "primaryType": "Voucher",
            "domain": {
                "name": self.domain_name,
                "version": self.domain_version,
                "chainId": self.chain_id,
                "verifyingContract": self.contract_address,
            },
            "message": {
                "to": to,
                "tier": tier,
                "sessionId": session_id,
                "nonce": nonce,
                "deadline": deadline,
                "chainId": self.chain_id,
                "verifyingContract": self.contract_address,
            },
        }

        encoded = encode_typed_data(full_message=message)
        signed_message = self.account.sign_message(encoded)

        return {
            "voucher": {
                "to": to,
                "tier": tier,
                "sessionId": session_id,
                "nonce": nonce,
                "deadline": deadline,
            },
            "signature": "0x" + signed_message.signature.hex(),
            "signer": self.account.address,
        }

    def verify_voucher(
        self, voucher_data: Dict, signature: str
    ) -> Tuple[bool, str]:
        """Verify a voucher signature."""
        try:
            if not signature.startswith("0x"):
                signature = "0x" + signature

            message_data = dict(voucher_data)
            if "chainId" not in message_data:
                message_data["chainId"] = self.chain_id
            if "verifyingContract" not in message_data:
                message_data["verifyingContract"] = self.contract_address

            message = {
                "types": {
                    "EIP712Domain": [
                        {"name": "name", "type": "string"},
                        {"name": "version", "type": "string"},
                        {"name": "chainId", "type": "uint256"},
                        {"name": "verifyingContract", "type": "address"},
                    ],
                    "Voucher": [
                        {"name": "to", "type": "address"},
                        {"name": "tier", "type": "uint256"},
                        {"name": "sessionId", "type": "bytes32"},
                        {"name": "nonce", "type": "uint256"},
                        {"name": "deadline", "type": "uint256"},
                        {"name": "chainId", "type": "uint256"},
                        {"name": "verifyingContract", "type": "address"},
                    ],
                },
                "primaryType": "Voucher",
                "domain": {
                    "name": self.domain_name,
                    "version": self.domain_version,
                    "chainId": self.chain_id,
                    "verifyingContract": self.contract_address,
                },
                "message": message_data,
            }

            encoded = encode_typed_data(full_message=message)
            recovered = Account.recover_message(encoded, signature=signature)

            is_valid = recovered.lower() == self.account.address.lower()
            return is_valid, recovered

        except Exception as e:
            return False, str(e)


def main():
    """CLI for creating vouchers."""
    parser = argparse.ArgumentParser(description="Sign EIP-712 vouchers for Caspy NFT minting")
    parser.add_argument("--private-key", required=True, help="Hex-encoded signer private key")
    parser.add_argument("--contract", required=True, help="Hex-encoded contract address")
    parser.add_argument("--chain-id", type=int, required=True, help="EVM chain ID")
    parser.add_argument("--recipient", required=True, help="Recipient wallet address")
    parser.add_argument("--tier", type=int, required=True, choices=[0, 1], help="0=Treat, 1=Trick")
    parser.add_argument("--session-id", required=True, help="Hex-encoded session ID")
    parser.add_argument("--nonce", type=int, default=1, help="Voucher nonce")
    parser.add_argument("--deadline-hours", type=int, default=24, help="Deadline in hours")
    parser.add_argument("--verify", action="store_true", help="Verify signature")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    try:
        signer = VoucherSigner(
            private_key=args.private_key,
            contract_address=args.contract,
            chain_id=args.chain_id,
        )

        deadline = int((datetime.now() + timedelta(hours=args.deadline_hours)).timestamp())

        print(f"\nCreating voucher...")
        print(f"  Recipient: {args.recipient}")
        print(f"  Tier: {'Treat' if args.tier == 0 else 'Trick'}")

        result = signer.create_voucher(
            to=args.recipient,
            tier=args.tier,
            session_id=args.session_id,
            nonce=args.nonce,
            deadline=deadline,
        )

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"\n✓ Voucher created!")
            print(f"  Signer: {result['signer']}")
            print(f"  Signature: {result['signature'][:20]}...")

        if args.verify:
            print(f"\nVerifying signature...")
            is_valid, recovered = signer.verify_voucher(result["voucher"], result["signature"])
            if is_valid:
                print(f"✓ Signature valid, recovered: {recovered}")
            else:
                print(f"✗ Signature invalid: {recovered}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
