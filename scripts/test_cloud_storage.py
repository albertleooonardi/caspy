import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import time
import unittest
from unittest.mock import patch

from candy_store import CandyStore
from cloud_storage import DatabaseSnapshots
from heist_api import Games
from platform_store import Platform, Fault
from test_candy_store import FakeNFT, FixtureRenderer, winner
from test_heist_api import FakeGateway


class CloudStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.platform=Platform(self.root/'fixture.db')

    def test_game_snapshots_survive_new_process_state_and_isolate_deployments(self):
        games=Games(FakeGateway(),DatabaseSnapshots(self.platform,'preview-one'))
        first=games.create('wallet:owner',unlimited=True)
        games.turn(first['id'],'wallet:owner','A fictional sugar trade','turn-one',lambda _:None)
        again=Games(FakeGateway(),DatabaseSnapshots(self.platform,'preview-one'))
        self.assertEqual(again.owned(first['id'],'wallet:owner')['data']['attempts_remaining'],2)
        with self.assertRaises(LookupError): again.owned(first['id'],'wallet:other')
        self.assertEqual(DatabaseSnapshots(self.platform,'preview-two').load(),{})

    def test_blobs_survive_ephemeral_filesystem_loss_and_enforce_hashes(self):
        with patch('candy_store.environment',return_value={'CASPY_ASSET_STORAGE':'postgres','CASPY_PUBLIC_ORIGIN':'https://caspy.example'}):
            candy=CandyStore(self.platform,FakeNFT(),self.root/'assets',FixtureRenderer())
            self.addCleanup(candy.close)
            user={'id':'owner'}
            candy.ensure_win(winner(),user,'wallet')
            candy.generate('one',user,True)
            for _ in range(100):
                row=candy.row('one')
                if row['state']!='generating': break
                time.sleep(.02)
            self.assertEqual(row['state'],'ready')
            manifest=json.loads(candy.blob(row['metadata_hash'],'json'))
            self.assertTrue(manifest['image'].startswith('https://caspy.example/api/candy/'))
            candy.close();shutil.rmtree(self.root/'assets')
            restored=CandyStore(self.platform,FakeNFT(),self.root/'fresh-assets',FixtureRenderer())
            self.addCleanup(restored.close)
            self.assertEqual(restored.commitments('one')['image_hash'],'0x'+row['image_hash'])
            with self.platform.db() as db: db.execute('UPDATE candy_blobs SET content=? WHERE digest=?',(b'tampered',row['image_hash']))
            with self.assertRaises(Fault): restored.ready('one')

    def test_starting_another_season_does_not_interrupt_its_jobs(self):
        candy=CandyStore(self.platform,FakeNFT(),self.root/'assets',FixtureRenderer())
        self.addCleanup(candy.close)
        candy.ensure_win(winner(),{'id':'owner'},'wallet')
        with self.platform.db() as db: db.execute("UPDATE candy_jobs SET state='generating' WHERE id='one'")
        nft=FakeNFT();nft.config={**nft.config,'contract':'0x'+'44'*20}
        other=CandyStore(self.platform,nft,self.root/'other-assets',FixtureRenderer())
        self.addCleanup(other.close)
        self.assertEqual(candy.row('one')['state'],'generating')
