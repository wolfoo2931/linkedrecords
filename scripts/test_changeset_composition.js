var diffMatchPatch = require('diff_match_patch'),
    diffEngine = new diffMatchPatch.diff_match_patch,
    Changeset = require('changesets').Changeset;

var strV1 = 'a',
    strV2 = 'ab',
    strV3 = 'abc';

cs1 = Changeset.fromDiff(diffEngine.diff_main(strV1, strV2));
cs2 = Changeset.fromDiff(diffEngine.diff_main(strV2, strV3));

console.log(cs1.merge(cs2));
