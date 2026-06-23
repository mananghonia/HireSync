from rest_framework.throttling import AnonRateThrottle


class _FirstIPThrottle(AnonRateThrottle):
    """Use the first IP in X-Forwarded-For (real client) not the last (proxy)."""

    def get_ident(self, request):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


class AuthRateThrottle(_FirstIPThrottle):
    scope = "auth"


class OTPRateThrottle(_FirstIPThrottle):
    scope = "otp"
