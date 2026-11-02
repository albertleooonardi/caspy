#!/usr/bin/env python3
"""Offline v2 candy voucher utility. Production runtime uses the local RPC bridge.
This utility never evaluates a prompt; callers must provide verified commitments.
"""
from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_utils import keccak

FIELDS = [('to','address'),('grade','uint8'),('score','uint16'),('sessionId','bytes32'),('promptHash','bytes32'),('imageHash','bytes32'),('metadataHash','bytes32'),('uriHash','bytes32'),('nonce','uint256'),('deadline','uint256')]

class VoucherSigner:
    def __init__(self,private_key,contract_address,chain_id,domain_name='Caspy Candies',domain_version='2'):
        self.account=Account.from_key(private_key)
        self.contract_address=contract_address.lower();self.chain_id=chain_id
        self.domain_name=domain_name;self.domain_version=domain_version

    def encoded(self,voucher):
        return encode_typed_data(domain_data={'name':self.domain_name,'version':self.domain_version,'chainId':self.chain_id,'verifyingContract':self.contract_address},
            message_types={'CandyVoucher':[{'name':name,'type':kind} for name,kind in FIELDS]},message_data=voucher)

    def create_voucher(self,to,score,session_id,prompt_hash,image_hash,metadata_hash,uri,nonce,deadline):
        if type(score) is not int or not 0<=score<=100: raise ValueError('Invalid score')
        grade=4 if score>=90 else 3 if score>=75 else 2 if score>=60 else 1
        for digest in (session_id,prompt_hash,image_hash,metadata_hash):
            if len(bytes.fromhex(digest.removeprefix('0x')))!=32: raise ValueError('Expected bytes32 commitment')
        v=dict(to=to.lower(),grade=grade,score=score,sessionId=session_id,promptHash=prompt_hash,imageHash=image_hash,metadataHash=metadata_hash,uriHash='0x'+keccak(text=uri).hex(),nonce=nonce,deadline=deadline)
        signed=self.account.sign_message(self.encoded(v))
        return {'voucher':v,'uri':uri,'signature':'0x'+signed.signature.hex(),'signer':self.account.address}

    def verify_voucher(self,voucher_data,signature):
        try:
            address=Account.recover_message(self.encoded(voucher_data),signature=signature)
            return address.lower()==self.account.address.lower(),address
        except Exception: return False,''
