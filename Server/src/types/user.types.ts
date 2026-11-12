
export interface SignupRequestBody {
  fullName: string;
  email: string;
  password: string;
  // Which app the verification link should open.
  app?: "customer" | "dashboard";
}

export interface ChangePasswordRequestBody {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequestBody {
  fullName?: string;
  phone?: string | null;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isEmailVerified: boolean;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: AuthenticatedUser;
}

//addresses
export interface CreateAddressRequestBody {
  addressType?: "HOME" | "WORK" | "OTHER";
  label?: string;
  recipientName?: string;
  recipientPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  deliveryInstructions?: string;
  isDefault?: boolean;
}

export type UpdateAddressRequestBody = Partial<CreateAddressRequestBody>;
