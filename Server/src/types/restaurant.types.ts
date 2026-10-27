
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
