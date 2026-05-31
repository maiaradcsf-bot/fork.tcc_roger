from enum import Enum


class CartStatus(str, Enum):
    OPEN = 'open'
    CLOSED = 'closed'


class OrderStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    FINISHED = 'finished'
