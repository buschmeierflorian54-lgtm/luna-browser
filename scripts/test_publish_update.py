import importlib.util
import pathlib
import unittest
spec=importlib.util.spec_from_file_location('publish_update',pathlib.Path(__file__).with_name('publish-update.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReleaseSelectionTest(unittest.TestCase):
    def test_reject_other_commit_branch_and_workflow(self):
        valid=dict(databaseId=4,headSha='release-sha',headBranch='main',workflowName=module.WORKFLOW)
        runs=[dict(valid,databaseId=1,headSha='old'),dict(valid,databaseId=2,headBranch='feature'),dict(valid,databaseId=3,workflowName='pages-build-deployment'),valid]
        self.assertEqual(module.select_run(runs,'release-sha')['databaseId'],4)
        self.assertIsNone(module.select_run(runs,'unknown'))

if __name__=='__main__': unittest.main()
