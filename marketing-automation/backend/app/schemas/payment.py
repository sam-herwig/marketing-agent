from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.payment import SubscriptionStatus, PaymentStatus, PricingTier


class CustomerResponse(BaseModel):
    id: int
    user_id: int
    stripe_customer_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SubscriptionResponse(BaseModel):
    id: int
    customer_id: int
    stripe_subscription_id: str
    stripe_price_id: str
    tier: PricingTier
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    canceled_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PaymentMethodResponse(BaseModel):
    id: int
    customer_id: int
    stripe_payment_method_id: str
    type: str
    brand: Optional[str]
    last4: Optional[str]
    exp_month: Optional[int]
    exp_year: Optional[int]
    is_default: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: str
    amount_paid: float
    amount_due: float
    currency: str
    status: str
    invoice_pdf: Optional[str]
    hosted_invoice_url: Optional[str]
    created_at: int
    period_start: int
    period_end: int


class CreateSubscriptionRequest(BaseModel):
    tier: PricingTier
    payment_method_id: Optional[str] = None
    discount_code: Optional[str] = None


class UpdateSubscriptionRequest(BaseModel):
    tier: PricingTier


class AddPaymentMethodRequest(BaseModel):
    payment_method_id: str
    set_as_default: bool = False


class UsageRecordRequest(BaseModel):
    service_type: str
    quantity: int
    metadata: Optional[Dict[str, Any]] = None


class PricingTierResponse(BaseModel):
    id: str
    name: str
    price: float
    campaign_limit: int
    features: List[str]