-- DATABASE_PRD §6.3 — member dietary restriction labels (extensible).

CREATE TABLE public.member_dietary_restrictions (
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  restriction TEXT NOT NULL,
  PRIMARY KEY (member_id, restriction)
);

COMMENT ON TABLE public.member_dietary_restrictions IS
  'Member dietary restriction labels (dietary_restriction enum_metadata).';
