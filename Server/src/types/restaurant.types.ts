
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
