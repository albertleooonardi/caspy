"""Explicit local or HTTPS deployment configuration; no forwarded-header trust."""
from urllib.parse import urlsplit

LOCAL_ORIGINS = ('http://localhost:4321', 'http://127.0.0.1:4321')


def public_origin(env):
    value = env.get('CASPY_PUBLIC_ORIGIN', 'http://localhost:4321').rstrip('/')
    parsed = urlsplit(value)
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path or not parsed.hostname:
        raise ValueError('CASPY_PUBLIC_ORIGIN must be an origin without a path or credentials.')
    if parsed.scheme != 'https' and value not in LOCAL_ORIGINS:
        raise ValueError('A hosted Caspy origin must use HTTPS.')
    return value


def server_settings(env):
    origin = public_origin(env)
    production = env.get('CASPY_ENV') == 'production'
    if production and not origin.startswith('https://'):
        raise ValueError('Production requires an explicit HTTPS CASPY_PUBLIC_ORIGIN.')
    host = env.get('CASPY_API_HOST', '127.0.0.1')
    if host not in ('127.0.0.1', '0.0.0.0'):
        raise ValueError('CASPY_API_HOST must be 127.0.0.1 or 0.0.0.0.')
    port = int(env.get('PORT', '8000'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT must be between 1 and 65535.')
    return {'address': (host, port), 'origins': (origin,) if production else (*LOCAL_ORIGINS, origin),
            'secure_cookies': production or origin.startswith('https://'), 'production': production}
