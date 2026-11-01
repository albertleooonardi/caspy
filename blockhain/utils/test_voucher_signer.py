#!/usr/bin/env python3
"""Unit tests for EIP-712 Voucher Signer"""

import pytest
from datetime import datetime, timedelta
from voucher_signer import VoucherSigner
from eth_account.messages import encode_typed_data


PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb476cad3623065be2f4ac1e9c84d"
CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
CHAIN_ID = 8453
RECIPIENT = "0xabababababababababababababababababababab"
SESSION_ID = "0x0000000000000000000000000000000000000000000000000000000000000001"


class TestVoucherSigner:
    """Test voucher signing functionality."""

    @pytest.fixture
    def signer(self):
        """Create a voucher signer instance."""
        return VoucherSigner(
            private_key=PRIVATE_KEY,
            contract_address=CONTRACT_ADDRESS,
            chain_id=CHAIN_ID,
        )

    def test_init_with_valid_key(self):
        """Test initialization with valid private key."""
        signer = VoucherSigner(
            private_key=PRIVATE_KEY,
            contract_address=CONTRACT_ADDRESS,
            chain_id=CHAIN_ID,
        )
        assert signer.contract_address == CONTRACT_ADDRESS.lower()
        assert signer.chain_id == CHAIN_ID

    def test_create_voucher_treat(self, signer):
        """Test creating a Treat voucher."""
        deadline = int((datetime.now() + timedelta(hours=24)).timestamp())

        result = signer.create_voucher(
            to=RECIPIENT,
            tier=0,
            session_id=SESSION_ID,
            nonce=1,
            deadline=deadline,
        )

        assert "voucher" in result
        assert "signature" in result
        assert result["voucher"]["to"] == RECIPIENT.lower()
        assert result["voucher"]["tier"] == 0
        assert result["signature"].startswith("0x")

    def test_create_voucher_trick(self, signer):
        """Test creating a Trick voucher."""
        deadline = int((datetime.now() + timedelta(hours=24)).timestamp())

        result = signer.create_voucher(
            to=RECIPIENT,
            tier=1,
            session_id=SESSION_ID,
            nonce=1,
            deadline=deadline,
        )

        assert result["voucher"]["tier"] == 1

    def test_verify_valid_voucher(self, signer):
        """Test verifying a valid voucher."""
        deadline = int((datetime.now() + timedelta(hours=24)).timestamp())

        result = signer.create_voucher(
            to=RECIPIENT,
            tier=0,
            session_id=SESSION_ID,
            nonce=1,
            deadline=deadline,
        )

        is_valid, recovered = signer.verify_voucher(result["voucher"], result["signature"])
        assert is_valid is True
        assert recovered.lower() == signer.account.address.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
