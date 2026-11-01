// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CaspyHeist} from "../src/CaspyHeist.sol";

contract CaspyHeistTest is Test {
    CaspyHeist public contract_;
    address public admin;
    address public signer;
    address public player;

    uint256 constant TREAT_SUPPLY = 1000;
    string constant BASE_URI = "ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/";

    function setUp() public {
        admin = makeAddr("admin");
        signer = makeAddr("signer");
        player = makeAddr("player");

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

    function test_Deploy_InitialState() public {
        assertEq(contract_.name(), "Caspy's Treats");
        assertEq(contract_.symbol(), "CASPY");
        assertEq(contract_.signer(), signer);
        assertEq(contract_.treatSupply(), TREAT_SUPPLY);
    }

    function test_Deploy_AdminHasRoles() public {
        assertTrue(contract_.hasRole(contract_.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(contract_.hasRole(contract_.ADMIN_ROLE(), admin));
        assertTrue(contract_.hasRole(contract_.PAUSER_ROLE(), admin));
    }

    function test_SetBaseURI() public {
        string memory newURI = "https://example.com/metadata/";
        vm.prank(admin);
        contract_.setBaseURI(newURI);
        assertEq(contract_.baseURI(), newURI);
    }

    function test_SetSigner() public {
        address newSigner = makeAddr("newSigner");
        vm.prank(admin);
        contract_.setSigner(newSigner);
        assertEq(contract_.signer(), newSigner);
    }

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
}
