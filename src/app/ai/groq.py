"""Minimal client for the Groq chat completions API (OpenAI compatible), using only the stdlib."""
import json
import os
import time
import urllib.error
import urllib.request

from flask import current_app

GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
DEFAULT_MODEL = 'openai/gpt-oss-120b'
TIMEOUT_SECONDS = 30
MAX_RETRY_WAIT_SECONDS = 5


class AIError(Exception):
    """Failure talking to the AI provider; `status` is the HTTP status the API answers with."""

    def __init__(self, message, status=502, code='ai_unavailable'):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


def is_configured():
    return bool(os.environ.get('GROQ_API_KEY'))


def _retry_delay(exc):
    try:
        return float(exc.headers.get('retry-after') or 0)
    except (TypeError, ValueError):
        return 0


def _send(request):
    """POST the request; a 429 asking to wait a few seconds is retried once."""
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            delay = _retry_delay(exc)
            if exc.code != 429 or attempt or not 0 < delay <= MAX_RETRY_WAIT_SECONDS:
                raise
            time.sleep(delay)


def chat_completion(messages, tools=None, temperature=0.2, max_tokens=700, tool_choice='auto'):
    """Send one chat completion request and return the assistant message dict."""
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        raise AIError('Assistente de IA não configurado no servidor.', 503, 'ai_not_configured')

    payload = {
        'model': os.environ.get('GROQ_MODEL') or DEFAULT_MODEL,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens,
    }
    if tools:
        payload['tools'] = tools
        payload['tool_choice'] = tool_choice

    request = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'almoxarifado-sesi/1.0',
        },
        method='POST',
    )
    try:
        body = _send(request)
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise AIError('Limite de uso do assistente atingido. Tente novamente em instantes.', 429, 'ai_rate_limited')
        if exc.code in (401, 403):
            raise AIError('Chave da IA inválida no servidor.', 503, 'ai_not_configured')
        current_app.logger.warning('Groq HTTP %s: %s', exc.code, exc.read()[:300].decode('utf-8', 'replace'))
        raise AIError('O assistente de IA está indisponível no momento.')
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        current_app.logger.warning('Groq request failed: %r', exc)
        raise AIError('O assistente de IA está indisponível no momento.')

    try:
        return body['choices'][0]['message']
    except (KeyError, IndexError, TypeError):
        raise AIError('Resposta inválida do assistente de IA.')
