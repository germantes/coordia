// src/types/user.ts
import type { Role } from '../constants/roles.js';

export interface User {
  id: string;
  displayName?: string;
  email: string;
  role: Role;
  organizationId?: string;
  createdAt?: string;
}

