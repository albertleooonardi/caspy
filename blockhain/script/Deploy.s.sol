// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
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
        emit log_named_address("CaspyHeist deployed at:", address(contract_));
        emit log_named_address("Owner (Deployer):", deployer);
        emit log_named_address("Signer:", signer);
        emit log_named_string("Name:", NAME);
        emit log_named_string("Symbol:", SYMBOL);
        emit log_named_uint("Treat Supply:", TREAT_SUPPLY);
        emit log_named_string("Base URI:", BASE_URI);
    }
}
