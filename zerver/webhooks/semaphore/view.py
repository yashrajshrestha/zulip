# Webhooks for external integrations.

from typing import Any, Dict

from django.http import HttpRequest, HttpResponse

from zerver.decorator import api_key_only_webhook_view
from zerver.lib.request import REQ, has_request_variables
from zerver.lib.response import json_success
from zerver.lib.webhooks.common import check_send_webhook_message
from zerver.models import UserProfile

BUILD_TEMPLATE = """
[Build {build_number}]({build_url}) {status}:
* **Commit**: [{commit_hash}: {commit_message}]({commit_url})
* **Author**: {email}
""".strip()

DEPLOY_TEMPLATE = """
[Deploy {deploy_number}]({deploy_url}) of [build {build_number}]({build_url}) {status}:
* **Commit**: [{commit_hash}: {commit_message}]({commit_url})
* **Author**: {email}
* **Server**: {server_name}
""".strip()

TOPIC_TEMPLATE = "{project}/{branch}"

@api_key_only_webhook_view('Semaphore')
@has_request_variables
def api_semaphore_webhook(request: HttpRequest, user_profile: UserProfile,
                          payload: Dict[str, Any]=REQ(argument_type='body')) -> HttpResponse:

    # semaphore only gives the last commit, even if there were multiple commits
    # since the last build
    branch_name = payload["branch_name"]
    project_name = payload["project_name"]
    result = payload["result"]
    event = payload["event"]
    commit_id = payload["commit"]["id"]
    commit_url = payload["commit"]["url"]
    author_email = payload["commit"]["author_email"]
    message = payload["commit"]["message"]

    if event == "build":
        build_url = payload["build_url"]
        build_number = payload["build_number"]
        content = BUILD_TEMPLATE.format(
            build_number=build_number,
            build_url=build_url,
            status=result,
            commit_hash=commit_id[:7],
            commit_message=message,
            commit_url=commit_url,
            email=author_email
        )

    elif event == "deploy":
        build_url = payload["build_html_url"]
        build_number = payload["build_number"]
        deploy_url = payload["html_url"]
        deploy_number = payload["number"]
        server_name = payload["server_name"]
        content = DEPLOY_TEMPLATE.format(
            deploy_number=deploy_number,
            deploy_url=deploy_url,
            build_number=build_number,
            build_url=build_url,
            status=result,
            commit_hash=commit_id[:7],
            commit_message=message,
            commit_url=commit_url,
            email=author_email,
            server_name=server_name
        )

    else:  # should never get here
        content = "{event}: {result}".format(
            event=event, result=result)

    subject = TOPIC_TEMPLATE.format(
        project=project_name,
        branch=branch_name
    )

    check_send_webhook_message(request, user_profile, subject, content)
    return json_success()
