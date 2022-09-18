import { Changeset } from 'changesets';
import { diff_match_patch as DiffMatchPatch} from 'diff_match_patch';

const diffEngine = new DiffMatchPatch();

export default class LongTextChange {

    public changeset;

    constructor(changeset) {
        this.changeset = changeset;
    }

    public static fromString(change: string): LongTextChange {
        return new LongTextChange(Changeset.unpack(change));
    }

    public static fromDiff(a: string, b: string): LongTextChange {
        return new LongTextChange(Changeset.fromDiff(diffEngine.diff_main(a, b)));
    }

    public apply(value: string): string {
        return this.changeset.apply(value);
    }

    public toString(): string {
        return this.changeset.pack();
    }

    public transformAgainst(change?, side?) : LongTextChange {
        return new LongTextChange(this.changeset.transformAgainst(change.changeset, side));
    }

    public merge(otherChange: LongTextChange) : LongTextChange {
        return this.changeset.merge(otherChange.changeset);
    }
}