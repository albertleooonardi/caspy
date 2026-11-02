import pytest
from voucher_signer import VoucherSigner
KEY='0x'+'01'*32
ADDRESS='0x'+'ab'*20
CONTRACT='0x'+'cd'*20
HASH='0x'+'12'*32

def signed(signer,score=92):
    return signer.create_voucher(ADDRESS,score,HASH,HASH,HASH,HASH,'http://localhost/metadata.json',1,2000000000)

def test_commitments_are_signed():
    signer=VoucherSigner(KEY,CONTRACT,31337)
    result=signed(signer)
    assert result['voucher']['grade']==4
    assert signer.verify_voucher(result['voucher'],result['signature'])[0]
    for field in ('imageHash','metadataHash','promptHash','uriHash'):
        changed={**result['voucher'],field:'0x'+'34'*32}
        assert not signer.verify_voucher(changed,result['signature'])[0]
    assert not VoucherSigner(KEY,CONTRACT,8453).verify_voucher(result['voucher'],result['signature'])[0]

@pytest.mark.parametrize('score,grade',[(0,1),(59,1),(60,2),(74,2),(75,3),(89,3),(90,4),(100,4)])
def test_grade(score,grade):
    assert signed(VoucherSigner(KEY,CONTRACT,31337),score)['voucher']['grade']==grade

@pytest.mark.parametrize('score',[-1,101,True,1.5])
def test_rejects_invalid_score(score):
    with pytest.raises(ValueError): signed(VoucherSigner(KEY,CONTRACT,31337),score)
