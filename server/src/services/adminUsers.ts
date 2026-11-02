import type {
  AdminUsersFilters,
  Paginated,
  SuspendUserInput,
  UserDto,
  VerifyBuyerInput,
} from '@farmfair/shared';
import { toUserDto, User, type UserDocument } from '../models/User';
import { AppError } from '../utils/AppError';
import { paginated } from '../utils/respond';

/** Paginated, filterable list of users for the admin console. */
export async function listUsers(filters: AdminUsersFilters): Promise<Paginated<UserDto>> {
  const query: Record<string, unknown> = {};
  if (filters.role) query.role = filters.role;
  if (filters.verificationStatus) query.verificationStatus = filters.verificationStatus;
  if (filters.suspended !== undefined) query.isSuspended = filters.suspended;
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;
  const [docs, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).exec(),
    User.countDocuments(query),
  ]);

  return paginated(docs.map(toUserDto), filters.page, filters.limit, total);
}

async function getUserOrThrow(id: string): Promise<UserDocument> {
  const user = await User.findById(id).exec();
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  return user;
}

/** Approve or reject a buyer's verification request. */
export async function verifyBuyer(id: string, input: VerifyBuyerInput): Promise<UserDto> {
  const user = await getUserOrThrow(id);
  if (user.role !== 'buyer') {
    throw new AppError(400, 'NOT_A_BUYER', 'Only buyers go through verification.');
  }

  user.verificationStatus = input.status;
  user.verificationNote = input.note;
  await user.save();

  return toUserDto(user);
}

/** Suspend a user and immediately revoke every session they currently hold. */
export async function suspendUser(id: string, input: SuspendUserInput): Promise<UserDto> {
  const user = await getUserOrThrow(id);
  if (user.role === 'admin') {
    throw new AppError(400, 'CANNOT_SUSPEND_ADMIN', 'Admin accounts cannot be suspended.');
  }

  user.isSuspended = true;
  user.suspensionReason = input.reason;
  user.tokenVersion += 1;
  await user.save();

  return toUserDto(user);
}

/** Lift a suspension. Past sessions stay revoked; the user must log in again. */
export async function unsuspendUser(id: string): Promise<UserDto> {
  const user = await getUserOrThrow(id);

  user.isSuspended = false;
  user.suspensionReason = undefined;
  await user.save();

  return toUserDto(user);
}
