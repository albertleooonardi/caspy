// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {CaspyHeist} from "./CaspyHeist.sol";

/// @notice Fixed-price local-ETH marketplace. No chance mechanics or paid rerolls.
contract CaspyCandyMarket is IERC721Receiver,ReentrancyGuard {
    CaspyHeist public immutable candy;
    struct Listing { address seller; uint256 tokenId; uint256 price; bool active; }
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256) public proceeds;
    uint256 public nextListingId=1;
    event CandyListed(uint256 indexed listingId,address indexed seller,uint256 indexed tokenId,uint256 price);
    event CandySold(uint256 indexed listingId,address indexed seller,address indexed buyer,uint256 tokenId,uint256 price);
    event ListingCancelled(uint256 indexed listingId);
    constructor(CaspyHeist candy_) { candy=candy_; }
    function list(uint256 tokenId,uint256 price) external nonReentrant returns(uint256 id) {
        require(price>0,"Price required");
        require(candy.ownerOf(tokenId)==msg.sender,"Owner only");
        require(bytes(candy.promptLicense(tokenId)).length>=20,"Prompt license required");
        id=nextListingId++;
        listings[id]=Listing(msg.sender,tokenId,price,true);
        candy.safeTransferFrom(msg.sender,address(this),tokenId);
        emit CandyListed(id,msg.sender,tokenId,price);
    }
    function buy(uint256 id) external payable nonReentrant {
        Listing storage item=listings[id];
        require(item.active,"Listing inactive"); require(msg.value==item.price,"Exact price required");
        require(msg.sender!=item.seller,"Cannot buy own listing");
        item.active=false; proceeds[item.seller]+=msg.value;
        candy.safeTransferFrom(address(this),msg.sender,item.tokenId);
        emit CandySold(id,item.seller,msg.sender,item.tokenId,msg.value);
    }
    function cancel(uint256 id) external nonReentrant {
        Listing storage item=listings[id]; require(item.active && item.seller==msg.sender,"Seller only");
        item.active=false; candy.safeTransferFrom(address(this),msg.sender,item.tokenId); emit ListingCancelled(id);
    }
    function withdraw() external nonReentrant {
        uint256 amount=proceeds[msg.sender]; require(amount>0,"No proceeds"); proceeds[msg.sender]=0;
        (bool ok,)=payable(msg.sender).call{value:amount}(""); require(ok,"Withdrawal failed");
    }
    function onERC721Received(address operator,address,uint256,bytes calldata) external view returns(bytes4) {
        require(msg.sender==address(candy) && operator==address(this),"Use list");
        return IERC721Receiver.onERC721Received.selector;
    }
}
