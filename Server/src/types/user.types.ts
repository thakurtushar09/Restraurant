
export interface SignupRequestBody {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: AuthenticatedUser;
}
