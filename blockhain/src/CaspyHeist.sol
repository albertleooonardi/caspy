// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Finite, win-only candy collection. Grade, score and content commitments
/// are signed by the server; no random rarity and no consolation mint function.
contract CaspyHeist is ERC721, AccessControl, Pausable, ReentrancyGuard, EIP712 {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant VERSION = 2;
    bytes32 public constant CANDY_TYPEHASH = keccak256("CandyVoucher(address to,uint8 grade,uint16 score,bytes32 sessionId,bytes32 promptHash,bytes32 imageHash,bytes32 metadataHash,bytes32 uriHash,uint256 nonce,uint256 deadline)");
    struct CandyVoucher {
        address to; uint8 grade; uint16 score; bytes32 sessionId;
        bytes32 promptHash; bytes32 imageHash; bytes32 metadataHash; bytes32 uriHash;
        uint256 nonce; uint256 deadline;
    }
    uint256 public immutable maxSupply;
    uint256 public totalMinted;
    address public signer;
    mapping(bytes32 => bool) public usedSessions;
    mapping(address => bool) public mintedWallet;
    mapping(uint256 => uint8) public tokenGrade;
    mapping(uint256 => uint16) public tokenScore;
    mapping(uint256 => bytes32) public tokenPromptHash;
    mapping(uint256 => bytes32) public tokenImageHash;
    mapping(uint256 => bytes32) public tokenMetadataHash;
    mapping(uint256 => bytes32) public tokenSession;
    mapping(uint256 => address) public creatorOf;
    mapping(uint256 => string) private uris;
    mapping(uint256 => string) public promptLicense;
    event CandyMinted(address indexed to,uint256 indexed tokenId,bytes32 indexed sessionId,uint8 grade,uint16 score,bytes32 promptHash,bytes32 imageHash,bytes32 metadataHash);
    event PromptLicensed(uint256 indexed tokenId,string terms);
    error InvalidVoucher(); error InvalidSignature(); error ExpiredVoucher();
    error SessionAlreadyMinted(); error WalletAlreadyMinted(); error SupplyExhausted();
    error UnauthorizedRecipient(); error LicenseAlreadySet();

    // Kept constructor-compatible with the deployment scaffold; URI is committed per token.
    constructor(string memory name_,string memory symbol_,address signer_,string memory,uint256 supply_)
        ERC721(name_,symbol_) EIP712(name_,"2") {
        require(signer_!=address(0) && supply_>0,"Invalid configuration");
        signer=signer_; maxSupply=supply_;
        _grantRole(DEFAULT_ADMIN_ROLE,msg.sender); _grantRole(PAUSER_ROLE,msg.sender); _grantRole(SIGNER_ROLE,signer_);
    }
    function gradeForScore(uint16 score) public pure returns(uint8) {
        if(score>100) revert InvalidVoucher();
        return score>=90 ? 4 : score>=75 ? 3 : score>=60 ? 2 : 1;
    }
    function mintCandy(CandyVoucher calldata v,string calldata uri,bytes calldata signature) external whenNotPaused nonReentrant {
        if(v.to!=msg.sender) revert UnauthorizedRecipient();
        if(v.deadline<block.timestamp) revert ExpiredVoucher();
        if(usedSessions[v.sessionId]) revert SessionAlreadyMinted();
        if(mintedWallet[v.to]) revert WalletAlreadyMinted();
        if(totalMinted>=maxSupply) revert SupplyExhausted();
        if(v.grade!=gradeForScore(v.score) || v.promptHash==0 || v.imageHash==0 || v.metadataHash==0 || bytes(uri).length==0 || keccak256(bytes(uri))!=v.uriHash) revert InvalidVoucher();
        bytes32 payload=keccak256(abi.encode(CANDY_TYPEHASH,v.to,v.grade,v.score,v.sessionId,v.promptHash,v.imageHash,v.metadataHash,v.uriHash,v.nonce,v.deadline));
        if(!hasRole(SIGNER_ROLE,ECDSA.recover(_hashTypedDataV4(payload),signature))) revert InvalidSignature();
        usedSessions[v.sessionId]=true; mintedWallet[v.to]=true;
        uint256 id=++totalMinted;
        tokenGrade[id]=v.grade; tokenScore[id]=v.score; tokenPromptHash[id]=v.promptHash;
        tokenImageHash[id]=v.imageHash; tokenMetadataHash[id]=v.metadataHash; tokenSession[id]=v.sessionId;
        creatorOf[id]=v.to; uris[id]=uri;
        _safeMint(v.to,id);
        emit CandyMinted(v.to,id,v.sessionId,v.grade,v.score,v.promptHash,v.imageHash,v.metadataHash);
    }
    function tokenURI(uint256 id) public view override returns(string memory) {
        require(_exists(id),"Nonexistent candy"); return uris[id];
    }
    /// @notice The creator explicitly licenses delivery of their prompt with the NFT.
    /// The prompt itself stays off-chain; its SHA-256 commitment is fixed at mint.
    function licensePrompt(uint256 id,string calldata terms) external {
        require(ownerOf(id)==msg.sender && creatorOf[id]==msg.sender,"Creator-owner only");
        if(bytes(promptLicense[id]).length!=0) revert LicenseAlreadySet();
        require(bytes(terms).length>=20 && bytes(terms).length<=2000,"Explain prompt rights");
        promptLicense[id]=terms; emit PromptLicensed(id,terms);
    }
    function setSigner(address next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(next!=address(0),"Invalid signer"); _revokeRole(SIGNER_ROLE,signer); signer=next; _grantRole(SIGNER_ROLE,next);
    }
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
    function supportsInterface(bytes4 id) public view override(ERC721,AccessControl) returns(bool) { return super.supportsInterface(id); }
    function _beforeTokenTransfer(address from,address to,uint256 id,uint256 batch) internal override whenNotPaused { super._beforeTokenTransfer(from,to,id,batch); }
}
