import uuid
from sqlalchemy import Column, String, Boolean, Numeric, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    shipping_cost = Column(Numeric(10, 2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stocks = relationship("WarehouseStock", back_populates="warehouse", cascade="all, delete-orphan")


class WarehouseStock(Base):
    __tablename__ = "warehouse_stocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=0)
    reserved = Column(Integer, default=0)

    warehouse = relationship("Warehouse", back_populates="stocks")
    product = relationship("Product", back_populates="warehouse_stocks")
