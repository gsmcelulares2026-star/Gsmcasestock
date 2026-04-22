export type AppRole = 'owner' | 'manager' | 'operator';

export interface UserProfile {
  id: string;
  fullName?: string;
  role: AppRole;
  isActive: boolean;
}
