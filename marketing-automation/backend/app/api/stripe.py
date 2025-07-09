from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import stripe
import json
from app.core.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.models.payment import Customer, Subscription, PaymentMethod, PricingTier
from app.services.stripe_service import StripeService
from app.schemas.payment import (
    CustomerResponse, SubscriptionResponse, PaymentMethodResponse,
    CreateSubscriptionRequest, UpdateSubscriptionRequest,
    AddPaymentMethodRequest, InvoiceResponse, UsageRecordRequest,
    PricingTierResponse
)
import logging

router = APIRouter(prefix="/stripe", tags=["payments"])
logger = logging.getLogger(__name__)


@router.post("/customers", response_model=CustomerResponse)
async def create_customer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe customer for the current user"""
    # Check if customer already exists
    existing_customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if existing_customer:
        raise HTTPException(status_code=400, detail="Customer already exists")
    
    customer = await StripeService.create_customer(db, current_user)
    return customer


@router.get("/customers/me", response_model=CustomerResponse)
async def get_current_customer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's customer information"""
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return customer


@router.get("/pricing-tiers", response_model=List[PricingTierResponse])
async def get_pricing_tiers():
    """Get available pricing tiers"""
    tiers = []
    for tier_key, tier_data in settings.PRICING_TIERS.items():
        tiers.append({
            "id": tier_key,
            "name": tier_data["name"],
            "price": tier_data["price"],
            "campaign_limit": tier_data["campaign_limit"],
            "features": tier_data["features"]
        })
    return tiers


@router.post("/subscriptions", response_model=SubscriptionResponse)
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a subscription for the current user"""
    # Get or create customer
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if not customer:
        customer = await StripeService.create_customer(db, current_user)
    
    # Check if active subscription exists
    active_subscription = db.query(Subscription).filter(
        Subscription.customer_id == customer.id,
        Subscription.status.in_(["active", "trialing"])
    ).first()
    
    if active_subscription:
        raise HTTPException(status_code=400, detail="Active subscription already exists")
    
    # Create subscription with optional discount
    if hasattr(request, 'discount_code') and request.discount_code:
        subscription = await StripeService.create_subscription_with_discount(
            db, customer, request.tier, request.discount_code, request.payment_method_id
        )
    else:
        subscription = await StripeService.create_subscription(
            db, customer, request.tier, request.payment_method_id
        )
    
    return subscription


@router.get("/subscriptions/current", response_model=Optional[SubscriptionResponse])
async def get_current_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's active subscription"""
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if not customer:
        return None
    
    subscription = db.query(Subscription).filter(
        Subscription.customer_id == customer.id,
        Subscription.status.in_(["active", "trialing", "past_due"])
    ).first()
    
    return subscription


@router.put("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: int,
    request: UpdateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a subscription (change tier)"""
    subscription = db.query(Subscription).join(Customer).filter(
        Subscription.id == subscription_id,
        Customer.user_id == current_user.id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    updated_subscription = await StripeService.update_subscription(
        db, subscription, request.tier
    )
    
    return updated_subscription


@router.delete("/subscriptions/{subscription_id}")
async def cancel_subscription(
    subscription_id: int,
    at_period_end: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a subscription"""
    subscription = db.query(Subscription).join(Customer).filter(
        Subscription.id == subscription_id,
        Customer.user_id == current_user.id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    await StripeService.cancel_subscription(db, subscription, at_period_end)
    
    return {"message": "Subscription canceled successfully"}


@router.post("/payment-methods", response_model=PaymentMethodResponse)
async def add_payment_method(
    request: AddPaymentMethodRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a payment method"""
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if not customer:
        customer = await StripeService.create_customer(db, current_user)
    
    payment_method = await StripeService.add_payment_method(
        db, customer, request.payment_method_id, request.set_as_default
    )
    
    return payment_method


@router.get("/payment-methods", response_model=List[PaymentMethodResponse])
async def get_payment_methods(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all payment methods for the current user"""
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if not customer:
        return []
    
    payment_methods = db.query(PaymentMethod).filter(
        PaymentMethod.customer_id == customer.id
    ).all()
    
    return payment_methods


@router.delete("/payment-methods/{payment_method_id}")
async def remove_payment_method(
    payment_method_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a payment method"""
    payment_method = db.query(PaymentMethod).join(Customer).filter(
        PaymentMethod.id == payment_method_id,
        Customer.user_id == current_user.id
    ).first()
    
    if not payment_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    # Don't allow removal if it's the only payment method and there's an active subscription
    customer = payment_method.customer
    if payment_method.is_default:
        other_methods = db.query(PaymentMethod).filter(
            PaymentMethod.customer_id == customer.id,
            PaymentMethod.id != payment_method_id
        ).count()
        
        active_subscription = db.query(Subscription).filter(
            Subscription.customer_id == customer.id,
            Subscription.status.in_(["active", "trialing"])
        ).first()
        
        if active_subscription and other_methods == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the only payment method with an active subscription"
            )
    
    await StripeService.remove_payment_method(db, payment_method)
    
    return {"message": "Payment method removed successfully"}


@router.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get billing history (invoices)"""
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if not customer:
        return []
    
    stripe_invoices = await StripeService.get_invoices(customer, limit)
    
    # Convert Stripe invoices to response format
    invoices = []
    for stripe_invoice in stripe_invoices:
        invoices.append({
            "id": stripe_invoice.id,
            "amount_paid": stripe_invoice.amount_paid / 100,
            "amount_due": stripe_invoice.amount_due / 100,
            "currency": stripe_invoice.currency,
            "status": stripe_invoice.status,
            "invoice_pdf": stripe_invoice.invoice_pdf,
            "hosted_invoice_url": stripe_invoice.hosted_invoice_url,
            "created_at": stripe_invoice.created,
            "period_start": stripe_invoice.period_start,
            "period_end": stripe_invoice.period_end
        })
    
    return invoices


@router.post("/usage")
async def record_usage(
    request: UsageRecordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record usage for usage-based billing"""
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    usage_record = await StripeService.record_usage(
        db, customer, request.service_type, request.quantity, request.metadata
    )
    
    return {"message": "Usage recorded successfully", "usage_id": usage_record.id}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Process the event
    try:
        await StripeService.process_webhook_event(db, event)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing webhook")


@router.get("/usage-pricing")
async def get_usage_pricing():
    """Get usage-based pricing information"""
    return settings.USAGE_PRICING