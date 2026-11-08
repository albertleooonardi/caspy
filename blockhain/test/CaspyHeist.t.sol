// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {Test} from "forge-std/Test.sol";
import {CaspyHeist} from "../src/CaspyHeist.sol";
import {CaspyCandyMarket} from "../src/CaspyCandyMarket.sol";

contract CaspyHeistTest is Test {
    CaspyHeist candy;
    CaspyCandyMarket market;
    uint256 constant KEY=0xA11CE;
    address signer;
    address player;
    address buyer;
    string constant URI="http://localhost/fixture-metadata.json";
    string constant TERMS="Non-exclusive source prompt access with this NFT; no copyright transfer.";
    function setUp() public {
        signer=vm.addr(KEY);player=makeAddr("player");buyer=makeAddr("buyer");
        candy=new CaspyHeist("Caspy Candies","CASPY",signer,"",2);
        market=new CaspyCandyMarket(candy);
    }
    function voucher(address to,bytes32 session,uint16 score) internal view returns(CaspyHeist.CandyVoucher memory v) {
        v=CaspyHeist.CandyVoucher(to,score>=90?4:score>=75?3:score>=60?2:1,score,session,sha256("fixture prompt"),sha256("fixture image"),sha256("fixture metadata"),keccak256(bytes(URI)),1,block.timestamp+1 days);
    }
    function sig(CaspyHeist.CandyVoucher memory v) internal view returns(bytes memory) {
        bytes32 domain=keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256("Caspy Candies"),keccak256("3"),block.chainid,address(candy)));
        bytes32 typeHash=keccak256("CandyVoucher(address to,uint8 grade,uint16 score,bytes32 sessionId,bytes32 promptHash,bytes32 imageHash,bytes32 metadataHash,bytes32 uriHash,uint256 nonce,uint256 deadline)");
        bytes32 payload=keccak256(abi.encode(typeHash,v.to,v.grade,v.score,v.sessionId,v.promptHash,v.imageHash,v.metadataHash,v.uriHash,v.nonce,v.deadline));
        (uint8 vv,bytes32 rr,bytes32 ss)=vm.sign(KEY,keccak256(abi.encodePacked("\x19\x01",domain,payload)));
        return abi.encodePacked(rr,ss,vv);
    }
    function mint(address to,bytes32 id,uint16 score) internal {
        mintExpected(to,id,score,bytes4(0));
    }
    function mintExpected(address to,bytes32 id,uint16 score,bytes4 expected) internal {
        CaspyHeist.CandyVoucher memory v=voucher(to,id,score);bytes memory signature=sig(v);
        vm.prank(to);if(expected!=bytes4(0)) vm.expectRevert(expected);candy.mintCandy(v,URI,signature);
    }
    function listed() internal returns(uint256 id) {
        mint(player,bytes32(uint256(1)),94);
        vm.startPrank(player);candy.licensePrompt(1,TERMS);candy.approve(address(market),1);id=market.list(1,1 ether);vm.stopPrank();
    }
    function test_FiniteSupplyAndContentCommitments() public {
        mint(player,bytes32(uint256(1)),92);
        assertEq(candy.ownerOf(1),player);assertEq(candy.tokenGrade(1),4);assertEq(candy.tokenScore(1),92);
        assertEq(candy.tokenURI(1),URI);assertEq(candy.tokenImageHash(1),sha256("fixture image"));assertEq(candy.tokenMetadataHash(1),sha256("fixture metadata"));
        assertEq(candy.maxSupply(),2);assertEq(candy.totalMinted(),1);assertEq(candy.VERSION(),3);
    }
    function test_AllGradeThresholds() public view {
        assertEq(candy.gradeForScore(59),1);assertEq(candy.gradeForScore(60),2);assertEq(candy.gradeForScore(74),2);
        assertEq(candy.gradeForScore(75),3);assertEq(candy.gradeForScore(89),3);assertEq(candy.gradeForScore(90),4);assertEq(candy.gradeForScore(100),4);
    }
    function test_RejectsGradeTampering() public {
        CaspyHeist.CandyVoucher memory v=voucher(player,bytes32(uint256(1)),50);bytes memory signature=sig(v);v.grade=4;
        vm.prank(player);vm.expectRevert(CaspyHeist.InvalidVoucher.selector);candy.mintCandy(v,URI,signature);
    }
    function test_RejectsImageAndMetadataTampering() public {
        CaspyHeist.CandyVoucher memory v=voucher(player,bytes32(uint256(1)),92);bytes memory signature=sig(v);v.imageHash=sha256("other");
        vm.prank(player);vm.expectRevert(CaspyHeist.InvalidSignature.selector);candy.mintCandy(v,URI,signature);
    }
    function test_RejectsChangedURI() public {
        CaspyHeist.CandyVoucher memory v=voucher(player,bytes32(uint256(1)),92);bytes memory signature=sig(v);
        vm.prank(player);vm.expectRevert(CaspyHeist.InvalidVoucher.selector);candy.mintCandy(v,"https://evil.example/other",signature);
    }
    function test_RejectsReplayButAllowsMultipleHeistsPerWallet() public {
        mint(player,bytes32(uint256(1)),92);
        mintExpected(player,bytes32(uint256(1)),92,CaspyHeist.SessionAlreadyMinted.selector);
        mint(player,bytes32(uint256(2)),70);
        assertEq(candy.balanceOf(player),2);
        assertEq(candy.tokenScore(2),70);
    }
    function test_EnforcesHardSupplyCap() public {
        mint(player,bytes32(uint256(1)),92);mint(buyer,bytes32(uint256(2)),80);
        mintExpected(makeAddr("third"),bytes32(uint256(3)),60,CaspyHeist.SupplyExhausted.selector);
    }
    function test_RejectsOtherRecipientAndChain() public {
        CaspyHeist.CandyVoucher memory v=voucher(player,bytes32(uint256(1)),92);bytes memory signature=sig(v);
        vm.prank(buyer);vm.expectRevert(CaspyHeist.UnauthorizedRecipient.selector);candy.mintCandy(v,URI,signature);
        vm.chainId(block.chainid+1);vm.prank(player);vm.expectRevert(CaspyHeist.InvalidSignature.selector);candy.mintCandy(v,URI,signature);
    }
    function test_RejectsExpiredVoucherAndPausedMint() public {
        vm.warp(100);CaspyHeist.CandyVoucher memory v=voucher(player,bytes32(uint256(1)),92);v.deadline=99;bytes memory signature=sig(v);
        vm.prank(player);vm.expectRevert(CaspyHeist.ExpiredVoucher.selector);candy.mintCandy(v,URI,signature);
        candy.pause();v=voucher(player,bytes32(uint256(1)),92);signature=sig(v);vm.prank(player);vm.expectRevert(bytes("Pausable: paused"));candy.mintCandy(v,URI,signature);
    }
    function test_MarketEscrowAndExactPrice() public {
        uint256 id=listed();assertEq(candy.ownerOf(1),address(market));vm.deal(buyer,2 ether);
        vm.prank(buyer);vm.expectRevert(bytes("Exact price required"));market.buy{value:.5 ether}(id);
        vm.prank(buyer);market.buy{value:1 ether}(id);assertEq(candy.ownerOf(1),buyer);assertEq(market.proceeds(player),1 ether);
        uint256 before=player.balance;vm.prank(player);market.withdraw();assertEq(player.balance,before+1 ether);assertEq(market.proceeds(player),0);
        vm.prank(buyer);vm.expectRevert(bytes("Listing inactive"));market.buy{value:1 ether}(id);
    }
    function test_MarketRequiresOwnerApprovalAndPromptLicense() public {
        mint(player,bytes32(uint256(1)),92);
        vm.prank(buyer);vm.expectRevert(bytes("Owner only"));market.list(1,1 ether);
        vm.prank(player);vm.expectRevert(bytes("Prompt license required"));market.list(1,1 ether);
        vm.prank(player);candy.licensePrompt(1,TERMS);
        vm.prank(player);vm.expectRevert(bytes("ERC721: caller is not token owner or approved"));market.list(1,1 ether);
    }
    function test_CreatorLicenseCannotBeRewrittenByBuyer() public {
        uint256 id=listed();vm.deal(buyer,1 ether);vm.prank(buyer);market.buy{value:1 ether}(id);
        vm.prank(buyer);vm.expectRevert(bytes("Creator-owner only"));candy.licensePrompt(1,"Different license with different terms.");
        assertEq(candy.promptLicense(1),TERMS);
        vm.startPrank(buyer);candy.approve(address(market),1);uint256 next=market.list(1,2 ether);market.cancel(next);vm.stopPrank();assertEq(candy.ownerOf(1),buyer);
    }
    function test_CancelSellerOnlyAndNoSelfPurchase() public {
        uint256 id=listed();vm.prank(buyer);vm.expectRevert(bytes("Seller only"));market.cancel(id);
        vm.deal(player,1 ether);vm.prank(player);vm.expectRevert(bytes("Cannot buy own listing"));market.buy{value:1 ether}(id);
        vm.prank(player);market.cancel(id);assertEq(candy.ownerOf(1),player);
    }
    function testFuzz_GradeAlwaysDerivedFromScore(uint16 raw) public {
        uint16 score=uint16(bound(raw,0,100));mint(player,bytes32(uint256(1)),score);
        assertEq(candy.tokenGrade(1),candy.gradeForScore(score));assertLe(candy.totalMinted(),candy.maxSupply());
    }
}
