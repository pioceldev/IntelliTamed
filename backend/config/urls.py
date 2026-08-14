"""Routes racines : /admin, /api/*, /api/health et le frontend statique."""
import os

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, JsonResponse
from django.urls import include, path, re_path

admin.site.site_header = "IntelliTamed Administration"
admin.site.site_title = "IntelliTamed"


def health(request):
    from apps.ai.services import DEFAULT_MODEL

    return JsonResponse(
        {
            "status": "ok",
            "gemini": "configured" if os.environ.get("GEMINI_API_KEY") else "missing-key",
            "model": DEFAULT_MODEL,
        }
    )


def frontend_files(request, path=""):
    """Sert le frontend existant (index.html, pages/, assets/)."""
    root = os.path.realpath(str(settings.FRONTEND_ROOT))
    if path == "" or path.endswith("/"):
        path = path + "index.html"
    full = os.path.realpath(os.path.join(root, path))
    if not full.startswith(root + os.sep) or not os.path.isfile(full):
        raise Http404
    return FileResponse(open(full, "rb"))


urlpatterns = [
    path("admin/", admin.site.urls),
    # API
    path("api/health", health, name="health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.projects.urls")),
    path("api/", include("apps.ai.urls")),
    path("api/", include("apps.action_plans.urls")),
    path("api/", include("apps.opportunities.urls")),
    path("api/", include("apps.notifications.urls")),
    # Frontend statique (à garder en dernier)
    re_path(r"^(?P<path>.*)$", frontend_files),
]
