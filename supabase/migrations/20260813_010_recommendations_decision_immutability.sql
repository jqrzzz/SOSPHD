-- ═══════════════════════════════════════════════════════════════════════
-- 010 — Decision immutability for research.recommendations
-- Applied live 2026-08-13 (MCP migration `recommendations_decision_immutability`).
--
-- The app's decide path (lib/data/store.ts:decideRecommendation) enforces
-- "first writer wins" with an atomic `WHERE accepted IS NULL` guard — but
-- only app code enforced it. The RLS UPDATE policy is just
-- is_allowed_user(), so a raw PostgREST call by any allowlisted user could
-- flip a decided recommendation, silently rewriting the Paper 2 audit
-- trail. This trigger makes the decision fields immutable at the database
-- layer once `accepted` is set, which is where a reviewer will want the
-- guarantee to live.
--
-- Non-decision fields stay mutable; the pending → decided transition
-- (OLD.accepted IS NULL) is unaffected.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION research.prevent_decision_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.accepted IS NOT NULL AND (
       NEW.accepted        IS DISTINCT FROM OLD.accepted
    OR NEW.override_reason IS DISTINCT FROM OLD.override_reason
    OR NEW.decided_by      IS DISTINCT FROM OLD.decided_by
    OR NEW.decided_at      IS DISTINCT FROM OLD.decided_at
  ) THEN
    RAISE EXCEPTION
      'research.recommendations: decision fields are immutable once decided (id=%)',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recommendations_decision_immutable
  ON research.recommendations;
CREATE TRIGGER trg_recommendations_decision_immutable
  BEFORE UPDATE ON research.recommendations
  FOR EACH ROW EXECUTE FUNCTION research.prevent_decision_mutation();

-- Trigger machinery does not need caller EXECUTE; match the hardening
-- posture of migration 20260616063243 (security_definer_view_and_research_revoke).
REVOKE EXECUTE ON FUNCTION research.prevent_decision_mutation()
  FROM PUBLIC, anon, authenticated;
