
export interface CreateRestaurantRequestBody {
  groupName: string;
  legalName?: string;
  businessEmail?: string;
  businessPhone?: string;
  taxNumber?: string;
  logoUrl?: string;
  websiteUrl?: string;

  branchName: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  timezone?: string;
  currency?: string;
  averagePreparationTimeMinutes?: number;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  acceptsDineIn?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: OpeningHours;
}
//for branch
export interface CreateBranchRequestBody {
  branchName: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  timezone?: string;
  currency?: string;
  averagePreparationTimeMinutes?: number;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  acceptsDineIn?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: OpeningHours;
}
//menu items
export interface CreateMenuCategoryRequestBody {
  name: string;
  description?: string;
  imageUrl?: string;
  displayOrder?: number;
}

export interface UpdateMenuCategoryRequestBody {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateMenuItemRequestBody {
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  preparationTimeMinutes?: number;
}

export interface UpdateMenuItemRequestBody {
  categoryId?: string;
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  basePrice?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  preparationTimeMinutes?: number;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  isAvailable?: boolean;
  displayOrder?: number;
}

export interface CreateMenuItemVariantRequestBody {
  name: string;
  price: number;
  isDefault?: boolean;
  isAvailable?: boolean;
  displayOrder?: number;
}

//members
export type MemberRole =| "GROUP_ADMIN"| "BRANCH_MANAGER"| "KITCHEN_STAFF"| "DELIVERY_STAFF";

export interface AddMemberRequestBody {
  email: string;
  role: MemberRole;
  branchId?: string;
  // Needed only when no account exists yet for this email; both are emailed to the new member.
  fullName?: string;
  password?: string;
}

export interface UpdateMemberRequestBody {
  role?: MemberRole;
  branchId?: string | null;
  status?: "ACTIVE" | "SUSPENDED" | "REMOVED";
}

//branch details shared by onboarding, create branch and edit branch
export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type OpeningHoursDay =
  | { closed: true }
  | { closed: false; open: string; close: string };

export type OpeningHours = Record<WeekDay, OpeningHoursDay>;

export interface BranchFields {
  branchName?: string;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  averagePreparationTimeMinutes?: number;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  acceptsDineIn?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: OpeningHours;
  status?: "ACTIVE" | "INACTIVE" | "TEMPORARILY_CLOSED";
}

export type UpdateBranchRequestBody = BranchFields;
