// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CaspyHeist} from "../src/CaspyHeist.sol";

/// @notice Deploy script for CaspyHeist contract
contract DeployScript is Script {
    // Configuration - update these for your deployment
    string constant NAME = "Caspy's Treats";
    string constant SYMBOL = "CASPY";
    uint256 constant TREAT_SUPPLY = 1000;
    string constant BASE_URI = "ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/";

    function run() public {
        // Get private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get signer address from environment or use deployer
        address signer = vm.envOr("SIGNER_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy CaspyHeist
        CaspyHeist contract_ = new CaspyHeist(
            NAME,
            SYMBOL,
            signer,
            BASE_URI,
            TREAT_SUPPLY
        );

        vm.stopBroadcast();

        // Print deployment info
        console2.log("CaspyHeist deployed at:", address(contract_));
        console2.log("Owner (Deployer):", deployer);
        console2.log("Signer:", signer);
        console2.log("Name:", NAME);
        console2.log("Symbol:", SYMBOL);
        console2.log("Treat Supply:", TREAT_SUPPLY);
        console2.log("Base URI:", BASE_URI);
    }
}
