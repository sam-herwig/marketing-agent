from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.models.database import Base


class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    

class DiscountDuration(str, enum.Enum):
    ONCE = "once"
    REPEATING = "repeating"
    FOREVER = "forever"


class DiscountStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    DEPLETED = "depleted"
    CANCELLED = "cancelled"


class Discount(Base):
    __tablename__ = "discounts"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, nullable=True)
    
    # Stripe references
    stripe_coupon_id = Column(String, unique=True, nullable=True)
    stripe_promotion_code_id = Column(String, unique=True, nullable=True)
    
    # Discount details
    discount_type = Column(Enum(DiscountType), nullable=False)
    amount_off = Column(Float, nullable=True)  # For fixed amount discounts
    percent_off = Column(Integer, nullable=True)  # For percentage discounts
    currency = Column(String, default="usd")
    
    # Duration
    duration = Column(Enum(DiscountDuration), nullable=False)
    duration_in_months = Column(Integer, nullable=True)  # For repeating discounts
    
    # Usage limits
    max_redemptions = Column(Integer, nullable=True)
    times_redeemed = Column(Integer, default=0)
    
    # Validity
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)
    
    # Status
    status = Column(Enum(DiscountStatus), default=DiscountStatus.ACTIVE)
    
    # Metadata
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    usage_records = relationship("DiscountUsage", back_populates="discount")
    restrictions = relationship("DiscountRestriction", back_populates="discount", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_user_id])


class DiscountUsage(Base):
    __tablename__ = "discount_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    discount_id = Column(Integer, ForeignKey("discounts.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    
    # Usage details
    applied_at = Column(DateTime, default=datetime.utcnow)
    amount_discounted = Column(Float, nullable=False)
    currency = Column(String, default="usd")
    
    # Stripe reference
    stripe_invoice_id = Column(String, nullable=True)
    
    # Relationships
    discount = relationship("Discount", back_populates="usage_records")
    customer = relationship("Customer")
    subscription = relationship("Subscription")
    
    # Ensure one discount per subscription
    __table_args__ = (
        UniqueConstraint('discount_id', 'subscription_id', name='_discount_subscription_uc'),
    )


class RestrictionType(str, enum.Enum):
    FIRST_TIME_ONLY = "first_time_only"
    MINIMUM_AMOUNT = "minimum_amount"
    SPECIFIC_TIERS = "specific_tiers"
    SPECIFIC_PRODUCTS = "specific_products"
    EMAIL_DOMAIN = "email_domain"
    USER_ROLE = "user_role"


class DiscountRestriction(Base):
    __tablename__ = "discount_restrictions"
    
    id = Column(Integer, primary_key=True, index=True)
    discount_id = Column(Integer, ForeignKey("discounts.id"), nullable=False)
    
    restriction_type = Column(Enum(RestrictionType), nullable=False)
    restriction_value = Column(JSON, nullable=False)
    
    # For complex restrictions
    is_negative = Column(Boolean, default=False)  # If true, this is an exclusion rule
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    discount = relationship("Discount", back_populates="restrictions")