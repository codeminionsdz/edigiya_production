-- Phase 1 blocker repair.
-- The atomic checkout RPC is the single source of truth for RESERVED movements.
-- 20260913 added a trigger that duplicated the RPC's RESERVED insert. Remove
-- that trigger and its helper; do not alter existing inventory movement rows.

DROP TRIGGER IF EXISTS trigger_record_inventory_reservation_movement
  ON inventory_reservation_items;

DROP FUNCTION IF EXISTS record_inventory_reservation_movement();
