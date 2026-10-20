/**
 * Backup plan checker. Does not open a database and never prints a connection string.
 *
 * A real copy is `pg_dump` from a trusted machine, with DATABASE_URL already in
 * the environment, writing outside the git tree. Neon point-in-time restore is
 * the first recovery path; confirm the branch window in the Neon console rather
 * than assuming a retention period here.
 */

export function dumpHasRestoreMarkers(sql) {
  return (
    typeof sql === "string" &&
    sql.includes("PostgreSQL database dump") &&
    /create table[^\n;]*\borders\b/i.test(sql) &&
    /create table[^\n;]*\bstore_settings\b/i.test(sql)
  );
}

export function backupTargetIsSafe(target) {
  if (typeof target !== "string" || target.trim() === "") return false;
  if (target.includes("..")) return false;
  if (target.startsWith("src/") || target.startsWith("docs/") || target.startsWith("migrations/")) return false;
  return target.endsWith(".sql") || target.endsWith(".dump");
}
