from typing import Optional, Dict, List, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.discount import (
    Discount, DiscountUsage, DiscountRestriction,
    DiscountType, DiscountDuration, DiscountStatus, RestrictionType
)
from app.models.payment import Customer, Subscription, PricingTier
from app.models.user import User
from app.services.stripe_service import StripeService
import logging

logger = logging.getLogger(__name__)


class DiscountService:
    """Service layer for discount operations"""
    
    @staticmethod
    async def create_discount(
        db: Session,
        code: str,
        description: Optional[str],
        discount_type: DiscountType,
        amount_off: Optional[float],
        percent_off: Optional[int],
        duration: DiscountDuration,
        duration_in_months: Optional[int],
        max_redemptions: Optional[int],
        valid_until: Optional[datetime],
        restrictions: Optional[List[Dict[str, Any]]],
        created_by_user_id: Optional[int],
        create_in_stripe: bool = True
    ) -> Discount:
        """Create a discount with optional Stripe integration"""
        try:
            stripe_coupon_id = None
            stripe_promotion_code_id = None
            
            if create_in_stripe:
                # Create Stripe coupon
                stripe_coupon = await StripeService.create_coupon(
                    code=code,
                    percent_off=percent_off,
                    amount_off=amount_off,
                    duration=duration.value,
                    duration_in_months=duration_in_months,
                    max_redemptions=max_redemptions,
                    metadata={
                        "created_by": str(created_by_user_id) if created_by_user_id else "system",
                        "description": description
                    }
                )
                stripe_coupon_id = stripe_coupon["id"]
                
                # Create promotion code for user-friendly code
                stripe_promo = await StripeService.create_promotion_code(
                    coupon_id=stripe_coupon_id,
                    code=code,
                    max_redemptions=max_redemptions,
                    expires_at=valid_until,
                    metadata={"discount_code": code}
                )
                stripe_promotion_code_id = stripe_promo["id"]
            
            # Create local discount record
            discount = Discount(
                code=code.upper(),
                description=description,
                stripe_coupon_id=stripe_coupon_id,
                stripe_promotion_code_id=stripe_promotion_code_id,
                discount_type=discount_type,
                amount_off=amount_off,
                percent_off=percent_off,
                duration=duration,
                duration_in_months=duration_in_months,
                max_redemptions=max_redemptions,
                valid_until=valid_until,
                created_by_user_id=created_by_user_id,
                status=DiscountStatus.ACTIVE
            )
            db.add(discount)
            db.flush()
            
            # Add restrictions if provided
            if restrictions:
                for restriction_data in restrictions:
                    restriction = DiscountRestriction(
                        discount_id=discount.id,
                        restriction_type=RestrictionType(restriction_data["type"]),
                        restriction_value=restriction_data["value"],
                        is_negative=restriction_data.get("is_negative", False)
                    )
                    db.add(restriction)
            
            db.commit()
            db.refresh(discount)
            
            logger.info(f"Created discount {discount.code}")
            return discount
            
        except Exception as e:
            logger.error(f"Error creating discount: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def validate_discount(
        db: Session,
        code: str,
        customer: Optional[Customer] = None,
        user: Optional[User] = None,
        tier: Optional[PricingTier] = None,
        amount: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """Validate if a discount code can be used"""
        try:
            # Find discount
            discount = db.query(Discount).filter(
                Discount.code == code.upper(),
                Discount.status == DiscountStatus.ACTIVE
            ).first()
            
            if not discount:
                return None
            
            # Check basic validity
            now = datetime.utcnow()
            if discount.valid_until and discount.valid_until < now:
                return None
            
            if discount.max_redemptions and discount.times_redeemed >= discount.max_redemptions:
                return None
            
            # Validate against Stripe if integrated
            if discount.stripe_promotion_code_id:
                stripe_validation = await StripeService.validate_promotion_code(code)
                if not stripe_validation:
                    return None
            
            # Check restrictions
            if discount.restrictions:
                for restriction in discount.restrictions:
                    if not await DiscountService._check_restriction(
                        restriction, customer, user, tier, amount
                    ):
                        return None
            
            # Check if already used by this customer
            if customer:
                existing_usage = db.query(DiscountUsage).filter(
                    DiscountUsage.discount_id == discount.id,
                    DiscountUsage.customer_id == customer.id
                ).first()
                if existing_usage:
                    return None
            
            # Calculate discount amount
            discount_amount = 0
            if discount.discount_type == DiscountType.PERCENTAGE:
                if amount:
                    discount_amount = amount * (discount.percent_off / 100)
            else:
                discount_amount = discount.amount_off
            
            return {
                "id": discount.id,
                "code": discount.code,
                "description": discount.description,
                "type": discount.discount_type.value,
                "amount_off": discount.amount_off,
                "percent_off": discount.percent_off,
                "duration": discount.duration.value,
                "duration_in_months": discount.duration_in_months,
                "discount_amount": discount_amount,
                "valid": True
            }
            
        except Exception as e:
            logger.error(f"Error validating discount: {str(e)}")
            return None
    
    @staticmethod
    async def _check_restriction(
        restriction: DiscountRestriction,
        customer: Optional[Customer],
        user: Optional[User],
        tier: Optional[PricingTier],
        amount: Optional[float]
    ) -> bool:
        """Check if a single restriction is satisfied"""
        try:
            restriction_met = False
            
            if restriction.restriction_type == RestrictionType.FIRST_TIME_ONLY:
                if customer and customer.subscriptions:
                    restriction_met = len(customer.subscriptions) == 0
                else:
                    restriction_met = True
            
            elif restriction.restriction_type == RestrictionType.MINIMUM_AMOUNT:
                if amount:
                    restriction_met = amount >= restriction.restriction_value.get("amount", 0)
                else:
                    restriction_met = False
            
            elif restriction.restriction_type == RestrictionType.SPECIFIC_TIERS:
                if tier:
                    allowed_tiers = restriction.restriction_value.get("tiers", [])
                    restriction_met = tier.value in allowed_tiers
                else:
                    restriction_met = False
            
            elif restriction.restriction_type == RestrictionType.EMAIL_DOMAIN:
                if user:
                    allowed_domains = restriction.restriction_value.get("domains", [])
                    user_domain = user.email.split("@")[1] if "@" in user.email else ""
                    restriction_met = user_domain in allowed_domains
                else:
                    restriction_met = False
            
            # Handle negative restrictions (exclusions)
            if restriction.is_negative:
                restriction_met = not restriction_met
            
            return restriction_met
            
        except Exception as e:
            logger.error(f"Error checking restriction: {str(e)}")
            return False
    
    @staticmethod
    async def apply_discount(
        db: Session,
        discount: Discount,
        customer: Customer,
        subscription: Subscription,
        amount_discounted: float
    ) -> DiscountUsage:
        """Record discount usage"""
        try:
            # Create usage record
            usage = DiscountUsage(
                discount_id=discount.id,
                customer_id=customer.id,
                subscription_id=subscription.id,
                amount_discounted=amount_discounted,
                currency="usd"
            )
            db.add(usage)
            
            # Update discount usage count
            discount.times_redeemed += 1
            
            # Check if discount should be marked as depleted
            if discount.max_redemptions and discount.times_redeemed >= discount.max_redemptions:
                discount.status = DiscountStatus.DEPLETED
            
            db.commit()
            db.refresh(usage)
            
            logger.info(f"Applied discount {discount.code} for customer {customer.id}")
            return usage
            
        except Exception as e:
            logger.error(f"Error applying discount: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def get_discount_analytics(
        db: Session,
        discount_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get analytics for discount usage"""
        try:
            query = db.query(DiscountUsage)
            
            if discount_id:
                query = query.filter(DiscountUsage.discount_id == discount_id)
            
            if start_date:
                query = query.filter(DiscountUsage.applied_at >= start_date)
            
            if end_date:
                query = query.filter(DiscountUsage.applied_at <= end_date)
            
            usages = query.all()
            
            total_uses = len(usages)
            total_discounted = sum(u.amount_discounted for u in usages)
            
            # Group by discount
            discount_stats = {}
            for usage in usages:
                discount_code = usage.discount.code
                if discount_code not in discount_stats:
                    discount_stats[discount_code] = {
                        "uses": 0,
                        "total_discounted": 0,
                        "customers": set()
                    }
                discount_stats[discount_code]["uses"] += 1
                discount_stats[discount_code]["total_discounted"] += usage.amount_discounted
                discount_stats[discount_code]["customers"].add(usage.customer_id)
            
            # Convert sets to counts
            for code in discount_stats:
                discount_stats[code]["unique_customers"] = len(discount_stats[code]["customers"])
                del discount_stats[code]["customers"]
            
            return {
                "total_uses": total_uses,
                "total_discounted": total_discounted,
                "by_discount": discount_stats,
                "period": {
                    "start": start_date.isoformat() if start_date else None,
                    "end": end_date.isoformat() if end_date else None
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting discount analytics: {str(e)}")
            raise
    
    @staticmethod
    async def expire_discount(db: Session, discount_id: int) -> Discount:
        """Manually expire a discount"""
        try:
            discount = db.query(Discount).filter(Discount.id == discount_id).first()
            if discount:
                discount.status = DiscountStatus.EXPIRED
                discount.valid_until = datetime.utcnow()
                db.commit()
                db.refresh(discount)
                logger.info(f"Expired discount {discount.code}")
            return discount
        except Exception as e:
            logger.error(f"Error expiring discount: {str(e)}")
            db.rollback()
            raise