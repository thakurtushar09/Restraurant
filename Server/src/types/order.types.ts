
export interface CheckoutItem {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  specialInstructions?: string;
}

export interface CheckoutRequestBody {
  branchId: string;
  fulfillmentType: "DELIVERY" | "PICKUP" | "DINE_IN";
  paymentMethod?: "ONLINE" | "CASH" | "PAY_AT_COUNTER";
  addressId?: string;
  customerName: string;
  customerPhone: string;
  customerNotes?: string;
  needsPackaging?: boolean;
  scheduledAt?: string;
  partySize?: number;
  // Set by a guest who scanned the restaurant's QR: an instant dine-in order to this table.
  tableNumber?: string;
  items: CheckoutItem[];
}



export interface UpdateOrderStatusRequestBody {
  status:| "ACCEPTED"| "REJECTED"| "PREPARING"| "READY"| "OUT_FOR_DELIVERY"| "COMPLETED"| "CANCELLED";
  rejectionReason?: string;
}

export interface RescheduleOrderRequestBody {
  scheduledAt: string;
}

export interface CancelOrderRequestBody {
  cancellationReason?: string;
}

export interface DelayOrderRequestBody {
  minutes: number;
}
