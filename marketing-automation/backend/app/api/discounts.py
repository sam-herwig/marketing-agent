from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.payment import Customer, Subscription, SubscriptionStatus, PricingTier
from app.models.discount import Discount
from app.services.discount_service import DiscountService
from app.services.stripe_service import StripeService
from app.models.discount import (
    DiscountType, DiscountDuration, DiscountStatus, RestrictionType
)
from pydantic import BaseModel, Field

router = APIRouter(prefix="/discounts", tags=["discounts"])


# Pydantic models
class DiscountRestrictionCreate(BaseModel):
    type: RestrictionType
    value: dict
    is_negative: bool = False


class DiscountCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    description: Optional[str] = None
    discount_type: DiscountType
    amount_off: Optional[float] = Field(None, gt=0)
    percent_off: Optional[int] = Field(None, ge=1, le=100)
    duration: DiscountDuration
    duration_in_months: Optional[int] = Field(None, ge=1)
    max_redemptions: Optional[int] = Field(None, ge=1)
    valid_until: Optional[datetime] = None
    restrictions: Optional[List[DiscountRestrictionCreate]] = []
    create_in_stripe: bool = True


class DiscountValidate(BaseModel):
    code: str
    tier: Optional[str] = None
    amount: Optional[float] = None


class DiscountApply(BaseModel):
    code: str
    subscription_id: Optional[int] = None


class DiscountResponse(BaseModel):
    id: int
    code: str
    description: Optional[str]
    discount_type: str
    amount_off: Optional[float]
    percent_off: Optional[int]
    duration: str
    duration_in_months: Optional[int]
    max_redemptions: Optional[int]
    times_redeemed: int
    valid_until: Optional[datetime]
    status: str
    created_at: datetime


@router.post("/", response_model=DiscountResponse)
async def create_discount(
    discount_data: DiscountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new discount (admin only)"""
    # Check if user is admin
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create discounts"
        )
    
    # Validate discount data
    if discount_data.discount_type == DiscountType.PERCENTAGE and not discount_data.percent_off:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Percentage discount requires percent_off value"
        )
    
    if discount_data.discount_type == DiscountType.FIXED_AMOUNT and not discount_data.amount_off:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fixed amount discount requires amount_off value"
        )
    
    if discount_data.duration == DiscountDuration.REPEATING and not discount_data.duration_in_months:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repeating discount requires duration_in_months"
        )
    
    # Create discount
    restrictions = [r.dict() for r in discount_data.restrictions] if discount_data.restrictions else []
    
    discount = await DiscountService.create_discount(
        db=db,
        code=discount_data.code,
        description=discount_data.description,
        discount_type=discount_data.discount_type,
        amount_off=discount_data.amount_off,
        percent_off=discount_data.percent_off,
        duration=discount_data.duration,
        duration_in_months=discount_data.duration_in_months,
        max_redemptions=discount_data.max_redemptions,
        valid_until=discount_data.valid_until,
        restrictions=restrictions,
        created_by_user_id=current_user.id,
        create_in_stripe=discount_data.create_in_stripe
    )
    
    return DiscountResponse(
        id=discount.id,
        code=discount.code,
        description=discount.description,
        discount_type=discount.discount_type.value,
        amount_off=discount.amount_off,
        percent_off=discount.percent_off,
        duration=discount.duration.value,
        duration_in_months=discount.duration_in_months,
        max_redemptions=discount.max_redemptions,
        times_redeemed=discount.times_redeemed,
        valid_until=discount.valid_until,
        status=discount.status.value,
        created_at=discount.created_at
    )


@router.get("/", response_model=List[DiscountResponse])
async def list_discounts(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all discounts (admin only)"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view discounts"
        )
    
    query = db.query(Discount)
    if active_only:
        query = query.filter(Discount.status == DiscountStatus.ACTIVE)
    
    discounts = query.offset(skip).limit(limit).all()
    
    return [
        DiscountResponse(
            id=d.id,
            code=d.code,
            description=d.description,
            discount_type=d.discount_type.value,
            amount_off=d.amount_off,
            percent_off=d.percent_off,
            duration=d.duration.value,
            duration_in_months=d.duration_in_months,
            max_redemptions=d.max_redemptions,
            times_redeemed=d.times_redeemed,
            valid_until=d.valid_until,
            status=d.status.value,
            created_at=d.created_at
        )
        for d in discounts
    ]


@router.post("/validate")
async def validate_discount(
    validation_data: DiscountValidate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate if a discount code can be used"""
    # Get customer if exists
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    
    # Convert tier string to enum if provided
    tier = None
    if validation_data.tier:
        try:
            tier = PricingTier(validation_data.tier)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tier value"
            )
    
    # Validate discount
    validation_result = await DiscountService.validate_discount(
        db=db,
        code=validation_data.code,
        customer=customer,
        user=current_user,
        tier=tier,
        amount=validation_data.amount
    )
    
    if not validation_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired discount code"
        )
    
    return validation_result


@router.post("/apply")
async def apply_discount(
    apply_data: DiscountApply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Apply a discount to a subscription"""
    # Get customer
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer account not found"
        )
    
    # Get subscription
    if apply_data.subscription_id:
        subscription = db.query(Subscription).filter(
            Subscription.id == apply_data.subscription_id,
            Subscription.customer_id == customer.id
        ).first()
    else:
        # Get active subscription
        subscription = db.query(Subscription).filter(
            Subscription.customer_id == customer.id,
            Subscription.status == SubscriptionStatus.ACTIVE
        ).first()
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found"
        )
    
    # Validate discount
    validation_result = await DiscountService.validate_discount(
        db=db,
        code=apply_data.code,
        customer=customer,
        user=current_user
    )
    
    if not validation_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired discount code"
        )
    
    # Apply to Stripe subscription
    try:
        await StripeService.apply_discount_to_subscription(
            db=db,
            subscription=subscription,
            discount_code=apply_data.code
        )
        
        # Record usage
        discount = db.query(Discount).filter(
            Discount.code == apply_data.code.upper()
        ).first()
        
        await DiscountService.apply_discount(
            db=db,
            discount=discount,
            customer=customer,
            subscription=subscription,
            amount_discounted=validation_result.get("discount_amount", 0)
        )
        
        return {
            "success": True,
            "message": f"Discount {apply_data.code} applied successfully",
            "discount_amount": validation_result.get("discount_amount", 0)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to apply discount: {str(e)}"
        )


@router.get("/analytics")
async def get_discount_analytics(
    discount_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get discount usage analytics (admin only)"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view analytics"
        )
    
    analytics = await DiscountService.get_discount_analytics(
        db=db,
        discount_id=discount_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return analytics


@router.delete("/{discount_id}")
async def expire_discount(
    discount_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Expire a discount (admin only)"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can expire discounts"
        )
    
    discount = await DiscountService.expire_discount(db, discount_id)
    if not discount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discount not found"
        )
    
    return {
        "success": True,
        "message": f"Discount {discount.code} expired successfully"
    }