from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.models.database import get_db
from app.models.user import User
from app.core.security import get_password_hash
from app.middleware.rate_limit import limiter, RateLimits

router = APIRouter()

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

@router.post("/register")
@limiter.limit(RateLimits.REGISTER)
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email, 
        username=user_data.username, 
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {"id": db_user.id, "email": db_user.email, "username": db_user.username}