// src/types/user.ts
import type { Role } from '../constants/roles.js';

export interface User {
  id: string;
  email: string;
  role: Role;
  organizationId?: string;
}

