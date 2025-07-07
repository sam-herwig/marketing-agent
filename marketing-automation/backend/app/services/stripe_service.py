import stripe
from typing import Optional, Dict, List, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.payment import (
    Customer, Subscription, PaymentMethod, Invoice, InvoiceLineItem,
    UsageRecord, PaymentEvent, SubscriptionStatus, PricingTier
)
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    """Service layer for Stripe payment operations"""
    
    @staticmethod
    async def create_customer(db: Session, user: User, payment_method_id: Optional[str] = None) -> Customer:
        """Create a Stripe customer and store in database"""
        try:
            # Create Stripe customer
            stripe_customer_data = {
                "email": user.email,
                "metadata": {
                    "user_id": str(user.id),
                    "username": user.username
                }
            }
            
            if payment_method_id:
                stripe_customer_data["payment_method"] = payment_method_id
                stripe_customer_data["invoice_settings"] = {"default_payment_method": payment_method_id}
            
            stripe_customer = stripe.Customer.create(**stripe_customer_data)
            
            # Create database customer record
            customer = Customer(
                user_id=user.id,
                stripe_customer_id=stripe_customer.id
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
            
            logger.info(f"Created Stripe customer {stripe_customer.id} for user {user.id}")
            return customer
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating customer: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error creating customer: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def create_subscription(
        db: Session,
        customer: Customer,
        tier: PricingTier,
        payment_method_id: Optional[str] = None
    ) -> Subscription:
        """Create a subscription for a customer"""
        try:
            price_id = settings.PRICING_TIERS[tier.value]["price_id"]
            
            # Attach payment method if provided
            if payment_method_id:
                stripe.PaymentMethod.attach(
                    payment_method_id,
                    customer=customer.stripe_customer_id
                )
                
                # Set as default payment method
                stripe.Customer.modify(
                    customer.stripe_customer_id,
                    invoice_settings={"default_payment_method": payment_method_id}
                )
            
            # Create Stripe subscription
            stripe_subscription = stripe.Subscription.create(
                customer=customer.stripe_customer_id,
                items=[{"price": price_id}],
                expand=["latest_invoice", "default_payment_method"]
            )
            
            # Create database subscription record
            subscription = Subscription(
                customer_id=customer.id,
                stripe_subscription_id=stripe_subscription.id,
                stripe_price_id=price_id,
                tier=tier,
                status=SubscriptionStatus(stripe_subscription.status),
                current_period_start=datetime.fromtimestamp(stripe_subscription.current_period_start),
                current_period_end=datetime.fromtimestamp(stripe_subscription.current_period_end)
            )
            db.add(subscription)
            db.commit()
            db.refresh(subscription)
            
            logger.info(f"Created subscription {stripe_subscription.id} for customer {customer.id}")
            return subscription
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating subscription: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error creating subscription: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def update_subscription(
        db: Session,
        subscription: Subscription,
        new_tier: PricingTier
    ) -> Subscription:
        """Update a subscription to a new tier"""
        try:
            new_price_id = settings.PRICING_TIERS[new_tier.value]["price_id"]
            
            # Get current subscription from Stripe
            stripe_subscription = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
            
            # Update subscription
            updated_subscription = stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                items=[{
                    "id": stripe_subscription["items"]["data"][0].id,
                    "price": new_price_id
                }],
                proration_behavior="create_prorations"
            )
            
            # Update database record
            subscription.tier = new_tier
            subscription.stripe_price_id = new_price_id
            subscription.status = SubscriptionStatus(updated_subscription.status)
            subscription.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(subscription)
            
            logger.info(f"Updated subscription {subscription.id} to tier {new_tier}")
            return subscription
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error updating subscription: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error updating subscription: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def cancel_subscription(
        db: Session,
        subscription: Subscription,
        at_period_end: bool = True
    ) -> Subscription:
        """Cancel a subscription"""
        try:
            # Cancel in Stripe
            if at_period_end:
                stripe_subscription = stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=True
                )
            else:
                stripe_subscription = stripe.Subscription.delete(
                    subscription.stripe_subscription_id
                )
            
            # Update database record
            subscription.cancel_at_period_end = at_period_end
            subscription.canceled_at = datetime.utcnow()
            if not at_period_end:
                subscription.status = SubscriptionStatus.CANCELED
            
            db.commit()
            db.refresh(subscription)
            
            logger.info(f"Canceled subscription {subscription.id}")
            return subscription
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error canceling subscription: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error canceling subscription: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def add_payment_method(
        db: Session,
        customer: Customer,
        payment_method_id: str,
        set_as_default: bool = False
    ) -> PaymentMethod:
        """Add a payment method for a customer"""
        try:
            # Attach payment method in Stripe
            stripe_payment_method = stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer.stripe_customer_id
            )
            
            # Set as default if requested
            if set_as_default:
                stripe.Customer.modify(
                    customer.stripe_customer_id,
                    invoice_settings={"default_payment_method": payment_method_id}
                )
                
                # Update other payment methods to not be default
                db.query(PaymentMethod).filter(
                    PaymentMethod.customer_id == customer.id,
                    PaymentMethod.is_default == True
                ).update({"is_default": False})
            
            # Create database record
            payment_method = PaymentMethod(
                customer_id=customer.id,
                stripe_payment_method_id=payment_method_id,
                type=stripe_payment_method.type,
                brand=stripe_payment_method.card.brand if stripe_payment_method.type == "card" else None,
                last4=stripe_payment_method.card.last4 if stripe_payment_method.type == "card" else None,
                exp_month=stripe_payment_method.card.exp_month if stripe_payment_method.type == "card" else None,
                exp_year=stripe_payment_method.card.exp_year if stripe_payment_method.type == "card" else None,
                is_default=set_as_default
            )
            db.add(payment_method)
            db.commit()
            db.refresh(payment_method)
            
            logger.info(f"Added payment method {payment_method_id} for customer {customer.id}")
            return payment_method
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error adding payment method: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error adding payment method: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def remove_payment_method(db: Session, payment_method: PaymentMethod) -> None:
        """Remove a payment method"""
        try:
            # Detach from Stripe
            stripe.PaymentMethod.detach(payment_method.stripe_payment_method_id)
            
            # Delete from database
            db.delete(payment_method)
            db.commit()
            
            logger.info(f"Removed payment method {payment_method.id}")
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error removing payment method: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error removing payment method: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def get_invoices(customer: Customer, limit: int = 10) -> List[Dict[str, Any]]:
        """Get invoices for a customer"""
        try:
            invoices = stripe.Invoice.list(
                customer=customer.stripe_customer_id,
                limit=limit
            )
            return invoices.data
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error getting invoices: {str(e)}")
            raise
    
    @staticmethod
    async def record_usage(
        db: Session,
        customer: Customer,
        service_type: str,
        quantity: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UsageRecord:
        """Record usage for usage-based billing"""
        try:
            unit_amount = settings.USAGE_PRICING.get(service_type, 0)
            total_amount = unit_amount * quantity
            
            usage_record = UsageRecord(
                customer_id=customer.id,
                subscription_id=customer.subscriptions[0].id if customer.subscriptions else None,
                service_type=service_type,
                quantity=quantity,
                unit_amount=unit_amount,
                total_amount=total_amount,
                metadata=metadata
            )
            db.add(usage_record)
            db.commit()
            db.refresh(usage_record)
            
            logger.info(f"Recorded usage for customer {customer.id}: {service_type} x{quantity}")
            return usage_record
            
        except Exception as e:
            logger.error(f"Error recording usage: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def process_webhook_event(db: Session, event_data: Dict[str, Any]) -> None:
        """Process a Stripe webhook event"""
        try:
            event_id = event_data.get("id")
            event_type = event_data.get("type")
            
            # Check if event already processed
            existing_event = db.query(PaymentEvent).filter(
                PaymentEvent.stripe_event_id == event_id
            ).first()
            
            if existing_event and existing_event.processed:
                logger.info(f"Event {event_id} already processed")
                return
            
            # Create or update event record
            if not existing_event:
                event = PaymentEvent(
                    stripe_event_id=event_id,
                    event_type=event_type,
                    data=event_data
                )
                db.add(event)
            else:
                event = existing_event
            
            # Process event based on type
            if event_type == "customer.subscription.created":
                await StripeService._handle_subscription_created(db, event_data["data"]["object"])
            elif event_type == "customer.subscription.updated":
                await StripeService._handle_subscription_updated(db, event_data["data"]["object"])
            elif event_type == "customer.subscription.deleted":
                await StripeService._handle_subscription_deleted(db, event_data["data"]["object"])
            elif event_type == "invoice.paid":
                await StripeService._handle_invoice_paid(db, event_data["data"]["object"])
            elif event_type == "invoice.payment_failed":
                await StripeService._handle_invoice_payment_failed(db, event_data["data"]["object"])
            
            # Mark as processed
            event.processed = True
            event.processed_at = datetime.utcnow()
            db.commit()
            
            logger.info(f"Processed webhook event {event_id} of type {event_type}")
            
        except Exception as e:
            logger.error(f"Error processing webhook event: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def _handle_subscription_created(db: Session, subscription_data: Dict[str, Any]) -> None:
        """Handle subscription created event"""
        # Implementation for subscription created webhook
        pass
    
    @staticmethod
    async def _handle_subscription_updated(db: Session, subscription_data: Dict[str, Any]) -> None:
        """Handle subscription updated event"""
        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_data["id"]
        ).first()
        
        if subscription:
            subscription.status = SubscriptionStatus(subscription_data["status"])
            subscription.current_period_start = datetime.fromtimestamp(subscription_data["current_period_start"])
            subscription.current_period_end = datetime.fromtimestamp(subscription_data["current_period_end"])
            subscription.updated_at = datetime.utcnow()
            db.commit()
    
    @staticmethod
    async def _handle_subscription_deleted(db: Session, subscription_data: Dict[str, Any]) -> None:
        """Handle subscription deleted event"""
        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_data["id"]
        ).first()
        
        if subscription:
            subscription.status = SubscriptionStatus.CANCELED
            subscription.canceled_at = datetime.utcnow()
            db.commit()
    
    @staticmethod
    async def _handle_invoice_paid(db: Session, invoice_data: Dict[str, Any]) -> None:
        """Handle invoice paid event"""
        customer = db.query(Customer).filter(
            Customer.stripe_customer_id == invoice_data["customer"]
        ).first()
        
        if customer:
            invoice = Invoice(
                customer_id=customer.id,
                stripe_invoice_id=invoice_data["id"],
                subscription_id=db.query(Subscription).filter(
                    Subscription.stripe_subscription_id == invoice_data.get("subscription")
                ).first().id if invoice_data.get("subscription") else None,
                amount_paid=invoice_data["amount_paid"] / 100,  # Convert from cents
                amount_due=invoice_data["amount_due"] / 100,
                currency=invoice_data["currency"],
                status=invoice_data["status"],
                invoice_pdf=invoice_data.get("invoice_pdf"),
                hosted_invoice_url=invoice_data.get("hosted_invoice_url"),
                period_start=datetime.fromtimestamp(invoice_data["period_start"]),
                period_end=datetime.fromtimestamp(invoice_data["period_end"]),
                paid_at=datetime.fromtimestamp(invoice_data["status_transitions"]["paid_at"])
            )
            db.add(invoice)
            db.commit()
    
    @staticmethod
    async def _handle_invoice_payment_failed(db: Session, invoice_data: Dict[str, Any]) -> None:
        """Handle invoice payment failed event"""
        # Implementation for payment failed webhook
        # Could send notification, update subscription status, etc.
        pass