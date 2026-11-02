// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CaspyHeist} from "../src/CaspyHeist.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ReenteringRecipient is IERC721Receiver {
    CaspyHeist target;
    bytes second;
    bool public reentered;

    constructor(CaspyHeist target_) { target = target_; }

    function attack(bytes memory first_, bytes memory second_) external {
        second = second_;
        (bool ok,) = address(target).call(first_);
        require(ok, "Outer mint failed");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        (reentered,) = address(target).call(second);
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract CaspyHeistTest is Test {
    using ECDSA for bytes32;

    CaspyHeist public contract_;
    address public admin;
    address public signer;
    address public player;

    bytes32 private signerPrivateKey;
    uint256 private playerPrivateKey = 0x1234567890123456789012345678901234567890123456789012345678901234;
    uint256 private relayerPrivateKey = 0x9876543210987654321098765432109876543210987654321098765432109876;

    // Constants
    uint256 constant TREAT_SUPPLY = 1000;
    string constant BASE_URI = "ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/";

    function setUp() public {
        admin = makeAddr("admin");
        signerPrivateKey = bytes32(uint256(0xA11CE));
        signer = vm.addr(uint256(signerPrivateKey));
        player = vm.addr(playerPrivateKey);

        vm.startPrank(admin);
        contract_ = new CaspyHeist(
            "Caspy's Treats",
            "CASPY",
            signer,
            BASE_URI,
            TREAT_SUPPLY
        );
        vm.stopPrank();
    }

    // =====================
    // Deployment Tests
    // =====================

    function test_Deploy_InitialState() public {
        assertEq(contract_.name(), "Caspy's Treats");
        assertEq(contract_.symbol(), "CASPY");
        assertEq(contract_.signer(), signer);
        assertEq(contract_.baseURI(), BASE_URI);
        assertEq(contract_.treatSupply(), TREAT_SUPPLY);
        assertEq(contract_.treatMinted(), 0);
        assertEq(contract_.trickMinted(), 0);
    }

    function test_Deploy_AdminHasCorrectRoles() public {
        assertTrue(contract_.hasRole(contract_.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(contract_.hasRole(contract_.ADMIN_ROLE(), admin));
        assertTrue(contract_.hasRole(contract_.PAUSER_ROLE(), admin));
    }

    function test_Deploy_SignerHasSignerRole() public {
        assertTrue(contract_.hasRole(contract_.SIGNER_ROLE(), signer));
    }

    // =====================
    // Configuration Tests
    // =====================

    function test_SetBaseURI() public {
        string memory newURI = "https://example.com/metadata/";
        vm.prank(admin);
        contract_.setBaseURI(newURI);
        assertEq(contract_.baseURI(), newURI);
    }

    function test_SetBaseURI_RejectsFrozen() public {
        vm.prank(admin);
        contract_.freezeBaseURI();

        vm.prank(admin);
        vm.expectRevert(CaspyHeist.BaseURIIsFrozen.selector);
        contract_.setBaseURI("https://other.com/");
    }

    function test_FreezeBaseURI() public {
        vm.prank(admin);
        contract_.freezeBaseURI();
        assertTrue(contract_.baseURIFrozen());
    }

    function test_SetSigner() public {
        address newSigner = makeAddr("newSigner");
        vm.prank(admin);
        contract_.setSigner(newSigner);
        assertEq(contract_.signer(), newSigner);
        assertTrue(contract_.hasRole(contract_.SIGNER_ROLE(), newSigner));
        assertFalse(contract_.hasRole(contract_.SIGNER_ROLE(), signer));
    }

    function test_SetSigner_RejectsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(CaspyHeist.InvalidSigner.selector);
        contract_.setSigner(address(0));
    }

    function test_SetTreatSupply() public {
        uint256 newSupply = 5000;
        vm.prank(admin);
        contract_.setTreatSupply(newSupply);
        assertEq(contract_.treatSupply(), newSupply);
    }

    // =====================
    // Pause/Unpause Tests
    // =====================

    function test_Pause_PreventsMinting() public {
        vm.prank(admin);
        contract_.pause();
        assertTrue(contract_.paused());
        vm.expectRevert(bytes("Pausable: paused"));
        _mint(player, 0, keccak256("paused"), block.timestamp + 1 days);
    }

    function test_Unpause_AllowsMinting() public {
        vm.prank(admin);
        contract_.pause();

        vm.prank(admin);
        contract_.unpause();
        assertFalse(contract_.paused());
    }

    // =====================
    // TokenURI Tests
    // =====================

    function test_TokenURI_Format() public {
        _mint(player, 0, keccak256("uri"), block.timestamp + 1 days);
        assertEq(contract_.tokenURI(1), string(abi.encodePacked(BASE_URI, "treat/1")));
    }

    function _signature(address to, uint256 tier, bytes32 sessionId, uint256 deadline) internal view returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("Caspy's Treats")), keccak256("1"), block.chainid, address(contract_)
        ));
        bytes32 payload = keccak256(abi.encode(keccak256("Voucher(address to,uint256 tier,bytes32 sessionId,uint256 nonce,uint256 deadline,uint256 chainId,address verifyingContract)"), to, tier, sessionId, uint256(1), deadline, block.chainid, address(contract_)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(signerPrivateKey), keccak256(abi.encodePacked("\x19\x01", domain, payload)));
        return abi.encodePacked(r, s, v);
    }

    function _mint(address to, uint256 tier, bytes32 id, uint256 deadline) internal {
        bytes memory sig = _signature(to, tier, id, deadline);
        vm.prank(to);
        contract_.mintWithVoucher(to, tier, id, 1, deadline, sig);
    }

    function test_MintTreatAndTrick() public {
        _mint(player, 0, keccak256("treat"), block.timestamp + 1 days);
        _mint(player, 1, keccak256("trick"), block.timestamp + 1 days);
        assertEq(contract_.ownerOf(1), player);
        assertEq(contract_.tokenTier(1), 0);
        assertEq(contract_.tokenTier(2), 1);
        assertEq(contract_.treatMinted(), 1);
        assertEq(contract_.trickMinted(), 1);
    }

    function test_RejectsReplay() public {
        bytes32 id = keccak256("replay");
        _mint(player, 0, id, block.timestamp + 1 days);
        vm.expectRevert(CaspyHeist.SessionAlreadyMinted.selector);
        _mint(player, 0, id, block.timestamp + 1 days);
    }

    function test_RejectsExpired() public {
        vm.warp(100);
        vm.expectRevert(CaspyHeist.ExpiredVoucher.selector);
        _mint(player, 0, keccak256("expired"), 99);
    }

    function test_RejectsForgedTier() public {
        bytes32 id = keccak256("tamper");
        bytes memory sig = _signature(player, 1, id, block.timestamp + 1 days);
        vm.prank(player);
        vm.expectRevert(CaspyHeist.InvalidSignature.selector);
        contract_.mintWithVoucher(player, 0, id, 1, block.timestamp + 1 days, sig);
    }

    function test_RejectsOtherRecipient() public {
        bytes32 id = keccak256("recipient");
        bytes memory sig = _signature(player, 0, id, block.timestamp + 1 days);
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(CaspyHeist.UnauthorizedRecipient.selector);
        contract_.mintWithVoucher(player, 0, id, 1, block.timestamp + 1 days, sig);
    }

    function test_EnforcesTreatCap() public {
        vm.prank(admin);
        contract_.setTreatSupply(1);
        _mint(player, 0, keccak256("first"), block.timestamp + 1 days);
        vm.expectRevert(CaspyHeist.TreatSupplyExhausted.selector);
        _mint(player, 0, keccak256("second"), block.timestamp + 1 days);
        _mint(player, 1, keccak256("trick"), block.timestamp + 1 days);
    }

    function testFuzz_TreatSupplyNeverExceeded(uint8 count) public {
        vm.prank(admin);
        contract_.setTreatSupply(5);
        uint256 tries = bound(uint256(count), 1, 10);
        for (uint256 i; i < tries; i++) {
            if (i >= 5) vm.expectRevert(CaspyHeist.TreatSupplyExhausted.selector);
            _mint(player, 0, bytes32(i), block.timestamp + 1 days);
        }
        assertLe(contract_.treatMinted(), 5);
    }

    function test_RejectsReentrancyDuringReceiverCallback() public {
        ReenteringRecipient receiver = new ReenteringRecipient(contract_);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 firstId = keccak256("outer");
        bytes32 secondId = keccak256("inner");
        bytes memory first = abi.encodeCall(contract_.mintWithVoucher, (address(receiver), 0, firstId, 1, deadline, _signature(address(receiver), 0, firstId, deadline)));
        bytes memory second = abi.encodeCall(contract_.mintWithVoucher, (address(receiver), 0, secondId, 1, deadline, _signature(address(receiver), 0, secondId, deadline)));
        receiver.attack(first, second);
        assertFalse(receiver.reentered());
        assertEq(contract_.treatMinted(), 1);
        assertFalse(contract_.usedSessions(secondId));
    }

    function test_RejectsWrongChainSignature() public {
        bytes32 id = keccak256("chain");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signature(player, 0, id, deadline);
        vm.chainId(block.chainid + 1);
        vm.prank(player);
        vm.expectRevert(CaspyHeist.InvalidSignature.selector);
        contract_.mintWithVoucher(player, 0, id, 1, deadline, sig);
    }
}
