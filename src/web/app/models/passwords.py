"""Password hashing with bcrypt, keeping existing werkzeug hashes usable.

Accounts created before bcrypt keep their scrypt/pbkdf2 hash until the next successful
login, when the hash is replaced by a bcrypt one (no reset, no locked accounts).
"""
import os

import bcrypt
from werkzeug.security import check_password_hash

# bcrypt only uses the first 72 bytes; longer passwords are refused instead of truncated
BCRYPT_MAX_BYTES = 72
_BCRYPT_PREFIXES = ('$2a$', '$2b$', '$2y$')


def _rounds():
    return int(os.environ.get('BCRYPT_ROUNDS', '12'))


def password_too_long(password):
    return len(password.encode('utf-8')) > BCRYPT_MAX_BYTES


def hash_password(password):
    if password_too_long(password):
        raise ValueError(f'A senha pode ter no máximo {BCRYPT_MAX_BYTES} bytes')
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=_rounds())).decode('utf-8')


def is_bcrypt_hash(stored):
    return isinstance(stored, str) and stored.startswith(_BCRYPT_PREFIXES)


def verify_password(stored, password):
    """Return (matches, new_hash). new_hash is a bcrypt hash to store when a legacy hash matched."""
    if not stored or not isinstance(password, str):
        return False, None
    if is_bcrypt_hash(stored):
        if password_too_long(password):
            return False, None
        try:
            return bcrypt.checkpw(password.encode('utf-8'), stored.encode('utf-8')), None
        except ValueError:
            return False, None
    try:
        matches = check_password_hash(stored, password)
    except (ValueError, TypeError):
        return False, None
    if matches and not password_too_long(password):
        return True, hash_password(password)
    return matches, None
