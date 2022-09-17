import { Changeset } from 'changesets';
import { diff_match_patch as DiffMatchPatch} from 'diff_match_patch';

const diffEngine = new DiffMatchPatch();

export default class LongTextDelta {

    changeset;

    constructor(changeset) {
        this.changeset = changeset;
    }

    public static fromString(change: string): LongTextDelta {
        return new LongTextDelta(Changeset.unpack());
    }

    public static fromDiff(a: string, b: string): LongTextDelta {
        return new LongTextDelta(Changeset.fromDiff(diffEngine.diff_main(a, b)));
    }

    public apply(value: string): string {
        return this.changeset.apply(value);
    }

    public toString(): string {
        return this.changeset.pack();
    }

    public transformAgainst(change?, side?) : LongTextDelta {
        return new LongTextDelta(this.changeset.transformAgainst(change, side));
    }

    public merge(otherChange: LongTextDelta) : LongTextDelta {
        return this.changeset.merge(otherChange);
    }
}