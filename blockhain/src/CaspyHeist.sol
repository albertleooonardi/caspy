// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title CaspyHeist
/// @notice ERC-721 NFT contract for Caspy's Prompt Heist game
/// @dev Mints authorized by EIP-712 signed vouchers from backend signer
contract CaspyHeist is
    ERC721,
    ERC721Burnable,
    AccessControl,
    Pausable,
    EIP712,
    Ownable
{
    using ECDSA for bytes32;

    // Role identifiers
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // EIP-712 type hash for voucher
    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256(
            "Voucher(address to,uint256 tier,bytes32 sessionId,uint256 nonce,uint256 deadline,uint256 chainId,address verifyingContract)"
        );

    // Constants
    uint256 public constant TIER_TREAT = 0;
    uint256 public constant TIER_TRICK = 1;

    // State
    uint256 private _nextTokenId;
    uint256 public treatSupply;
    uint256 public treatMinted;
    uint256 public trickMinted;
    address public signer;
    string public baseURI;
    bool public baseURIFrozen;

    // Mappings
    mapping(bytes32 sessionId => bool minted) public usedSessions;
    mapping(uint256 tokenId => uint256 tier) public tokenTier;
    mapping(uint256 tokenId => bytes32 sessionId) public tokenSession;

    // Events
    event MintWithVoucher(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed tier,
        bytes32 sessionId,
        uint256 nonce
    );

    event BaseURIUpdated(string newURI);
    event BaseURIFrozen();
    event SignerUpdated(address indexed newSigner);
    event TreatSupplyUpdated(uint256 newSupply);

    // Custom errors
    error InvalidSignature();
    error ExpiredVoucher();
    error SessionAlreadyMinted();
    error TreatSupplyExhausted();
    error UnauthorizedRecipient();
    error InvalidTier();
    error BaseURIFrozen();
    error InvalidSigner();

    /// @notice Initialize the contract
    /// @param _name Token name
    /// @param _symbol Token symbol
    /// @param _initialSigner Address with SIGNER_ROLE
    /// @param _initialBaseURI Base metadata URI
    /// @param _initialTreatSupply Total Treat NFTs available
    constructor(
        string memory _name,
        string memory _symbol,
        address _initialSigner,
        string memory _initialBaseURI,
        uint256 _initialTreatSupply
    ) ERC721(_name, _symbol) EIP712(_name, "1") {
        if (_initialSigner == address(0)) revert InvalidSigner();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SIGNER_ROLE, _initialSigner);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        signer = _initialSigner;
        baseURI = _initialBaseURI;
        treatSupply = _initialTreatSupply;
        _nextTokenId = 1;
    }

    /// @notice Mint NFT with EIP-712 signed voucher
    /// @param to Recipient address
    /// @param tier TIER_TREAT (0) or TIER_TRICK (1)
    /// @param sessionId Unique session identifier
    /// @param nonce Voucher nonce for replay protection
    /// @param deadline Block timestamp deadline
    /// @param signature EIP-712 signature from signer
    function mintWithVoucher(
        address to,
        uint256 tier,
        bytes32 sessionId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) public whenNotPaused {
        // Validate tier
        if (tier != TIER_TREAT && tier != TIER_TRICK) revert InvalidTier();

        // Validate deadline
        if (block.timestamp > deadline) revert ExpiredVoucher();

        // Validate recipient (must be msg.sender unless relayer pattern)
        if (to != msg.sender && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedRecipient();
        }

        // Check if session already minted
        if (usedSessions[sessionId]) revert SessionAlreadyMinted();

        // Check Treat supply before minting
        if (tier == TIER_TREAT && treatMinted >= treatSupply) {
            revert TreatSupplyExhausted();
        }

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                to,
                tier,
                sessionId,
                nonce,
                deadline,
                block.chainid,
                address(this)
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = digest.recover(signature);

        if (!hasRole(SIGNER_ROLE, recoveredSigner)) revert InvalidSignature();

        // Mark session as minted
        usedSessions[sessionId] = true;

        // Mint token
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        // Store tier and session info
        tokenTier[tokenId] = tier;
        tokenSession[tokenId] = sessionId;

        // Update supply counters
        if (tier == TIER_TREAT) {
            treatMinted++;
        } else {
            trickMinted++;
        }

        emit MintWithVoucher(to, tokenId, tier, sessionId, nonce);
    }

    /// @notice Mint NFT with signature and optional relayer pattern
    /// @param to Recipient address
    /// @param tier TIER_TREAT (0) or TIER_TRICK (1)
    /// @param sessionId Unique session identifier
    /// @param nonce Voucher nonce for replay protection
    /// @param deadline Block timestamp deadline
    /// @param signature EIP-712 signature from signer
    function mintWithVoucherRelayer(
        address to,
        uint256 tier,
        bytes32 sessionId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        // Allow relayer to submit for recipient
        mintWithVoucher(to, tier, sessionId, nonce, deadline, signature);
    }

    /// @notice Update base URI (if not frozen)
    /// @param newBaseURI New metadata base URI
    function setBaseURI(string memory newBaseURI)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (baseURIFrozen) revert BaseURIFrozen();
        baseURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Permanently freeze base URI
    function freezeBaseURI() external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURIFrozen = true;
        emit BaseURIFrozen();
    }

    /// @notice Update the signer role
    /// @param newSigner New signer address
    function setSigner(address newSigner)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newSigner == address(0)) revert InvalidSigner();
        _revokeRole(SIGNER_ROLE, signer);
        _grantRole(SIGNER_ROLE, newSigner);
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    /// @notice Update Treat supply cap
    /// @param newSupply New supply limit
    function setTreatSupply(uint256 newSupply)
        external
        onlyRole(ADMIN_ROLE)
    {
        treatSupply = newSupply;
        emit TreatSupplyUpdated(newSupply);
    }

    /// @notice Pause minting
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpause minting
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Get token URI
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "Token does not exist");

        if (bytes(baseURI).length == 0) {
            return "";
        }

        uint256 tier = tokenTier[tokenId];
        string memory tierStr = tier == TIER_TREAT ? "treat" : "trick";

        return
            string(
                abi.encodePacked(baseURI, tierStr, "/", _uint2str(tokenId))
            );
    }

    /// @notice Check if token exists (internal utility)
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /// @notice Convert uint to string
    function _uint2str(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    // Required overrides for AccessControl and ERC721
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}
