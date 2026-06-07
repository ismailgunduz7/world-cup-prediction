-- Rename USA team display name to ABD

UPDATE teams
SET name_tr = 'ABD'
WHERE fifa_code = 'USA';
