/**
 * Interactive admin creation.
 *
 *   npm run create-admin
 *
 * Admins cannot be created through the public API by design, so this script is
 * the only path to the first (and any subsequent) administrator account.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  TN_DISTRICTS,
  checkPassword,
  maskPhone,
  nameSchema,
  normalisePhone,
} from '@farmfair/shared';
import { connectDb, disconnectDb } from '../config/db';
import { User } from '../models/User';
import { recordAudit } from '../services/audit';
import { hashPassword } from '../services/password';

const rl = createInterface({ input: stdin, output: stdout });

async function ask(question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

/**
 * Prompt without echoing. readline has no built-in masking, so the output
 * stream is muted while the answer is typed.
 */
async function askHidden(question: string): Promise<string> {
  stdout.write(question);
  const muted = rl as unknown as { output: { write: (chunk: string) => boolean } };
  const originalWrite = muted.output.write.bind(muted.output);
  muted.output.write = () => true;
  try {
    const answer = await rl.question('');
    return answer.trim();
  } finally {
    muted.output.write = originalWrite;
    stdout.write('\n');
  }
}

async function promptName(): Promise<string> {
  for (;;) {
    const value = await ask('Full name: ');
    const result = nameSchema.safeParse(value);
    if (result.success) return result.data;
    console.error(`  ! ${result.error.issues[0]?.message ?? 'Invalid name'}`);
  }
}

async function promptPhone(): Promise<string> {
  for (;;) {
    const value = await ask('Mobile number (10 digits): ');
    const phone = normalisePhone(value);
    if (!phone) {
      console.error('  ! Enter a valid 10-digit Indian mobile number');
      continue;
    }
    const existing = await User.findOne({ phone }).select({ role: 1 }).exec();
    if (existing) {
      console.error(`  ! ${maskPhone(phone)} is already registered as a ${existing.role}`);
      continue;
    }
    return phone;
  }
}

async function promptPassword(): Promise<string> {
  for (;;) {
    const password = await askHidden('Password (min 8 chars, letter + number): ');
    const check = checkPassword(password);
    if (!check.valid) {
      console.error(`  ! Password rejected: ${check.problems.join(', ')}`);
      continue;
    }
    const again = await askHidden('Confirm password: ');
    if (again !== password) {
      console.error('  ! Passwords do not match');
      continue;
    }
    return password;
  }
}

async function promptDistrict(): Promise<string> {
  const fallback = 'Chennai';
  for (;;) {
    const value = await ask(`District [${fallback}]: `);
    if (value === '') return fallback;
    const match = TN_DISTRICTS.find((d) => d.toLowerCase() === value.toLowerCase());
    if (match) return match;
    console.error('  ! Not a Tamil Nadu district. Examples: Salem, Namakkal, Erode, Chennai');
  }
}

async function main(): Promise<void> {
  console.log('\nFarmFair - create an administrator\n');

  await connectDb();

  const name = await promptName();
  const phone = await promptPhone();
  const district = await promptDistrict();
  const password = await promptPassword();

  const admin = await User.create({
    name,
    phone,
    passwordHash: await hashPassword(password),
    role: 'admin',
    district,
    verificationStatus: 'not_required',
    phoneVerified: true,
    language: 'en',
  });

  await recordAudit({
    actor: admin._id,
    action: 'admin.create',
    entity: 'User',
    entityId: String(admin._id),
    metadata: { phone, createdBy: 'cli' },
    channel: 'cli',
  });

  console.log('\nAdmin created.');
  console.log(`  name     ${admin.name}`);
  console.log(`  phone    ${phone}`);
  console.log(`  district ${admin.district}`);
  console.log(`  id       ${String(admin._id)}`);
  console.log('\nSign in at the client with that mobile number and password.\n');
}

main()
  .then(async () => {
    rl.close();
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}\n`);
    rl.close();
    await disconnectDb().catch(() => undefined);
    process.exit(1);
  });
