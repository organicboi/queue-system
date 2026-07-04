-- Formalizes what the UI has always enforced: one staff account (branch_user)
-- is assigned to exactly one branch. The invite form and the reassignment
-- dropdown in /admin/users are both single-select and always replace any
-- prior assignment, so this just makes the database the authority for it too.
ALTER TABLE user_branches
  ADD CONSTRAINT user_branches_one_per_user UNIQUE (user_id);
