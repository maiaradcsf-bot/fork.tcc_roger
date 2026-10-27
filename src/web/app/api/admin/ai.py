from flask import jsonify

from app.ai import assistant, groq
from app.ai.groq import AIError
from app.api.admin import admin_bp
from app.api.utils import admin_required, json_body, permission_required


@admin_bp.route('/ai/status', methods=['GET'])
@permission_required('admin.dashboard.view')
def admin_ai_status():
    return jsonify({'enabled': groq.is_configured()})


@admin_bp.route('/ai/chat', methods=['POST'])
@permission_required('admin.dashboard.view')
def admin_ai_chat():
    user, error, status = admin_required()
    if error:
        return error, status
    try:
        return jsonify(assistant.chat(user, json_body().get('messages'), 'admin'))
    except AIError as exc:
        return jsonify({'error': exc.message, 'code': exc.code}), exc.status
