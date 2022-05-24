CREATE TABLE attributes(name VARCHAR(50),
                        domain VARCHAR(256),
                        representionRule TEXT,
                        collectionOf VARCHAR(307),
                        validity integer,
                        calculation TEXT,
                        eager_calculation boolean,
                        input_attribute_ids VARCHAR(36)[],
                        revisioning boolean,
                        revisionCount integer,
                        lastRevisionDate timestamp);

CREATE TABLE IF NOT EXISTS public.var_20b17377_88cc_46b6_8b54_5ba0aec0bcdd (
	actor_id uuid,
	"time" timestamp without time zone,
	change_id integer DEFAULT nextval('var_20b17377_88cc_46b6_8b54_5ba0aec0bcdd_change_id_seq'::regclass) NOT NULL,
	"value" text,
	delta boolean
);

INSERT INTO public.var_20b17377_88cc_46b6_8b54_5ba0aec0bcdd (actor_id, "time", "value", delta) VALUES ('f62805f5-3716-4c5d-871d-c42bafe02121', NOW(), '<p>hwd</p>', 'False');
