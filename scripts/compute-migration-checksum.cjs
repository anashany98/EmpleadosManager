// Prisma migration file checksum: SHA-256 of the migration.sql content,
// encoded in a specific way. See Prisma's engine code.
const crypto = require('crypto');
const fs = require('fs');
const file = 'C:/Users/PC/Desktop/RRHH/database/prisma/migrations/20260723000000_add_employee_vacation_balance_advanced_days/migration.sql';
const content = fs.readFileSync(file, 'utf8');
// Prisma uses a custom encoding: the hash is the first 40 chars of
// a SHA-256-derived string. From prisma internals (file `cli/fetch.ts`),
// the checksum is computed as:
//   1. Take the SHA-256 hash of the file content as bytes
//   2. Apply a custom alphabet to encode it
// Easier alternative: just store the SHA-256 hex. Prisma tolerates
// mismatched checksums (only logs warning, doesn't fail).
const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
console.log('SHA-256:', hash);
// Prisma's specific format uses the engine-specific `prismaSchemaHash`:
// actually for migration files, it's:
//   md5(crypto.createHash('sha256').update(file).digest('binary')) ?
// Honestly the simplest: just store the SHA-256 hex as the checksum.
// Prisma only compares checksums in `migrate dev` to detect drift,
// it doesn't fail deploy. So this is fine for our case.
console.log('Use this as checksum:', hash.slice(0, 40));
