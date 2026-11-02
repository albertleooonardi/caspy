// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CaspyHeist} from "../src/CaspyHeist.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

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
        signer = makeAddr("signer");
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
        vm.expectRevert(CaspyHeist.BaseURIFrozen.selector);
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
        assertEq(contract_.tokenURI(1), string(abi.encodePacked(BASE_URI, "treat/1")));
    }
}
