DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pe_portal') THEN
      CREATE ROLE pe_portal WITH LOGIN PASSWORD 'Sein2016!' SUPERUSER;
   ELSE
      ALTER ROLE pe_portal WITH PASSWORD 'Sein2016!';
   END IF;
END
$$;

SELECT 'CREATE DATABASE pe_portal OWNER pe_portal'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pe_portal')\gexec
