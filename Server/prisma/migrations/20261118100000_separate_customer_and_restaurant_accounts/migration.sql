-- One email is either a customer or a restaurant account. Accounts still marked CUSTOMER
-- that already belong to a restaurant team become restaurant accounts, using their most senior role.
UPDATE "users" AS u
SET "user_type" = CASE m."role"
    WHEN 'GROUP_OWNER' THEN 'RESTAURANT_OWNER'
    WHEN 'GROUP_ADMIN' THEN 'RESTAURANT_OWNER'
    WHEN 'BRANCH_MANAGER' THEN 'BRANCH_MANAGER'
    WHEN 'KITCHEN_STAFF' THEN 'KITCHEN_STAFF'
    ELSE 'DELIVERY_STAFF'
  END::"user_type"
FROM (
  SELECT DISTINCT ON ("user_id") "user_id", "role"
  FROM "restaurant_members"
  WHERE "status" <> 'REMOVED'
  ORDER BY "user_id", CASE "role"
    WHEN 'GROUP_OWNER' THEN 0
    WHEN 'GROUP_ADMIN' THEN 1
    WHEN 'BRANCH_MANAGER' THEN 2
    WHEN 'KITCHEN_STAFF' THEN 3
    ELSE 4
  END
) AS m
WHERE u."id" = m."user_id" AND u."user_type" = 'CUSTOMER';
